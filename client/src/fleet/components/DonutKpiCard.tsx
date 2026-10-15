import React from "react";

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

export interface DonutKpiCardProps {
  title: string;
  total: number;
  segments: DonutSegment[];
  onClick?: () => void;
  icon?: React.ReactNode;
  subtitle?: string;
}

export function DonutKpiCard({
  title,
  total,
  segments,
  onClick,
  icon,
  subtitle,
}: DonutKpiCardProps) {
  const size = 180;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Filter non-zero segments for the chart rendering
  const activeSegments = segments.filter((s) => s.value > 0);
  const sumValues = activeSegments.reduce((acc, s) => acc + s.value, 0);

  let accumulatedPercent = 0;

  return (
    <div
      className="donut-kpi-card"
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "16px",
        padding: "1.25rem 1rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
        cursor: onClick ? "pointer" : "default",
        transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
        position: "relative",
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = "translateY(-3px)";
          e.currentTarget.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.08)";
          e.currentTarget.style.borderColor = "#cbd5e1";
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = "none";
          e.currentTarget.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.04)";
          e.currentTarget.style.borderColor = "#e2e8f0";
        }
      }}
    >
      {/* Card Header */}
      <div
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "0.75rem",
          padding: "0 0.25rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {icon && <span style={{ color: "#475569" }}>{icon}</span>}
          <h3
            style={{
              margin: 0,
              fontSize: "1.1rem",
              fontWeight: 800,
              color: "#1e293b",
            }}
          >
            {title}
          </h3>
        </div>
        {subtitle && (
          <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 500 }}>
            {subtitle}
          </span>
        )}
      </div>

      {/* Donut Visual */}
      <div
        style={{
          position: "relative",
          width: size,
          height: size,
          margin: "0.5rem 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ transform: "rotate(-90deg)", overflow: "visible" }}
        >
          {/* Background track circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
          />

          {/* Value Segments */}
          {sumValues > 0 ? (
            activeSegments.map((segment, idx) => {
              const fraction = segment.value / sumValues;
              const strokeDasharray = `${fraction * circumference} ${circumference * (1 - fraction)}`;
              const strokeDashoffset = -accumulatedPercent * circumference;
              accumulatedPercent += fraction;

              return (
                <circle
                  key={idx}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="transparent"
                  stroke={segment.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  style={{
                    transition: "stroke-dasharray 0.5s ease, stroke-dashoffset 0.5s ease",
                  }}
                />
              );
            })
          ) : (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke="#e2e8f0"
              strokeWidth={strokeWidth}
            />
          )}
        </svg>

        {/* Center Text */}
        <div
          style={{
            position: "absolute",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            pointerEvents: "none",
          }}
        >
          <span
            style={{
              fontSize: "0.82rem",
              fontWeight: 600,
              color: "#64748b",
              marginBottom: "0.15rem",
            }}
          >
            الإجمالي
          </span>
          <span
            style={{
              fontSize: "1.75rem",
              fontWeight: 800,
              color: "#0f172a",
              lineHeight: 1.1,
              fontFeatureSettings: '"tnum"',
            }}
          >
            {total.toLocaleString("en-US")}
          </span>
        </div>
      </div>

      {/* Legend / Breakdown List */}
      <div
        style={{
          width: "100%",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "0.5rem 0.85rem",
          marginTop: "0.75rem",
          paddingTop: "0.75rem",
          borderTop: "1px solid #f1f5f9",
        }}
      >
        {segments.map((segment, idx) => (
          <div
            key={idx}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              fontSize: "0.82rem",
              color: "#334155",
            }}
          >
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: segment.color,
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            <span style={{ fontWeight: 600 }}>{segment.label}</span>
            <span style={{ color: "#64748b", fontWeight: 700 }}>
              ({segment.value.toLocaleString("en-US")})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
