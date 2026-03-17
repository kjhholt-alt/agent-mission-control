"use client";

import { useState } from "react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  TooltipProps,
} from "recharts";
import { formatCost, formatTokens } from "@/lib/pricing";

// Custom tooltip component with formatted data
interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number;
    color?: string;
    dataKey?: string;
  }>;
  label?: string;
  formatter?: (value: number | undefined) => string;
}

function CustomTooltip({ active, payload, label, formatter }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  const formatValue = (value: number | undefined) => {
    if (value === undefined) return "—";
    return formatter ? formatter(value) : value.toFixed(2);
  };

  return (
    <div className="bg-zinc-900 border border-cyan-500/30 rounded-lg p-3 shadow-xl backdrop-blur-sm">
      {label && (
        <p className="text-xs text-zinc-400 mb-1.5 uppercase tracking-wider">
          {label}
        </p>
      )}
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs text-zinc-500">{entry.name}:</span>
          <span className="text-sm font-semibold text-white">
            {formatter ? formatter(entry.value as number) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// Enhanced Area Chart with gradient fills
interface EnhancedAreaChartProps {
  data: any[];
  dataKeys: Array<{ key: string; name: string; color: string }>;
  xKey: string;
  height?: number;
  formatter?: (value: number | undefined) => string;
  showLegend?: boolean;
}

export function EnhancedAreaChart({
  data,
  dataKeys,
  xKey,
  height = 300,
  formatter,
  showLegend = true,
}: EnhancedAreaChartProps) {
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

  const toggleSeries = (key: string) => {
    setHiddenSeries((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart
          data={data}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <defs>
            {dataKeys.map(({ key, color }) => (
              <linearGradient key={key} id={`gradient-${key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0.05} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.5} />
          <XAxis
            dataKey={xKey}
            stroke="#71717a"
            style={{ fontSize: "11px" }}
            tick={{ fill: "#71717a" }}
          />
          <YAxis
            stroke="#71717a"
            style={{ fontSize: "11px" }}
            tick={{ fill: "#71717a" }}
          />
          <Tooltip content={<CustomTooltip formatter={formatter} />} />
          {showLegend && (
            <Legend
              wrapperStyle={{ fontSize: "12px" }}
              onClick={(e) => toggleSeries(e.dataKey as string)}
              iconType="circle"
            />
          )}
          {dataKeys.map(({ key, name, color }) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              name={name}
              stroke={color}
              strokeWidth={2}
              fill={`url(#gradient-${key})`}
              animationDuration={1000}
              animationEasing="ease-out"
              hide={hiddenSeries.has(key)}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>

      {/* Custom legend with toggle */}
      {showLegend && (
        <div className="flex flex-wrap items-center gap-3 mt-3 px-4">
          {dataKeys.map(({ key, name, color }) => (
            <button
              key={key}
              onClick={() => toggleSeries(key)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-opacity ${
                hiddenSeries.has(key) ? "opacity-40" : "opacity-100"
              }`}
            >
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-zinc-400">{name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Enhanced Line Chart
interface EnhancedLineChartProps {
  data: any[];
  dataKeys: Array<{ key: string; name: string; color: string }>;
  xKey: string;
  height?: number;
  formatter?: (value: number | undefined) => string;
  showLegend?: boolean;
}

export function EnhancedLineChart({
  data,
  dataKeys,
  xKey,
  height = 300,
  formatter,
  showLegend = true,
}: EnhancedLineChartProps) {
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

  const toggleSeries = (key: string) => {
    setHiddenSeries((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={data}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.5} />
          <XAxis
            dataKey={xKey}
            stroke="#71717a"
            style={{ fontSize: "11px" }}
            tick={{ fill: "#71717a" }}
          />
          <YAxis
            stroke="#71717a"
            style={{ fontSize: "11px" }}
            tick={{ fill: "#71717a" }}
          />
          <Tooltip content={<CustomTooltip formatter={formatter} />} />
          {showLegend && (
            <Legend
              wrapperStyle={{ fontSize: "12px" }}
              onClick={(e) => toggleSeries(e.dataKey as string)}
              iconType="circle"
            />
          )}
          {dataKeys.map(({ key, name, color }) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              name={name}
              stroke={color}
              strokeWidth={2}
              dot={{ fill: color, r: 4 }}
              activeDot={{ r: 6 }}
              animationDuration={1000}
              animationEasing="ease-out"
              hide={hiddenSeries.has(key)}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {/* Custom legend with toggle */}
      {showLegend && (
        <div className="flex flex-wrap items-center gap-3 mt-3 px-4">
          {dataKeys.map(({ key, name, color }) => (
            <button
              key={key}
              onClick={() => toggleSeries(key)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-opacity ${
                hiddenSeries.has(key) ? "opacity-40" : "opacity-100"
              }`}
            >
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-zinc-400">{name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Enhanced Bar Chart
interface EnhancedBarChartProps {
  data: any[];
  dataKeys: Array<{ key: string; name: string; color: string }>;
  xKey: string;
  height?: number;
  formatter?: (value: number | undefined) => string;
  showLegend?: boolean;
  stacked?: boolean;
}

export function EnhancedBarChart({
  data,
  dataKeys,
  xKey,
  height = 300,
  formatter,
  showLegend = true,
  stacked = false,
}: EnhancedBarChartProps) {
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

  const toggleSeries = (key: string) => {
    setHiddenSeries((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <defs>
            {dataKeys.map(({ key, color }) => (
              <linearGradient key={key} id={`bar-gradient-${key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.9} />
                <stop offset="95%" stopColor={color} stopOpacity={0.6} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.5} />
          <XAxis
            dataKey={xKey}
            stroke="#71717a"
            style={{ fontSize: "11px" }}
            tick={{ fill: "#71717a" }}
          />
          <YAxis
            stroke="#71717a"
            style={{ fontSize: "11px" }}
            tick={{ fill: "#71717a" }}
          />
          <Tooltip content={<CustomTooltip formatter={formatter} />} />
          {showLegend && (
            <Legend
              wrapperStyle={{ fontSize: "12px" }}
              onClick={(e) => toggleSeries(e.dataKey as string)}
              iconType="square"
            />
          )}
          {dataKeys.map(({ key, name, color }) => (
            <Bar
              key={key}
              dataKey={key}
              name={name}
              fill={`url(#bar-gradient-${key})`}
              radius={[4, 4, 0, 0]}
              animationDuration={1000}
              animationEasing="ease-out"
              hide={hiddenSeries.has(key)}
              stackId={stacked ? "stack" : undefined}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>

      {/* Custom legend with toggle */}
      {showLegend && (
        <div className="flex flex-wrap items-center gap-3 mt-3 px-4">
          {dataKeys.map(({ key, name, color }) => (
            <button
              key={key}
              onClick={() => toggleSeries(key)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-opacity ${
                hiddenSeries.has(key) ? "opacity-40" : "opacity-100"
              }`}
            >
              <div
                className="w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: color }}
              />
              <span className="text-zinc-400">{name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Enhanced Pie Chart
interface EnhancedPieChartProps {
  data: Array<{ name: string; value: number }>;
  colors: string[];
  height?: number;
  formatter?: (value: number | undefined) => string;
  showLegend?: boolean;
}

export function EnhancedPieChart({
  data,
  colors,
  height = 300,
  formatter,
  showLegend = true,
}: EnhancedPieChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const onPieEnter = (_: any, index: number) => {
    setActiveIndex(index);
  };

  const onPieLeave = () => {
    setActiveIndex(null);
  };

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
            animationDuration={1000}
            animationEasing="ease-out"
            onMouseEnter={onPieEnter}
            onMouseLeave={onPieLeave}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={colors[index % colors.length]}
                opacity={activeIndex === null || activeIndex === index ? 1 : 0.4}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip formatter={formatter} />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Custom legend */}
      {showLegend && (
        <div className="flex flex-wrap items-center justify-center gap-3 mt-3">
          {data.map((entry, index) => {
            const value = formatter ? formatter(entry.value) : entry.value;
            return (
              <div
                key={index}
                className="flex items-center gap-1.5 px-2 py-1 rounded text-xs"
              >
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: colors[index % colors.length] }}
                />
                <span className="text-zinc-400">{entry.name}:</span>
                <span className="text-white font-semibold">{value}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Export all for convenience
export { formatCost, formatTokens };
