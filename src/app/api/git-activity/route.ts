import { NextResponse } from "next/server";

interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      date: string;
    };
  };
  html_url: string;
}

interface GitHubRepo {
  name: string;
  full_name: string;
  pushed_at: string;
  default_branch: string;
}

const GITHUB_USER = "kjhholt-alt";

// Repos to track (matches project directory structure)
const TRACKED_REPOS = [
  "nexus",
  "ai-finance-brief",
  "trade-journal",
  "ai-chess-coach",
  "outdoor-crm",
  "n16-soccer",
  "BarrelHouseCRM",
  "buildkit-services",
  "email-finder-app",
  "pc-bottleneck-analyzer",
  "mcp-servers",
  "MoneyPrinter",
  "autopilot",
  "autopilot-finance",
];

async function fetchJSON(url: string) {
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "Nexus-Dashboard",
    },
    next: { revalidate: 300 }, // Cache for 5 minutes
  });
  if (!res.ok) return null;
  return res.json();
}

/**
 * GET /api/git-activity — Fetch recent commits across tracked GitHub repos.
 * Returns last 3 commits per repo, sorted by most recently pushed.
 */
export async function GET() {
  try {
    // Fetch all repos for the user to get push times
    const repos: GitHubRepo[] | null = await fetchJSON(
      `https://api.github.com/users/${GITHUB_USER}/repos?sort=pushed&per_page=50`
    );

    if (!repos) {
      return NextResponse.json({ commits: [], error: "GitHub API unavailable" });
    }

    // Filter to tracked repos that were pushed recently
    const tracked = repos
      .filter((r) => TRACKED_REPOS.includes(r.name))
      .slice(0, 10); // Top 10 most recently pushed

    // Fetch commits in parallel (3 per repo)
    const commitPromises = tracked.map(async (repo) => {
      const commits: GitHubCommit[] | null = await fetchJSON(
        `https://api.github.com/repos/${repo.full_name}/commits?per_page=3`
      );
      if (!commits) return [];
      return commits.map((c) => ({
        repo: repo.name,
        sha: c.sha.slice(0, 7),
        message: c.commit.message.split("\n")[0].slice(0, 80),
        author: c.commit.author.name,
        date: c.commit.author.date,
        url: c.html_url,
      }));
    });

    const allCommits = (await Promise.all(commitPromises))
      .flat()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20); // Top 20 most recent across all repos

    return NextResponse.json({ commits: allCommits });
  } catch {
    return NextResponse.json({ commits: [], error: "Failed to fetch git activity" });
  }
}
