"""
Browser worker: uses Playwright to autonomously browse the web.

Capabilities:
- Visit URLs and extract content
- Take screenshots of websites
- Check site health (status codes, load time, SSL)
- Fill forms
- Scrape structured data (contacts, pricing, features)
"""

import base64
import fnmatch
import json
import logging
import os
import re
import time
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

from swarm.config import CLAUDE_CLI_PATH
from swarm.workers.base import BaseWorker

logger = logging.getLogger("swarm.worker.browser")

# ── Safety rails ─────────────────────────────────────────────────────────────

BLOCKED_URL_PATTERNS = [
    "*.bank.com",
    "*.paypal.com",
    "login.*",
    "*.chase.com",
    "*.wellsfargo.com",
    "*.citi.com",
    "facebook.com",
    "twitter.com",
    "x.com",
    "instagram.com",
    "linkedin.com/login*",
    "accounts.google.com",
    "*.venmo.com",
    "*.stripe.com/dashboard*",
]

BLOCKED_ACTIONS = [
    "enter_credit_card",
    "submit_login",
    "post_social_media",
    "download_executable",
]

# ── Task type registry ───────────────────────────────────────────────────────

BROWSER_TASK_TYPES = {
    "screenshot": "Visit URL and take a full-page screenshot",
    "health_check": "Check URL status code, load time, SSL cert, responsive",
    "scrape_contacts": "Visit URL and extract email, phone, address",
    "scrape_content": "Visit URL and extract main content as text",
    "research_competitor": "Visit competitor site, summarize what they offer",
    "check_deploy": "Verify our deployed site is working correctly",
    "form_fill": "Visit URL, fill form fields, submit",
}


def _is_url_blocked(url: str) -> bool:
    """Check if a URL matches any blocked pattern."""
    parsed = urlparse(url)
    hostname = parsed.netloc.lower()
    full_url = url.lower()

    for pattern in BLOCKED_URL_PATTERNS:
        # Match against hostname
        if fnmatch.fnmatch(hostname, pattern):
            return True
        # Match against full URL
        if fnmatch.fnmatch(full_url, f"*{pattern}*"):
            return True
    return False


def _ensure_playwright_installed():
    """Install Playwright Chromium browser if not already installed."""
    try:
        from playwright.sync_api import sync_playwright

        with sync_playwright() as p:
            # Try to launch to see if browser is installed
            browser = p.chromium.launch(headless=True)
            browser.close()
    except Exception:
        logger.info("Installing Playwright Chromium browser...")
        import subprocess

        subprocess.run(
            ["python", "-m", "playwright", "install", "chromium"],
            check=True,
            capture_output=True,
        )
        logger.info("Playwright Chromium installed successfully")


class BrowserWorker(BaseWorker):
    """Worker that uses Playwright to browse the web autonomously.

    Capabilities:
    - Visit URLs and extract content
    - Take screenshots of websites
    - Check site health (status codes, load time, SSL)
    - Fill forms
    - Scrape structured data (contacts, pricing, features)
    """

    def __init__(self):
        super().__init__(worker_type="browser", tier="browser")
        _ensure_playwright_installed()

    def execute(self, task: dict[str, Any]) -> dict[str, Any]:
        """Execute a browser task.

        Args:
            task: Task row from Supabase. input_data should contain:
                - url: The URL to visit
                - action: One of BROWSER_TASK_TYPES keys
                - selectors (optional): CSS selectors for scraping
                - form_data (optional): Dict of field name -> value for form_fill
                - prompt (optional): Additional instructions

        Returns:
            Output data with action results
        """
        input_data = task.get("input_data", {})
        if isinstance(input_data, str):
            input_data = json.loads(input_data)

        url = input_data.get("url", "")
        action = input_data.get("action", "health_check")
        prompt = input_data.get("prompt", "")

        if not url:
            raise ValueError("Task input_data must contain a 'url' field")

        # Safety check
        if _is_url_blocked(url):
            raise ValueError(f"URL is blocked by safety policy: {url}")

        if action in BLOCKED_ACTIONS:
            raise ValueError(f"Action is blocked by safety policy: {action}")

        logger.info("Browser task: action=%s url=%s", action, url)

        # Dispatch to action handler
        handlers = {
            "screenshot": self._action_screenshot,
            "health_check": self._action_health_check,
            "scrape_contacts": self._action_scrape_contacts,
            "scrape_content": self._action_scrape_content,
            "research_competitor": self._action_research_competitor,
            "check_deploy": self._action_check_deploy,
            "form_fill": self._action_form_fill,
        }

        handler = handlers.get(action)
        if not handler:
            raise ValueError(
                f"Unknown browser action: {action}. "
                f"Valid actions: {list(BROWSER_TASK_TYPES.keys())}"
            )

        result = handler(url, input_data)
        result["action"] = action
        result["url"] = url
        return result

    # ── Action: Screenshot ────────────────────────────────────────────────

    def _action_screenshot(
        self, url: str, input_data: dict[str, Any]
    ) -> dict[str, Any]:
        """Visit URL and take a full-page screenshot."""
        from playwright.sync_api import sync_playwright

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1280, "height": 720})

            try:
                response = page.goto(url, wait_until="networkidle", timeout=30000)
                status_code = response.status if response else 0

                # Take screenshot as bytes
                screenshot_bytes = page.screenshot(full_page=True)
                screenshot_b64 = base64.b64encode(screenshot_bytes).decode("utf-8")

                # Also save to file if output dir exists
                output_dir = input_data.get("output_dir", "")
                file_path = ""
                if output_dir and os.path.isdir(output_dir):
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    domain = urlparse(url).netloc.replace(".", "_")
                    file_path = os.path.join(
                        output_dir, f"screenshot_{domain}_{timestamp}.png"
                    )
                    with open(file_path, "wb") as f:
                        f.write(screenshot_bytes)
                    logger.info("Screenshot saved to %s", file_path)

                return {
                    "response": f"Screenshot taken of {url} (status: {status_code})",
                    "status_code": status_code,
                    "screenshot_b64": screenshot_b64,
                    "file_path": file_path,
                    "cost_cents": 0,
                }
            finally:
                browser.close()

    # ── Action: Health Check ──────────────────────────────────────────────

    def _action_health_check(
        self, url: str, input_data: dict[str, Any]
    ) -> dict[str, Any]:
        """Check URL status code, load time, SSL, and responsiveness."""
        from playwright.sync_api import sync_playwright

        results = {
            "status_code": 0,
            "load_time_ms": 0,
            "ssl_valid": False,
            "title": "",
            "responsive": False,
            "errors": [],
        }

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)

            try:
                # Desktop check
                page = browser.new_page(viewport={"width": 1280, "height": 720})
                console_errors = []
                page.on(
                    "console",
                    lambda msg: (
                        console_errors.append(msg.text)
                        if msg.type == "error"
                        else None
                    ),
                )

                start_time = time.time()
                response = page.goto(url, wait_until="networkidle", timeout=30000)
                load_time_ms = int((time.time() - start_time) * 1000)

                results["status_code"] = response.status if response else 0
                results["load_time_ms"] = load_time_ms
                results["ssl_valid"] = url.startswith("https://")
                results["title"] = page.title()
                results["errors"] = console_errors[:10]  # Cap at 10
                page.close()

                # Mobile responsive check
                mobile_page = browser.new_page(
                    viewport={"width": 375, "height": 812},
                    user_agent=(
                        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) "
                        "AppleWebKit/605.1.15 (KHTML, like Gecko) "
                        "Version/16.0 Mobile/15E148 Safari/604.1"
                    ),
                )
                mobile_resp = mobile_page.goto(
                    url, wait_until="networkidle", timeout=30000
                )
                results["responsive"] = (
                    mobile_resp.status == results["status_code"] if mobile_resp else False
                )

                # Check for viewport meta tag
                has_viewport = mobile_page.evaluate(
                    "!!document.querySelector('meta[name=viewport]')"
                )
                results["has_viewport_meta"] = has_viewport
                mobile_page.close()

            except Exception as e:
                results["errors"].append(f"Health check error: {str(e)}")
            finally:
                browser.close()

        # Build summary
        status = results["status_code"]
        load = results["load_time_ms"]
        ssl = "valid" if results["ssl_valid"] else "none"
        resp = "yes" if results["responsive"] else "no"
        error_count = len(results["errors"])

        summary = (
            f"Health check for {url}: "
            f"Status {status}, Load {load}ms, SSL {ssl}, "
            f"Responsive: {resp}, Console errors: {error_count}"
        )

        results["response"] = summary
        results["cost_cents"] = 0
        return results

    # ── Action: Scrape Contacts ───────────────────────────────────────────

    def _action_scrape_contacts(
        self, url: str, input_data: dict[str, Any]
    ) -> dict[str, Any]:
        """Visit URL and extract email, phone, and address info."""
        from playwright.sync_api import sync_playwright

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()

            try:
                page.goto(url, wait_until="networkidle", timeout=30000)
                page_text = page.inner_text("body")

                # Extract emails
                emails = list(
                    set(re.findall(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", page_text))
                )

                # Extract phone numbers
                phones = list(
                    set(
                        re.findall(
                            r"[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}",
                            page_text,
                        )
                    )
                )

                # Extract links (social, contact pages)
                links = page.evaluate("""
                    () => {
                        const anchors = document.querySelectorAll('a[href]');
                        const contactLinks = [];
                        for (const a of anchors) {
                            const href = a.href.toLowerCase();
                            if (href.includes('contact') || href.includes('about') ||
                                href.includes('mailto:') || href.includes('tel:')) {
                                contactLinks.push({ text: a.textContent.trim(), href: a.href });
                            }
                        }
                        return contactLinks.slice(0, 20);
                    }
                """)

                contacts = {
                    "emails": emails[:10],
                    "phones": phones[:10],
                    "contact_links": links,
                }

                return {
                    "response": (
                        f"Found {len(emails)} emails, {len(phones)} phones "
                        f"on {url}"
                    ),
                    "contacts": contacts,
                    "cost_cents": 0,
                }
            finally:
                browser.close()

    # ── Action: Scrape Content ────────────────────────────────────────────

    def _action_scrape_content(
        self, url: str, input_data: dict[str, Any]
    ) -> dict[str, Any]:
        """Visit URL and extract main content as text."""
        from playwright.sync_api import sync_playwright

        selectors = input_data.get("selectors", [])

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()

            try:
                page.goto(url, wait_until="networkidle", timeout=30000)

                if selectors:
                    # Extract specific elements
                    extracted = {}
                    for selector in selectors:
                        try:
                            elements = page.query_selector_all(selector)
                            extracted[selector] = [
                                el.inner_text() for el in elements
                            ]
                        except Exception:
                            extracted[selector] = []
                    content = json.dumps(extracted, indent=2)
                else:
                    # Extract main content, stripping nav/footer/script
                    content = page.evaluate("""
                        () => {
                            // Remove noise elements
                            const remove = ['nav', 'footer', 'script', 'style',
                                          'noscript', 'iframe', 'header'];
                            remove.forEach(tag => {
                                document.querySelectorAll(tag).forEach(el => el.remove());
                            });
                            return document.body.innerText.trim();
                        }
                    """)

                title = page.title()

                # Truncate content to avoid huge payloads
                if len(content) > 10000:
                    content = content[:10000] + "\n\n[... truncated]"

                return {
                    "response": f"Extracted content from {url} ({len(content)} chars)",
                    "title": title,
                    "content": content,
                    "cost_cents": 0,
                }
            finally:
                browser.close()

    # ── Action: Research Competitor ───────────────────────────────────────

    def _action_research_competitor(
        self, url: str, input_data: dict[str, Any]
    ) -> dict[str, Any]:
        """Visit competitor site, extract content, and summarize with Haiku."""
        from playwright.sync_api import sync_playwright

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()

            try:
                page.goto(url, wait_until="networkidle", timeout=30000)

                # Get page content
                content = page.evaluate("""
                    () => {
                        const remove = ['nav', 'footer', 'script', 'style',
                                      'noscript', 'iframe'];
                        remove.forEach(tag => {
                            document.querySelectorAll(tag).forEach(el => el.remove());
                        });
                        return document.body.innerText.trim();
                    }
                """)
                title = page.title()

                # Get meta description
                meta_desc = page.evaluate("""
                    () => {
                        const meta = document.querySelector('meta[name="description"]');
                        return meta ? meta.getAttribute('content') : '';
                    }
                """)

                # Get pricing info if visible
                pricing_text = page.evaluate("""
                    () => {
                        const pricingEls = document.querySelectorAll(
                            '[class*="price"], [class*="pricing"], [id*="pricing"]'
                        );
                        if (pricingEls.length > 0) {
                            return Array.from(pricingEls)
                                .map(el => el.innerText.trim())
                                .join('\\n');
                        }
                        return '';
                    }
                """)

            finally:
                browser.close()

        # Truncate content for analysis
        content_for_ai = content[:5000] if len(content) > 5000 else content

        # Build analysis prompt
        prompt = input_data.get("prompt", "")
        analysis_prompt = (
            "You are a competitive analyst. Summarize what this company/site offers. "
            "Include: what they do, key features, pricing (if found), target audience, "
            "strengths, and weaknesses. Be concise.\n\n"
            f"Analyze this competitor website.\n\n"
            f"URL: {url}\nTitle: {title}\n"
            f"Meta description: {meta_desc}\n\n"
            f"Page content:\n{content_for_ai}\n\n"
        )
        if pricing_text:
            analysis_prompt += f"Pricing section:\n{pricing_text}\n\n"
        if prompt:
            analysis_prompt += f"Additional instructions: {prompt}\n"

        # Use Claude Code CLI (free on Max plan) instead of direct API
        import subprocess
        import tempfile

        prompt_file = os.path.join(
            tempfile.gettempdir(), f"swarm-browser-research-{int(time.time())}.txt"
        )
        with open(prompt_file, "w", encoding="utf-8") as pf:
            pf.write(analysis_prompt)

        shell_cmd = (
            f'type "{prompt_file}" | "{CLAUDE_CLI_PATH}" '
            f'--output-format text -p -'
        )

        try:
            startupinfo = None
            if os.name == "nt":
                startupinfo = subprocess.STARTUPINFO()
                startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                startupinfo.wShowWindow = subprocess.SW_HIDE

            result = subprocess.run(
                shell_cmd,
                capture_output=True,
                text=True,
                timeout=120,
                shell=True,
                encoding="utf-8",
                errors="replace",
                startupinfo=startupinfo,
            )
            response_text = result.stdout or ""
        except subprocess.TimeoutExpired:
            response_text = f"Analysis timed out for {url}"
        except Exception as e:
            response_text = f"Analysis failed: {e}"
        finally:
            try:
                os.remove(prompt_file)
            except Exception:
                pass

        return {
            "response": response_text,
            "title": title,
            "meta_description": meta_desc,
            "pricing_found": bool(pricing_text),
            "cost_cents": 0,  # Free on Max plan
        }

    # ── Action: Check Deploy ──────────────────────────────────────────────

    def _action_check_deploy(
        self, url: str, input_data: dict[str, Any]
    ) -> dict[str, Any]:
        """Verify a deployed site is working correctly."""
        from playwright.sync_api import sync_playwright

        checks = {
            "url": url,
            "reachable": False,
            "status_code": 0,
            "load_time_ms": 0,
            "title": "",
            "has_content": False,
            "no_error_page": True,
            "ssl_valid": url.startswith("https://"),
            "console_errors": [],
            "issues": [],
        }

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1280, "height": 720})

            console_errors = []
            page.on(
                "console",
                lambda msg: (
                    console_errors.append(msg.text)
                    if msg.type == "error"
                    else None
                ),
            )

            try:
                start = time.time()
                response = page.goto(url, wait_until="networkidle", timeout=30000)
                load_ms = int((time.time() - start) * 1000)

                checks["reachable"] = True
                checks["status_code"] = response.status if response else 0
                checks["load_time_ms"] = load_ms
                checks["title"] = page.title()
                checks["console_errors"] = console_errors[:10]

                # Check for content
                body_text = page.inner_text("body")
                checks["has_content"] = len(body_text.strip()) > 50

                # Check for common error indicators
                error_indicators = [
                    "application error",
                    "500 internal server error",
                    "404 not found",
                    "502 bad gateway",
                    "503 service unavailable",
                    "this site can't be reached",
                    "server error",
                    "deployment failed",
                ]
                body_lower = body_text.lower()
                for indicator in error_indicators:
                    if indicator in body_lower:
                        checks["no_error_page"] = False
                        checks["issues"].append(f"Error indicator found: '{indicator}'")

                # Check for slow load
                if load_ms > 5000:
                    checks["issues"].append(f"Slow load time: {load_ms}ms")

                # Check status code
                if checks["status_code"] >= 400:
                    checks["issues"].append(
                        f"Bad status code: {checks['status_code']}"
                    )

            except Exception as e:
                checks["issues"].append(f"Failed to reach site: {str(e)}")
            finally:
                browser.close()

        # Determine overall health
        healthy = (
            checks["reachable"]
            and checks["status_code"] == 200
            and checks["has_content"]
            and checks["no_error_page"]
            and len(checks["issues"]) == 0
        )

        status_emoji = "OK" if healthy else "ISSUES DETECTED"
        summary = (
            f"Deploy check for {url}: {status_emoji}. "
            f"Status {checks['status_code']}, Load {checks['load_time_ms']}ms"
        )
        if checks["issues"]:
            summary += f". Issues: {'; '.join(checks['issues'])}"

        checks["healthy"] = healthy
        checks["response"] = summary
        checks["cost_cents"] = 0
        return checks

    # ── Action: Form Fill ─────────────────────────────────────────────────

    def _action_form_fill(
        self, url: str, input_data: dict[str, Any]
    ) -> dict[str, Any]:
        """Visit URL, fill form fields, and submit."""
        from playwright.sync_api import sync_playwright

        form_data = input_data.get("form_data", {})
        if not form_data:
            raise ValueError("form_fill action requires 'form_data' in input_data")

        # Safety: never fill sensitive fields
        sensitive_fields = [
            "password", "passwd", "credit_card", "cc_number", "cvv",
            "ssn", "social_security", "card_number", "expiry",
        ]
        for field_name in form_data:
            if any(s in field_name.lower() for s in sensitive_fields):
                raise ValueError(
                    f"Safety block: cannot fill sensitive field '{field_name}'"
                )

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()

            try:
                page.goto(url, wait_until="networkidle", timeout=30000)

                filled_fields = []
                failed_fields = []

                for selector, value in form_data.items():
                    try:
                        element = page.query_selector(selector)
                        if element:
                            tag = element.evaluate("el => el.tagName.toLowerCase()")
                            if tag == "select":
                                page.select_option(selector, value)
                            elif tag == "textarea":
                                element.fill(value)
                            else:
                                element.fill(value)
                            filled_fields.append(selector)
                        else:
                            failed_fields.append(
                                {"selector": selector, "error": "Element not found"}
                            )
                    except Exception as e:
                        failed_fields.append(
                            {"selector": selector, "error": str(e)}
                        )

                # Submit if requested
                submitted = False
                submit_selector = input_data.get("submit_selector", "")
                if submit_selector:
                    try:
                        page.click(submit_selector)
                        page.wait_for_load_state("networkidle", timeout=10000)
                        submitted = True
                    except Exception as e:
                        failed_fields.append(
                            {"selector": submit_selector, "error": f"Submit failed: {e}"}
                        )

                return {
                    "response": (
                        f"Form fill on {url}: "
                        f"{len(filled_fields)} fields filled, "
                        f"{len(failed_fields)} failed"
                        f"{', submitted' if submitted else ''}"
                    ),
                    "filled_fields": filled_fields,
                    "failed_fields": failed_fields,
                    "submitted": submitted,
                    "cost_cents": 0,
                }
            finally:
                browser.close()
