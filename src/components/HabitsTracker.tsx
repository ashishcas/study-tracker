'use client';

import React, { useState, useEffect } from 'react';
import { 
  StudyHabit, 
  getHabits, 
  saveHabit, 
  toggleHabitDate, 
  deleteHabit, 
  calculateHabitStreak 
} from '../lib/db';

export default function HabitsTracker() {
  const [habits, setHabits] = useState<StudyHabit[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [categoryInput, setCategoryInput] = useState('Study');
  const [targetDays, setTargetDays] = useState(5);
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week, -1 = last week

  const loadHabits = () => {
    setHabits(getHabits());
  };

  useEffect(() => {
    loadHabits();
    window.addEventListener('study-habits-updated', loadHabits);
    return () => {
      window.removeEventListener('study-habits-updated', loadHabits);
    };
  }, []);

  // Compute Monday through Sunday days for selected week
  const getWeekDays = (offset: number) => {
    const ref = new Date();
    ref.setDate(ref.getDate() + offset * 7);

    const day = ref.getDay();
    // Monday is index 1, Sunday is 0
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    const monday = new Date(ref);
    monday.setDate(ref.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const days = [];
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      days.push({
        date: d,
        dateKey,
        dayName: dayNames[i],
        dayNum: d.getDate(),
        monthName: d.toLocaleDateString(undefined, { month: 'short' }),
        isToday: dateKey === todayStr,
      });
    }
    return days;
  };

  const weekDays = getWeekDays(weekOffset);
  const weekStart = weekDays[0];
  const weekEnd = weekDays[6];

  const handleCreateHabit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titleInput.trim()) return;

    saveHabit({
      title: titleInput.trim(),
      category: categoryInput.trim() || 'General',
      targetDaysPerWeek: targetDays,
    });

    setTitleInput('');
    setShowAddForm(false);
  };

  const handleToggle = (habitId: string, dateKey: string) => {
    toggleHabitDate(habitId, dateKey);
  };

  // Compute overall completion stats for this week
  const totalSlots = habits.length * 7;
  let completedSlots = 0;
  habits.forEach(h => {
    weekDays.forEach(d => {
      if (h.history[d.dateKey]) {
        completedSlots++;
      }
    });
  });

  const completionPercent = totalSlots > 0 ? Math.round((completedSlots / totalSlots) * 100) : 0;

  return (
    <div className="habits-tracker-card glass-card">
      {/* Header */}
      <div className="habits-header">
        <div className="habits-title-group">
          <div className="habits-icon-badge">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h2 className="habits-title">Weekly Habits Tracker</h2>
            <p className="habits-subtitle">
              Build daily consistency & track streaks (Inspired by StudiesTimer)
            </p>
          </div>
        </div>

        <div className="habits-header-controls">
          <div className="week-nav">
            <button 
              type="button" 
              className="btn-icon" 
              onClick={() => setWeekOffset(prev => prev - 1)}
              title="Previous Week"
            >
              ‹
            </button>
            <span className="week-label">
              {weekStart.monthName} {weekStart.dayNum} - {weekEnd.monthName} {weekEnd.dayNum}
              {weekOffset === 0 && <span className="current-week-tag">This Week</span>}
            </span>
            <button 
              type="button" 
              className="btn-icon" 
              onClick={() => setWeekOffset(prev => prev + 1)}
              title="Next Week"
            >
              ›
            </button>
          </div>

          <button 
            type="button" 
            className="btn btn-secondary btn-sm"
            onClick={() => setShowAddForm(prev => !prev)}
          >
            {showAddForm ? '✕ Close' : '+ Add Habit'}
          </button>
        </div>
      </div>

      {/* Weekly Completion Banner */}
      <div className="habits-summary-banner">
        <div className="summary-stat">
          <span className="stat-label">Weekly Progress</span>
          <div className="progress-bar-wrap">
            <div className="progress-bar-fill" style={{ width: `${completionPercent}%` }} />
          </div>
          <span className="stat-percent">{completionPercent}%</span>
        </div>

        <div className="summary-badges">
          <div className="summary-pill">
            <span className="pill-num">{habits.length}</span> Active Habits
          </div>
          <div className="summary-pill highlight">
            <span className="pill-num">{completedSlots}</span> Checks Completed
          </div>
        </div>
      </div>

      {/* Add Habit Form */}
      {showAddForm && (
        <form onSubmit={handleCreateHabit} className="habit-add-form animate-fade-in">
          <div className="habit-form-row">
            <input 
              type="text" 
              placeholder="Habit title (e.g. Read 20 pages, Math practice, Revise flashcards)..."
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              className="habit-title-input"
              autoFocus
              required
            />
          </div>

          <div className="habit-form-meta">
            <div className="habit-field">
              <label>Category</label>
              <input 
                type="text" 
                placeholder="Study, Reading, Focus..."
                value={categoryInput}
                onChange={(e) => setCategoryInput(e.target.value)}
                className="habit-meta-input"
              />
            </div>

            <div className="habit-field">
              <label>Target Days / Week</label>
              <select 
                value={targetDays} 
                onChange={(e) => setTargetDays(Number(e.target.value))}
                className="habit-meta-input"
              >
                {[1, 2, 3, 4, 5, 6, 7].map(num => (
                  <option key={num} value={num}>{num} days / week</option>
                ))}
              </select>
            </div>

            <div className="habit-form-submit">
              <button type="submit" className="btn btn-primary btn-sm">
                Save Habit
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Habits Table / Grid */}
      <div className="habits-table-wrapper">
        <div className="habits-table">
          {/* Header row */}
          <div className="habits-grid-row header-row">
            <div className="col-habit-name">Habit</div>
            <div className="col-days-container">
              {weekDays.map(d => (
                <div key={d.dateKey} className={`day-col-header ${d.isToday ? 'is-today' : ''}`}>
                  <span className="day-name">{d.dayName}</span>
                  <span className="day-number">{d.dayNum}</span>
                </div>
              ))}
            </div>
            <div className="col-habit-stats">Streak</div>
            <div className="col-habit-action"></div>
          </div>

          {/* Habit rows */}
          {habits.length === 0 ? (
            <div className="habits-empty-state">
              <p>No habits tracked yet. Click "+ Add Habit" to build your daily study routine!</p>
            </div>
          ) : (
            habits.map(habit => {
              const streak = calculateHabitStreak(habit);
              let weekCheckedCount = 0;
              weekDays.forEach(d => {
                if (habit.history[d.dateKey]) weekCheckedCount++;
              });

              return (
                <div key={habit.id} className="habits-grid-row">
                  {/* Habit info */}
                  <div className="col-habit-name">
                    <span className="habit-name-text">{habit.title}</span>
                    <div className="habit-sub-tags">
                      <span className="habit-cat-tag">{habit.category}</span>
                      <span className="habit-target-tag">
                        {weekCheckedCount}/{habit.targetDaysPerWeek}d
                      </span>
                    </div>
                  </div>

                  {/* Day Checkboxes */}
                  <div className="col-days-container">
                    {weekDays.map(d => {
                      const isChecked = !!habit.history[d.dateKey];
                      return (
                        <div key={d.dateKey} className="day-checkbox-wrapper">
                          <button
                            type="button"
                            className={`habit-check-btn ${isChecked ? 'checked' : ''} ${d.isToday ? 'today-highlight' : ''}`}
                            onClick={() => handleToggle(habit.id, d.dateKey)}
                            title={`${habit.title} on ${d.dayName} (${d.dateKey})`}
                          >
                            {isChecked ? (
                              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                            ) : (
                              <span className="empty-dot" />
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Streak */}
                  <div className="col-habit-stats">
                    <span className={`streak-badge ${streak > 0 ? 'active' : ''}`}>
                      🔥 {streak} {streak === 1 ? 'day' : 'days'}
                    </span>
                  </div>

                  {/* Delete */}
                  <div className="col-habit-action">
                    <button 
                      type="button" 
                      className="btn-delete-habit"
                      onClick={() => deleteHabit(habit.id)}
                      title="Delete habit"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
