"""Script 48: Apply all SQL files in supabase/ folder."""
import os, json, urllib.request, glob

SB_URL = "https://ytvtaorgityczrdhhzqv.supabase.co"
SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0dnRhb3JnaXR5Y3pyZGhoenF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MzY4MTEsImV4cCI6MjA4NjUxMjgxMX0.A2uG-yVQ1HSV9-zlNDAztHHVw25g1cQ43180y3TfwGk"

MIGRATIONS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "supabase")

sql_files = sorted(glob.glob(os.path.join(MIGRATIONS_DIR, "*.sql")))

if not sql_files:
    print("  No SQL files found in supabase/")
    exit(0)

print(f"\n  Found {len(sql_files)} migration files\n")

for sql_file in sql_files:
    name = os.path.basename(sql_file)
    with open(sql_file) as f:
        sql = f.read()

    print(f"  Applying: {name}...", end=" ")

    # Use Supabase REST RPC or raw SQL endpoint
    # Note: The anon key can't run raw SQL — this needs the service key or Supabase CLI
    print("SKIPPED (use Supabase SQL Editor or CLI)")
    print(f"    SQL preview: {sql[:100]}...")

print(f"\n  To apply manually:")
print(f"  1. Open https://supabase.com/dashboard/project/ytvtaorgityczrdhhzqv/sql/new")
print(f"  2. Paste the SQL from each file")
print(f"  3. Click Run")
