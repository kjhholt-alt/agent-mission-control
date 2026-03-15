"""Test 6: Fire N concurrent collector events, measure latency."""
import json, urllib.request, time, sys
from concurrent.futures import ThreadPoolExecutor, as_completed

NEXUS = "http://localhost:3000"
N = int(sys.argv[1]) if len(sys.argv) > 1 else 50

def send_event(i):
    start = time.time()
    data = json.dumps({
        "session_id": f"load-test-{i}",
        "event_type": "PreToolUse",
        "tool_name": "Read",
        "workspace_path": "C:/Users/Kruz/Desktop/Projects/nexus",
        "model": "claude-sonnet-4-6",
    }).encode()
    req = urllib.request.Request(f"{NEXUS}/api/collector/event", data, {"Content-Type": "application/json"})
    try:
        urllib.request.urlopen(req, timeout=10)
        return time.time() - start, True
    except Exception as e:
        return time.time() - start, False

print(f"\n  Load test: {N} concurrent events to {NEXUS}/api/collector/event\n")

start = time.time()
results = []
with ThreadPoolExecutor(max_workers=min(N, 20)) as pool:
    futures = {pool.submit(send_event, i): i for i in range(N)}
    for f in as_completed(futures):
        results.append(f.result())

total_time = time.time() - start
successes = sum(1 for _, ok in results if ok)
failures = N - successes
latencies = [t for t, ok in results if ok]

print(f"  Total time:  {total_time:.2f}s")
print(f"  Throughput:  {N / total_time:.1f} req/s")
print(f"  Success:     {successes}/{N}")
print(f"  Failures:    {failures}")
if latencies:
    latencies.sort()
    print(f"  Avg latency: {sum(latencies)/len(latencies)*1000:.0f}ms")
    print(f"  P50 latency: {latencies[len(latencies)//2]*1000:.0f}ms")
    print(f"  P95 latency: {latencies[int(len(latencies)*0.95)]*1000:.0f}ms")
    print(f"  Max latency: {max(latencies)*1000:.0f}ms")
