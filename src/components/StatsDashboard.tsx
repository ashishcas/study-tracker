'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  getSessions, 
  deleteSession, 
  StudySession, 
  getSubjects, 
  saveSubject, 
  deleteSubject,
  calculateAnalyticsSummary
} from '../lib/db';

interface StatsDashboardProps {
  filterDays: number;
  setFilterDays: (days: number) => void;
  refreshTrigger: number;
  onSessionDeleted: () => void;
}

interface ChartDayData {
  dayName: string;
  dateStr: string;
  hours: number;
  sessionsCount: number;
}

export default function StatsDashboard({
  filterDays,
  setFilterDays,
  refreshTrigger,
  onSessionDeleted,
}: StatsDashboardProps) {
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [subjectsList, setSubjectsList] = useState<string[]>([]);
  const [newSubjectInput, setNewSubjectInput] = useState('');
  const [hoveredBar, setHoveredBar] = useState<ChartDayData | null>(null);
  const [barTooltipPos, setBarTooltipPos] = useState({ x: 0, y: 0 });

  // Load study logs and subjects
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSessions(getSessions());
    setSubjectsList(getSubjects());

    const handleSubjectsUpdate = () => {
      setSubjectsList(getSubjects());
    };
    window.addEventListener('study-subjects-updated', handleSubjectsUpdate);
    return () => {
      window.removeEventListener('study-subjects-updated', handleSubjectsUpdate);
    };
  }, [refreshTrigger]);

  // Filter sessions by the selected range
  const filteredSessions = useMemo(() => {
    if (filterDays === 365) return sessions;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - filterDays);
    const cutoffTime = cutoffDate.getTime();

    return sessions.filter(s => new Date(s.completedAt).getTime() >= cutoffTime);
  }, [sessions, filterDays]);

  // Calculate statistics
  const stats = useMemo(() => {
    const focusSessions = filteredSessions.filter(s => s.mode === 'focus');
    const totalSecs = focusSessions.reduce((acc, s) => acc + s.durationSeconds, 0);
    const totalHours = (totalSecs / 3600).toFixed(1);
    const totalCount = focusSessions.length;

    // Calculate subject-specific breakdown
    const subjectMap: Record<string, number> = {};
    focusSessions.forEach(s => {
      subjectMap[s.subject] = (subjectMap[s.subject] || 0) + s.durationSeconds;
    });

    const subjectBreakdown = Object.entries(subjectMap)
      .map(([subject, seconds]) => ({
        subject,
        seconds,
        percent: totalSecs > 0 ? Math.round((seconds / totalSecs) * 100) : 0,
      }))
      .sort((a, b) => b.seconds - a.seconds);

    // Calculate current daily streak (using all sessions to preserve streak history)
    const allFocusSessions = sessions.filter(s => s.mode === 'focus');
    const uniqueDates = Array.from(
      new Set(
        allFocusSessions.map(s => {
          const d = new Date(s.completedAt);
          return d.toLocaleDateString(); // Group by calendar date
        })
      )
    ).map(d => new Date(d));

    // Sort dates descending
    uniqueDates.sort((a, b) => b.getTime() - a.getTime());

    let currentStreak = 0;
    if (uniqueDates.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);

      const firstDate = new Date(uniqueDates[0]);
      firstDate.setHours(0, 0, 0, 0);

      // Check if user has studied today or yesterday
      if (firstDate.getTime() === today.getTime() || firstDate.getTime() === yesterday.getTime()) {
        currentStreak = 1;
        let lastDate = firstDate;

        for (let i = 1; i < uniqueDates.length; i++) {
          const checkDate = new Date(uniqueDates[i]);
          checkDate.setHours(0, 0, 0, 0);

          const expectedPrevDate = new Date(lastDate);
          expectedPrevDate.setDate(lastDate.getDate() - 1);

          if (checkDate.getTime() === expectedPrevDate.getTime()) {
            currentStreak++;
            lastDate = checkDate;
          } else if (checkDate.getTime() === lastDate.getTime()) {
            // Same day, continue
            continue;
          } else {
            // Gap in dates, streak is broken
            break;
          }
        }
      }
    }

    return {
      totalHours,
      totalCount,
      currentStreak,
      subjectBreakdown,
    };
  }, [sessions, filteredSessions]);

  // Calculate study hours for the last 7 days (Daily Study Hours Graph)
  const weeklyChartData = useMemo<ChartDayData[]>(() => {
    const focusSessions = sessions.filter(s => s.mode === 'focus');
    
    // Group sessions by ISO date string (YYYY-MM-DD)
    const dayMap = new Map<string, { duration: number; count: number }>();
    focusSessions.forEach(s => {
      const compDate = new Date(s.completedAt);
      const dateStr = compDate.toISOString().split('T')[0];
      const current = dayMap.get(dateStr) || { duration: 0, count: 0 };
      dayMap.set(dateStr, {
        duration: current.duration + s.durationSeconds,
        count: current.count + 1
      });
    });

    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const result: ChartDayData[] = [];

    // Generate last 7 days details (ending today)
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = d.getDay() === new Date().getDay() ? 'Today' : dayLabels[d.getDay()];
      const stats = dayMap.get(dateStr) || { duration: 0, count: 0 };
      
      result.push({
        dayName,
        dateStr,
        hours: parseFloat((stats.duration / 3600).toFixed(2)),
        sessionsCount: stats.count
      });
    }

    return result;
  }, [sessions]);

  // Find max hours in chart to compute relative SVG heights
  const chartMaxHours = useMemo(() => {
    const max = Math.max(...weeklyChartData.map(d => d.hours));
    return max > 0 ? Math.ceil(max) : 3; // Ensure at least scale of 3 hours
  }, [weeklyChartData]);

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this study session?')) {
      deleteSession(id);
      onSessionDeleted();
    }
  };

  const handleCreateSubject = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newSubjectInput.trim();
    if (trimmed !== '') {
      saveSubject(trimmed);
      setNewSubjectInput('');
    }
  };

  const handleDeleteSubject = (sub: string) => {
    if (sub === 'General') return;
    if (confirm(`Are you sure you want to delete the subject "${sub}"? This will not delete your logged sessions, but will remove it from the timer selector list.`)) {
      deleteSubject(sub);
    }
  };

  const formatHours = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.round((seconds % 3600) / 60);
    if (hrs === 0) return `${mins}m`;
    return `${hrs}h ${mins}m`;
  };

  const getFilterLabel = () => {
    if (filterDays === 30) return 'Last Month';
    if (filterDays === 60) return 'Last 2 Months';
    return 'All Time';
  };

  const handleBarMouseEnter = (e: React.MouseEvent<SVGRectElement>, day: ChartDayData) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const containerRect = e.currentTarget.ownerSVGElement?.parentElement?.getBoundingClientRect();
    if (containerRect) {
      setBarTooltipPos({
        x: rect.left - containerRect.left + rect.width / 2,
        y: rect.top - containerRect.top - 8,
      });
      setHoveredBar(day);
    }
  };

  return (
    <div className="stats-dashboard-wrapper">
      {/* Top Filter Bar */}
      <div className="stats-filter-bar glass-card">
        <div className="filter-title-group">
          <span className="filter-title font-semibold">Stats Window:</span>
          <span className="dexie-status-pill">
            <span className="dexie-dot">●</span> Dexie IndexedDB
          </span>
        </div>
        <div className="filter-buttons">
          <button 
            className={filterDays === 30 ? 'active' : ''} 
            onClick={() => setFilterDays(30)}
          >
            Last 30 Days
          </button>
          <button 
            className={filterDays === 60 ? 'active' : ''} 
            onClick={() => setFilterDays(60)}
          >
            Last 60 Days
          </button>
          <button 
            className={filterDays === 365 ? 'active' : ''} 
            onClick={() => setFilterDays(365)}
          >
            All Time
          </button>
        </div>
      </div>

      {/* Numerical Stats Cards - 4 Column Layout powered by Dexie */}
      <div className="stats-cards-grid four-cards">
        <div className="stat-card glass-card">
          <div className="stat-icon">
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.totalHours} hrs</span>
            <span className="stat-label">Studied ({getFilterLabel()})</span>
          </div>
        </div>

        <div className="stat-card glass-card">
          <div className="stat-icon">
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5m.75-9 3-3 2.14 2.14a1.5 1.5 0 0 0 2.12 0l3.74-3.74" />
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">{calculateAnalyticsSummary(filterDays).dailyAverageMinutes}m</span>
            <span className="stat-label">Daily Average Focus</span>
          </div>
        </div>

        <div className="stat-card glass-card">
          <div className="stat-icon">
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-value text-sm">{calculateAnalyticsSummary(filterDays).peakStudyHour}</span>
            <span className="stat-label">Peak Focus Window</span>
          </div>
        </div>

        <div className="stat-card glass-card">
          <div className="stat-icon streak-icon">
            <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M12.969 2.138a.75.75 0 0 0-1.214-.53l-5.85 5.566a.75.75 0 0 0 .28 1.258h4.498v5.541A.75.75 0 0 0 11.897 15l5.85-5.566a.75.75 0 0 0-.28-1.258h-4.498V2.138ZM5.23 15.352a.75.75 0 0 1 .843.435 6.75 6.75 0 0 0 12.355-3.037.75.75 0 1 1 1.488.19A8.25 8.25 0 0 1 4.795 16.19a.75.75 0 0 1 .435-.838Z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.currentStreak} days</span>
            <span className="stat-label">Current Streak 🔥</span>
          </div>
        </div>
      </div>

      {/* NEW: SVG Daily Study Hours Graph (7-Day Overview) */}
      <div className="chart-card glass-card">
        <h3 className="chart-title">Study Hours (Last 7 Days)</h3>
        <div className="chart-wrapper">
          <svg viewBox="0 0 500 160" className="study-bar-chart">
            <defs>
              <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-focus)" stopOpacity="1" />
                <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.45" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid lines */}
            {Array.from({ length: 4 }).map((_, idx) => {
              const val = Math.round((chartMaxHours / 3) * idx * 100) / 100;
              const yPos = 130 - (idx * 30);
              return (
                <g key={idx}>
                  <line x1="30" y1={yPos} x2="480" y2={yPos} stroke="rgba(255, 255, 255, 0.05)" strokeDasharray="3 3" />
                  <text x="22" y={yPos + 3} className="chart-text y-axis-label" textAnchor="end">{val}h</text>
                </g>
              );
            })}

            {/* Daily Bars */}
            {weeklyChartData.map((day, idx) => {
              const xPos = 45 + idx * 62;
              const height = chartMaxHours > 0 ? (day.hours / chartMaxHours) * 90 : 0;
              const yPos = 130 - height;
              const isActive = day.dayName === 'Today';

              return (
                <g key={day.dateStr}>
                  {/* Invisible broad hover detector */}
                  <rect 
                    x={xPos - 10} 
                    y="10" 
                    width="44" 
                    height="130" 
                    fill="transparent" 
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={(e) => handleBarMouseEnter(e, day)}
                    onMouseLeave={() => setHoveredBar(null)}
                  />
                  {/* Glowing background for active bar */}
                  {height > 0 && (
                    <rect
                      x={xPos}
                      y={yPos}
                      width="24"
                      height={height}
                      rx="4"
                      fill={isActive ? 'var(--color-focus)' : 'transparent'}
                      opacity="0.15"
                      style={{ filter: 'blur(4px)' }}
                    />
                  )}
                  {/* Main Gradient Bar */}
                  <rect
                    x={xPos}
                    y={yPos}
                    width="24"
                    height={height > 0 ? height : 2} // Small sliver for 0 hours
                    rx="4"
                    fill={height > 0 ? 'url(#barGradient)' : 'rgba(255, 255, 255, 0.1)'}
                    className={`chart-bar-rect ${isActive ? 'active-today' : ''}`}
                    onMouseEnter={(e) => handleBarMouseEnter(e, day)}
                    onMouseLeave={() => setHoveredBar(null)}
                  />
                  {/* X Axis label */}
                  <text 
                    x={xPos + 12} 
                    y="148" 
                    className={`chart-text x-axis-label ${isActive ? 'active-text font-bold' : ''}`} 
                    textAnchor="middle"
                  >
                    {day.dayName}
                  </text>
                </g>
              );
            })}
            <line x1="30" y1="130" x2="480" y2="130" stroke="rgba(255, 255, 255, 0.12)" />
          </svg>

          {/* Bar Chart Floating Tooltip */}
          {hoveredBar && (
            <div 
              className="heatmap-tooltip"
              style={{
                left: `${barTooltipPos.x}px`,
                top: `${barTooltipPos.y}px`,
                transform: 'translate(-50%, -100%)',
                minWidth: '130px'
              }}
            >
              <div className="tooltip-date font-bold">{hoveredBar.dayName === 'Today' ? 'Today' : new Date(hoveredBar.dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
              <div className="tooltip-duration">
                Studied: <span className="highlight">{hoveredBar.hours}h</span>
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {hoveredBar.sessionsCount} session{hoveredBar.sessionsCount !== 1 ? 's' : ''} completed
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Secondary Row: Subjects & Recent Logs */}
      <div className="stats-details-row">
        {/* Subject distribution */}
        <div className="subjects-distribution glass-card">
          <h3>Subject Breakdown</h3>
          {stats.subjectBreakdown.length > 0 ? (
            <div className="subjects-list">
              {stats.subjectBreakdown.map(item => (
                <div key={item.subject} className="subject-bar-row">
                  <div className="subject-bar-header">
                    <span className="subject-name font-semibold">{item.subject}</span>
                    <span className="subject-time">{formatHours(item.seconds)} ({item.percent}%)</span>
                  </div>
                  <div className="subject-progress-bg">
                    <div 
                      className="subject-progress-bar" 
                      style={{ width: `${item.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-data-msg">No subject logs logged yet. Complete a Pomodoro!</div>
          )}

          {/* NEW: Subject Manager panel */}
          <div className="subject-manager-panel">
            <h4>Manage Subjects</h4>
            <form onSubmit={handleCreateSubject} className="add-subject-form-dashboard">
              <input 
                type="text" 
                placeholder="Add custom subject..." 
                value={newSubjectInput}
                onChange={(e) => setNewSubjectInput(e.target.value)}
                className="subject-input-dashboard"
                required
              />
              <button type="submit" className="btn btn-secondary btn-add-sub-dash">Add</button>
            </form>

            <div className="subject-tags-list">
              {subjectsList.map(sub => (
                <div key={sub} className="subject-tag font-semibold">
                  <span>{sub}</span>
                  {sub !== 'General' && (
                    <button 
                      type="button" 
                      onClick={() => handleDeleteSubject(sub)}
                      className="btn-delete-subject-tag"
                      title={`Delete subject "${sub}"`}
                    >
                      &times;
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Session Logs */}
        <div className="recent-logs glass-card">
          <h3>Recent Focus Logs</h3>
          {filteredSessions.length > 0 ? (
            <div className="logs-scroll">
              <table className="logs-table">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Time Completed</th>
                    <th>Mins</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSessions.slice(0, 8).map(s => {
                    const timeStr = new Date(s.completedAt).toLocaleTimeString(undefined, {
                      hour: '2-digit',
                      minute: '2-digit'
                    });
                    const dateStr = new Date(s.completedAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric'
                    });
                    
                    return (
                      <tr key={s.id}>
                        <td className="log-subject font-semibold">{s.subject}</td>
                        <td className="log-time">{dateStr}, {timeStr}</td>
                        <td className="log-duration">{Math.round(s.durationSeconds / 60)}m</td>
                        <td>
                          <button 
                            className="btn-delete-log"
                            onClick={() => handleDelete(s.id)}
                            title="Delete log"
                          >
                            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="no-data-msg">No logs found in this time range.</div>
          )}
        </div>
      </div>
    </div>
  );
}
