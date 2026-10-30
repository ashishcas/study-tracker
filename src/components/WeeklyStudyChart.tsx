'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getSessions, StudySession } from '../lib/db';

interface WeeklyStudyChartProps {
  refreshTrigger: number;
}

interface ChartDayData {
  dayName: string;
  fullDateStr: string;
  dateStr: string;
  durationSeconds: number;
  hours: number;
  sessionsCount: number;
}

/**
 * Format duration for the diagram:
 * - If time is less than 1 hour (< 3600s), display in minutes (e.g. 25m, 45m).
 * - If time is greater than or equal to 1 hour (>= 3600s), convert to hours (e.g. 1h, 1h 15m, 2h).
 */
export const formatChartTime = (seconds: number): string => {
  if (seconds <= 0) return '0m';
  const totalMins = Math.round(seconds / 60);
  if (totalMins < 60) {
    return `${totalMins}m`;
  }
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
};

/**
 * Format Y-axis grid labels in diagram:
 * - Display in minutes when under 1 hr (e.g. 20m, 40m).
 * - Display in hours when >= 1 hr (e.g. 1h, 2h, 3h).
 */
const formatAxisLabel = (hoursVal: number): string => {
  if (hoursVal <= 0) return '0m';
  if (hoursVal < 1) {
    const mins = Math.round(hoursVal * 60);
    return `${mins}m`;
  }
  const hrs = Math.floor(hoursVal);
  const mins = Math.round((hoursVal - hrs) * 60);
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
};

export default function WeeklyStudyChart({ refreshTrigger }: WeeklyStudyChartProps) {
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [hoveredBar, setHoveredBar] = useState<ChartDayData | null>(null);
  const [barTooltipPos, setBarTooltipPos] = useState({ x: 0, y: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setSessions(getSessions());

    const handleUpdate = () => {
      setSessions(getSessions());
    };
    window.addEventListener('study-sessions-updated', handleUpdate);
    return () => {
      window.removeEventListener('study-sessions-updated', handleUpdate);
    };
  }, [refreshTrigger]);

  // Compute 7 days of data (ending today)
  const weeklyChartData = useMemo<ChartDayData[]>(() => {
    if (!mounted) return [];

    const focusSessions = sessions.filter(s => s.mode === 'focus');

    // Group sessions by ISO date string (YYYY-MM-DD)
    const dayMap = new Map<string, { duration: number; count: number }>();
    focusSessions.forEach(s => {
      const compDate = new Date(s.completedAt);
      const dateStr = compDate.toISOString().split('T')[0];
      const current = dayMap.get(dateStr) || { duration: 0, count: 0 };
      dayMap.set(dateStr, {
        duration: current.duration + s.durationSeconds,
        count: current.count + 1,
      });
    });

    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const result: ChartDayData[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const isToday = i === 0;
      const dayName = isToday ? 'Today' : dayLabels[d.getDay()];
      const stats = dayMap.get(dateStr) || { duration: 0, count: 0 };

      result.push({
        dayName,
        dateStr,
        fullDateStr: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', weekday: 'short' }),
        durationSeconds: stats.duration,
        hours: stats.duration / 3600,
        sessionsCount: stats.count,
      });
    }

    return result;
  }, [sessions, mounted]);

  // Scale chart max hours
  const chartMaxHours = useMemo(() => {
    if (weeklyChartData.length === 0) return 1;
    const max = Math.max(...weeklyChartData.map(d => d.hours));
    if (max <= 0) return 1;
    if (max <= 1) return 1;
    return Math.ceil(max);
  }, [weeklyChartData]);

  // Total studied this week
  const weeklyTotalSeconds = useMemo(() => {
    return weeklyChartData.reduce((acc, d) => acc + d.durationSeconds, 0);
  }, [weeklyChartData]);

  const handleBarInteraction = (e: React.MouseEvent<SVGRectElement> | React.TouchEvent<SVGRectElement>, day: ChartDayData) => {
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    const containerRect = target.ownerSVGElement?.parentElement?.getBoundingClientRect();
    if (containerRect) {
      setBarTooltipPos({
        x: rect.left - containerRect.left + rect.width / 2,
        y: rect.top - containerRect.top - 8,
      });
      setHoveredBar(day);
    }
  };

  return (
    <motion.div 
      className="chart-card glass-card weekly-study-overview-card"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      suppressHydrationWarning
    >
      <div className="chart-header-row">
        <div className="chart-title-group">
          <motion.div 
            className="chart-icon-badge"
            whileHover={{ scale: 1.08, rotate: 5 }}
            transition={{ type: 'spring', stiffness: 350, damping: 15 }}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
            </svg>
          </motion.div>
          <div>
            <h3 className="chart-title-text">Study Time (Last 7 Days)</h3>
            <p className="chart-subtitle-text">Daily focus trend · Minutes under 1 hr, hours above 1 hr</p>
          </div>
        </div>

        <motion.div 
          className="chart-header-stats"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <span className="chart-week-stat-label">7-Day Total:</span>
          <span className="chart-week-stat-val highlight">{formatChartTime(weeklyTotalSeconds)}</span>
        </motion.div>
      </div>

      <div className="chart-wrapper">
        <svg viewBox="0 0 500 165" className="study-bar-chart" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="weeklyBarGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-focus)" stopOpacity="1" />
              <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.45" />
            </linearGradient>
            <filter id="barGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="glow" />
              <feComposite in="SourceGraphic" in2="glow" operator="over" />
            </filter>
          </defs>

          {/* Horizontal Grid lines */}
          {Array.from({ length: 4 }).map((_, idx) => {
            const val = (chartMaxHours / 3) * idx;
            const yPos = 130 - idx * 32;
            const label = formatAxisLabel(val);
            return (
              <g key={idx}>
                <line 
                  x1="36" 
                  y1={yPos} 
                  x2="484" 
                  y2={yPos} 
                  stroke="rgba(255, 255, 255, 0.06)" 
                  strokeDasharray="3 3" 
                />
                <text 
                  x="30" 
                  y={yPos + 3} 
                  className="chart-text y-axis-label" 
                  textAnchor="end"
                >
                  {label}
                </text>
              </g>
            );
          })}

          {/* Daily Bars with Spring Rise Animation */}
          {weeklyChartData.map((day, idx) => {
            const xPos = 52 + idx * 62;
            const targetHeight = chartMaxHours > 0 ? (day.hours / chartMaxHours) * 96 : 0;
            const targetYPos = 130 - targetHeight;
            const isActive = day.dayName === 'Today';
            const hasData = day.durationSeconds > 0;
            const timeLabel = formatChartTime(day.durationSeconds);

            return (
              <g key={day.dateStr} className="chart-bar-group">
                {/* Touch/hover detector */}
                <rect 
                  x={xPos - 12} 
                  y="10" 
                  width="48" 
                  height="130" 
                  fill="transparent" 
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(e) => handleBarInteraction(e, day)}
                  onMouseLeave={() => setHoveredBar(null)}
                  onTouchStart={(e) => handleBarInteraction(e, day)}
                />

                {/* Ambient glow behind active/filled bars */}
                {targetHeight > 0 && (
                  <motion.rect
                    x={xPos}
                    rx="4"
                    width="24"
                    fill={isActive ? 'var(--color-focus)' : 'var(--color-accent)'}
                    opacity="0.22"
                    style={{ filter: 'blur(4px)' }}
                    initial={{ height: 0, y: 130 }}
                    animate={{ height: targetHeight, y: targetYPos }}
                    transition={{
                      type: 'spring',
                      stiffness: 120,
                      damping: 14,
                      delay: 0.1 + idx * 0.06,
                    }}
                  />
                )}

                {/* Animated Rising Bar */}
                <motion.rect
                  x={xPos}
                  width="24"
                  rx="4"
                  fill={targetHeight > 0 ? 'url(#weeklyBarGradient)' : 'rgba(255, 255, 255, 0.08)'}
                  className={`chart-bar-rect ${isActive ? 'active-today' : ''} ${hasData ? 'has-study-time' : ''}`}
                  initial={{ height: 0, y: 130 }}
                  animate={{ 
                    height: targetHeight > 0 ? targetHeight : 2, 
                    y: targetHeight > 0 ? targetYPos : 128 
                  }}
                  transition={{
                    type: 'spring',
                    stiffness: 120,
                    damping: 14,
                    delay: idx * 0.06,
                  }}
                  whileHover={{ scaleY: 1.03 }}
                  style={{ transformOrigin: 'bottom' }}
                  onMouseEnter={(e) => handleBarInteraction(e, day)}
                  onMouseLeave={() => setHoveredBar(null)}
                  onTouchStart={(e) => handleBarInteraction(e, day)}
                />

                {/* Direct time badge floating above bar */}
                {hasData && (
                  <motion.text
                    x={xPos + 12}
                    y={Math.max(22, targetYPos - 6)}
                    className="chart-text bar-value-label font-bold"
                    textAnchor="middle"
                    initial={{ opacity: 0, y: 130 }}
                    animate={{ opacity: 1, y: Math.max(22, targetYPos - 6) }}
                    transition={{ delay: 0.35 + idx * 0.06, duration: 0.3 }}
                  >
                    {timeLabel}
                  </motion.text>
                )}

                {/* X Axis Day Label */}
                <text 
                  x={xPos + 12} 
                  y="150" 
                  className={`chart-text x-axis-label ${isActive ? 'active-text font-bold' : ''}`} 
                  textAnchor="middle"
                >
                  {day.dayName}
                </text>
              </g>
            );
          })}

          {/* Baseline */}
          <line x1="36" y1="130" x2="484" y2="130" stroke="rgba(255, 255, 255, 0.14)" strokeWidth="1.5" />
        </svg>

        {/* Floating Tooltip with AnimatePresence */}
        <AnimatePresence>
          {hoveredBar && (
            <motion.div 
              className="heatmap-tooltip chart-floating-tooltip"
              initial={{ opacity: 0, scale: 0.88, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.88, y: 6 }}
              transition={{ duration: 0.15 }}
              style={{
                left: `${barTooltipPos.x}px`,
                top: `${barTooltipPos.y}px`,
                transform: 'translate(-50%, -100%)',
                minWidth: '135px',
              }}
            >
              <div className="tooltip-date font-bold">
                {hoveredBar.fullDateStr}
              </div>
              <div className="tooltip-duration">
                Studied:{' '}
                <span className="highlight font-bold">
                  {formatChartTime(hoveredBar.durationSeconds)}
                </span>
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {hoveredBar.sessionsCount > 0 
                  ? `${hoveredBar.sessionsCount} session${hoveredBar.sessionsCount !== 1 ? 's' : ''} completed`
                  : 'No study recorded'}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
