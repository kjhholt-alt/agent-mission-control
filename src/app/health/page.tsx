"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface ServiceCheck {
  name: string;
  url: string;
  status: "healthy" | "degraded" | "down";
  response_time_ms: number;
  last_checked: string;
  error?: string;
}

interface HealthCheckResponse {
  overall_status: "healthy" | "warning" | "critical";
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    down: number;
  };
  services: ServiceCheck[];
  checked_at: string;
}

export default function HealthPage() {
  const [healthData, setHealthData] = useState<HealthCheckResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchHealthCheck = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/health-check");
      const data = await response.json();
      setHealthData(data);
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Failed to fetch health check:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthCheck();
    // Auto-refresh every 2 minutes
    const interval = setInterval(fetchHealthCheck, 120000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
      case "degraded":
      case "warning":
        return "text-amber-400 bg-amber-400/10 border-amber-400/20";
      case "down":
      case "critical":
        return "text-red-400 bg-red-400/10 border-red-400/20";
      default:
        return "text-gray-400 bg-gray-400/10 border-gray-400/20";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return "●";
      case "degraded":
      case "warning":
        return "◐";
      case "down":
      case "critical":
        return "○";
      default:
        return "?";
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            Service Health Monitor
          </h1>
          <p className="text-gray-400">
            Real-time status of all BuildKit deployed services
          </p>
        </div>

        {/* Overall Status Card */}
        {healthData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`border rounded-lg p-6 mb-8 ${getStatusColor(
              healthData.overall_status
            )}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm uppercase tracking-wide mb-1">
                  Overall Status
                </div>
                <div className="text-3xl font-bold capitalize flex items-center gap-3">
                  <span className="text-4xl">
                    {getStatusIcon(healthData.overall_status)}
                  </span>
                  {healthData.overall_status}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-400 mb-2">Summary</div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-emerald-400 font-mono text-2xl">
                      {healthData.summary.healthy}
                    </div>
                    <div className="text-gray-500">Healthy</div>
                  </div>
                  <div>
                    <div className="text-amber-400 font-mono text-2xl">
                      {healthData.summary.degraded}
                    </div>
                    <div className="text-gray-500">Degraded</div>
                  </div>
                  <div>
                    <div className="text-red-400 font-mono text-2xl">
                      {healthData.summary.down}
                    </div>
                    <div className="text-gray-500">Down</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Refresh Button */}
        <div className="flex justify-between items-center mb-6">
          <div className="text-sm text-gray-500">
            {lastRefresh && (
              <>Last checked: {lastRefresh.toLocaleTimeString()}</>
            )}
          </div>
          <button
            onClick={fetchHealthCheck}
            disabled={loading}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-700 rounded text-sm font-medium transition-colors"
          >
            {loading ? "Checking..." : "Refresh Now"}
          </button>
        </div>

        {/* Service Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading && !healthData ? (
            <div className="col-span-full text-center py-12 text-gray-500">
              <div className="animate-pulse">Checking services...</div>
            </div>
          ) : (
            healthData?.services.map((service, index) => (
              <motion.div
                key={service.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`border rounded-lg p-6 ${getStatusColor(
                  service.status
                )}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-lg mb-1">{service.name}</h3>
                    <a
                      href={service.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-gray-400 hover:text-cyan-400 transition-colors break-all"
                    >
                      {service.url}
                    </a>
                  </div>
                  <span className="text-3xl">
                    {getStatusIcon(service.status)}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Status</span>
                    <span className="font-medium capitalize">
                      {service.status}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Response Time</span>
                    <span className="font-mono">
                      {service.response_time_ms}ms
                    </span>
                  </div>
                  {service.error && (
                    <div className="mt-3 p-2 bg-red-900/20 border border-red-500/30 rounded text-xs">
                      <div className="text-red-400 font-medium mb-1">Error</div>
                      <div className="text-gray-300 break-all">
                        {service.error}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* Footer Info */}
        <div className="mt-8 p-4 border border-gray-800 rounded-lg bg-gray-900/50">
          <div className="text-sm text-gray-400">
            <strong className="text-gray-300">Health Check Criteria:</strong>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>
                <span className="text-emerald-400">Healthy</span>: HTTP 2xx/3xx,
                response time &lt; 3s
              </li>
              <li>
                <span className="text-amber-400">Degraded</span>: HTTP 4xx or
                response time &gt; 3s
              </li>
              <li>
                <span className="text-red-400">Down</span>: HTTP 5xx or timeout
                (10s)
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
