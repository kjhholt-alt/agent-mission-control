import { useMemo } from "react";

interface SparklineProps {
  value: number;
  color?: string;
  width?: number;
  height?: number;
}

/**
 * Simple SVG sparkline that generates a synthetic progression
 * based on the current value. Shows tool usage trend.
 */
export function Sparkline({
  value,
  color = "#a855f7",
  width = 80,
  height = 20,
}: SparklineProps) {
  const points = useMemo(() => {
    // Generate 10 synthetic data points leading to current value
    const dataPoints: number[] = [];
    const steps = 10;

    if (value === 0) {
      // Flat line at 0
      return new Array(steps).fill(0);
    }

    // Create a progression with some variation
    for (let i = 0; i < steps; i++) {
      const progress = i / (steps - 1);
      // Quadratic easing for more natural growth
      const baseValue = value * Math.pow(progress, 1.5);
      // Add small random variation (±10%)
      const variation = baseValue * 0.1 * (Math.sin(i * 2.5) * 0.5);
      dataPoints.push(Math.max(0, baseValue + variation));
    }

    // Ensure last point is exact value
    dataPoints[dataPoints.length - 1] = value;

    return dataPoints;
  }, [value]);

  const path = useMemo(() => {
    if (points.length === 0) return "";

    const max = Math.max(...points, 1);
    const min = Math.min(...points, 0);
    const range = max - min || 1;

    const stepX = width / (points.length - 1);

    const pathData = points
      .map((point, i) => {
        const x = i * stepX;
        // Invert Y because SVG coords go top-down
        const y = height - ((point - min) / range) * height;
        return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");

    return pathData;
  }, [points, width, height]);

  return (
    <svg
      width={width}
      height={height}
      className="inline-block"
      style={{ overflow: "visible" }}
    >
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.8"
      />
    </svg>
  );
}
