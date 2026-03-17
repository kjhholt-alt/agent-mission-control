-- Create health_checks table for monitoring service status
CREATE TABLE IF NOT EXISTS health_checks (
  id BIGSERIAL PRIMARY KEY,
  service_name TEXT NOT NULL,
  service_url TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'down')),
  response_time_ms INTEGER NOT NULL,
  error_message TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_health_checks_service_name ON health_checks(service_name);
CREATE INDEX idx_health_checks_checked_at ON health_checks(checked_at DESC);
CREATE INDEX idx_health_checks_status ON health_checks(status);

-- Enable Row Level Security
ALTER TABLE health_checks ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read access
CREATE POLICY "Allow public read access" ON health_checks
  FOR SELECT
  USING (true);

-- Create policy to allow insert from service role
CREATE POLICY "Allow insert from service role" ON health_checks
  FOR INSERT
  WITH CHECK (true);

-- Add comment
COMMENT ON TABLE health_checks IS 'Stores health check results for all deployed services';
