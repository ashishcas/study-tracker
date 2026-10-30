'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getSessions, StudySession } from '../lib/db';

interface StudyHeatmapProps {
  filterDays: number; // 30 | 60 | 365
  refreshTrigger: number;
}

interface DayData {
  date: Date;
  dateStr: string;
  durationSeconds: number;
  sessionsCount: number;
  subjectBreakdown: Record<string, number>; // subject -> seconds
}

export default function StudyHeatmap({ filterDays, refreshTrigger }: StudyHeatmapProps) {
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [hoveredDay, setHoveredDay] = useState<DayData | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Load sessions from database
  useEffect(() => {
    setSessions(getSessions());
  }, [refreshTrigger]);

  // Keep heatmap sleek and compact (similar to GitHub's clean 10px contribution grid)
  const { weeks, cellSize, cellGap, labelHeight, labelWidth, weekLabels, dayLabels } = useMemo(() => {
    // Show at least 90 days (13 weeks) for a balanced horizontal aspect ratio
    const displayDays = Math.max(filterDays, 90);

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - displayDays + 1);

    // Align start date to Sunday
    const startDayOfWeek = startDate.getDay();
    const gridStartDate = new Date(startDate);
    gridStartDate.setDate(startDate.getDate() - startDayOfWeek);

    const dayMap = new Map<string, { duration: number; count: number; subjects: Record<string, number> }>();
    
    sessions.forEach(s => {
      if (s.mode !== 'focus') return;
      const compDate = new Date(s.completedAt);
      const dateStr = compDate.toISOString().split('T')[0];
      const current = dayMap.get(dateStr) || { duration: 0, count: 0, subjects: {} };
      current.duration += s.durationSeconds;
      current.count += 1;
      current.subjects[s.subject] = (current.subjects[s.subject] || 0) + s.durationSeconds;
      dayMap.set(dateStr, current);
    });

    const totalDays = Math.ceil((endDate.getTime() - gridStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const days: DayData[] = [];

    for (let i = 0; i < totalDays; i++) {
      const d = new Date(gridStartDate);
      d.setDate(gridStartDate.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const stats = dayMap.get(dateStr) || { duration: 0, count: 0, subjects: {} };

      days.push({
        date: d,
        dateStr,
        durationSeconds: stats.duration,
        sessionsCount: stats.count,
        subjectBreakdown: stats.subjects,
      });
    }

    const weeksList: DayData[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeksList.push(days.slice(i, i + 7));
    }

    // Standard GitHub-style compact cell dimensions
    const cSize = 10;
    const cGap = 2.5;

    // Month Label coordinates
    const wLabels: { text: string; colIndex: number }[] = [];
    let lastMonth = -1;

    weeksList.forEach((week, colIdx) => {
      const firstDayOfMonth = week.find(d => d.date.getDate() === 1 || (d.date.getDate() <= 7 && colIdx === 0));
      if (firstDayOfMonth) {
        const month = firstDayOfMonth.date.getMonth();
        if (month !== lastMonth) {
          const monthText = firstDayOfMonth.date.toLocaleString('default', { month: 'short' });
          wLabels.push({ text: monthText, colIndex: colIdx });
          lastMonth = month;
        }
      }
    });

    const dLabels = ['Sun', '', 'Tue', '', 'Thu', '', 'Sat'];

    return {
      weeks: weeksList,
      cellSize: cSize,
      cellGap: cGap,
      labelHeight: 14,
      labelWidth: 26,
      weekLabels: wLabels,
      dayLabels: dLabels,
    };
  }, [sessions, filterDays]);

  const getIntensityColor = (durationSeconds: number) => {
    const mins = durationSeconds / 60;
    if (mins === 0) return 'var(--color-bg-empty)';
    if (mins <= 25) return 'var(--color-intensity-1)';
    if (mins <= 50) return 'var(--color-intensity-2)';
    if (mins <= 100) return 'var(--color-intensity-3)';
    return 'var(--color-intensity-4)';
  };

  const columnsCount = weeks.length;
  const svgWidth = labelWidth + columnsCount * (cellSize + cellGap);
  const svgHeight = labelHeight + 7 * (cellSize + cellGap);

  const handleMouseEnter = (e: React.MouseEvent<SVGRectElement>, day: DayData) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const containerRect = e.currentTarget.ownerSVGElement?.parentElement?.getBoundingClientRect();
    
    if (containerRect) {
      setTooltipPos({
        x: rect.left - containerRect.left + rect.width / 2,
        y: rect.top - containerRect.top - 8,
      });
      setHoveredDay(day);
    }
  };

  const formatHours = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.round((seconds % 3600) / 60);
    if (hrs === 0) return `${mins}m`;
    if (mins === 0) return `${hrs}h`;
    return `${hrs}h ${mins}m`;
  };

  return (
    <div className="heatmap-container glass-card compact-heatmap-card" suppressHydrationWarning>
      <div className="heatmap-header">
        <div className="heatmap-title-row">
          <span className="compact-dot-icon">●</span>
          <h3 className="compact-heatmap-title">Contribution Map</h3>
        </div>

        <div className="heatmap-legend">
          <span>Less</span>
          <div className="legend-cells">
            <div className="legend-cell" style={{ backgroundColor: 'var(--color-bg-empty)' }} />
            <div className="legend-cell" style={{ backgroundColor: 'var(--color-intensity-1)' }} />
            <div className="legend-cell" style={{ backgroundColor: 'var(--color-intensity-2)' }} />
            <div className="legend-cell" style={{ backgroundColor: 'var(--color-intensity-3)' }} />
            <div className="legend-cell" style={{ backgroundColor: 'var(--color-intensity-4)' }} />
          </div>
          <span>More</span>
        </div>
      </div>

      <div className="heatmap-scroll-wrapper">
        <div className="heatmap-relative-anchor">
          <svg 
            className="heatmap-svg" 
            width={svgWidth} 
            height={svgHeight} 
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            style={{ display: 'block', maxWidth: '100%' }}
          >
            {/* Month Labels */}
            {weekLabels.map((lbl, idx) => {
              const xPos = labelWidth + lbl.colIndex * (cellSize + cellGap);
              return (
                <text 
                  key={idx} 
                  x={xPos} 
                  y={10} 
                  className="heatmap-text font-semibold"
                >
                  {lbl.text}
                </text>
              );
            })}

            {/* Day of week labels */}
            {dayLabels.map((lbl, idx) => {
              if (!lbl) return null;
              const yPos = labelHeight + idx * (cellSize + cellGap) + cellSize / 2 + 1;
              return (
                <text 
                  key={idx} 
                  x={8} 
                  y={yPos} 
                  className="heatmap-text day-label"
                >
                  {lbl}
                </text>
              );
            })}

            {/* Contribution Cells */}
            {weeks.map((week, colIdx) => {
              const xPos = labelWidth + colIdx * (cellSize + cellGap);
              return (
                <g key={colIdx}>
                  {week.map((day, rowIdx) => {
                    const yPos = labelHeight + rowIdx * (cellSize + cellGap);
                    const isFuture = day.date > new Date();
                    
                    return (
                      <rect
                        key={day.dateStr}
                        x={xPos}
                        y={yPos}
                        width={cellSize}
                        height={cellSize}
                        rx={2}
                        ry={2}
                        className={`heatmap-cell ${isFuture ? 'future-cell' : ''}`}
                        style={{
                          fill: isFuture ? 'var(--color-bg-future)' : getIntensityColor(day.durationSeconds),
                          cursor: isFuture ? 'default' : 'pointer',
                        }}
                        onMouseEnter={(e) => !isFuture && handleMouseEnter(e, day)}
                        onMouseLeave={() => setHoveredDay(null)}
                      />
                    );
                  })}
                </g>
              );
            })}
          </svg>

          {/* Floating Tooltip */}
          <AnimatePresence>
            {hoveredDay && (
              <motion.div 
                className="heatmap-tooltip"
                initial={{ opacity: 0, scale: 0.9, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 4 }}
                transition={{ duration: 0.12 }}
                style={{
                  left: `${tooltipPos.x}px`,
                  top: `${tooltipPos.y}px`,
                  transform: 'translate(-50%, -100%)',
                }}
              >
                <div className="tooltip-date font-bold">
                  {new Date(hoveredDay.dateStr).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </div>
                <div className="tooltip-duration">
                  {hoveredDay.durationSeconds > 0 ? (
                    <>
                      Total Studied: <span className="highlight">{formatHours(hoveredDay.durationSeconds)}</span>
                      <span className="tooltip-sessions-count"> ({hoveredDay.sessionsCount} session{hoveredDay.sessionsCount > 1 ? 's' : ''})</span>
                    </>
                  ) : (
                    'No study sessions logged'
                  )}
                </div>
                {Object.keys(hoveredDay.subjectBreakdown).length > 0 && (
                  <div className="tooltip-subjects mt-1">
                    {Object.entries(hoveredDay.subjectBreakdown).map(([sub, sec]) => (
                      <div key={sub} className="tooltip-subject-row text-xs flex justify-between">
                        <span className="sub-name">{sub}:</span>
                        <span className="sub-time font-semibold">{formatHours(sec)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
