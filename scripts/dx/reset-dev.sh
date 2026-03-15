#!/bin/bash
# Script 43: Clean slate — delete test data, reseed
echo ""
echo "  === NEXUS DEV RESET ==="
echo ""
echo "  WARNING: This will delete all test sessions and events"
read -p "  Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "  Cancelled"
    exit 0
fi

cd "$(dirname "$0")/../.."

echo "  [1/3] Deleting test sessions..."
python -c "
import json, urllib.request
SB='https://ytvtaorgityczrdhhzqv.supabase.co'
KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0dnRhb3JnaXR5Y3pyZGhoenF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MzY4MTEsImV4cCI6MjA4NjUxMjgxMX0.A2uG-yVQ1HSV9-zlNDAztHHVw25g1cQ43180y3TfwGk'
for table in ['nexus_sessions', 'nexus_hook_events']:
    req = urllib.request.Request(f'{SB}/rest/v1/{table}?session_id=like.test-*',
        headers={'apikey': KEY, 'Authorization': f'Bearer {KEY}', 'Prefer': 'return=representation'}, method='DELETE')
    r = json.loads(urllib.request.urlopen(req, timeout=10).read())
    print(f'  Deleted {len(r)} from {table}')
"

echo "  [2/3] Cleaning .next cache..."
rm -rf .next

echo "  [3/3] Seeding demo data..."
python scripts/dx/seed-demo-data.py

echo ""
echo "  Reset complete!"
