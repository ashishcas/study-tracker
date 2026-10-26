'use client';

import React, { useState, useRef } from 'react';
import PomodoroTimer from '../components/PomodoroTimer';
import TaskList from '../components/TaskList';
import HabitsTracker from '../components/HabitsTracker';
import StudyHeatmap from '../components/StudyHeatmap';
import StatsDashboard from '../components/StatsDashboard';
import BackupPanel from '../components/BackupPanel';

export default function Home() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [filterDays, setFilterDays] = useState<number>(30); // Default to Last 30 Days (1 Month)
  const detailsRef = useRef<HTMLDivElement>(null);

  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const scrollToDetails = () => {
    detailsRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="study-app-wrapper">
      {/* Sleek Minimal Top Navigation Bar */}
      <header className="sleek-top-navbar">
        <div className="nav-left">
          <div className="brand-icon">
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-3.75V6z" clipRule="evenodd" />
            </svg>
          </div>
          <span className="brand-title">Studies<span className="brand-accent">Timer</span></span>
          <span className="nav-chip">Aesthetic Focus</span>
        </div>

        <nav className="nav-right">
          <button 
            type="button" 
            className="nav-link-btn" 
            onClick={scrollToDetails}
          >
            Tasks & Habits
          </button>
          <button 
            type="button" 
            className="nav-link-btn" 
            onClick={scrollToDetails}
          >
            Analytics
          </button>
        </nav>
      </header>

      {/* Main Full-Height Hero Section: Almost Entire Screen */}
      <section className="hero-screen-section">
        <PomodoroTimer 
          onSessionLogged={triggerRefresh} 
          onScrollToDetails={scrollToDetails} 
        />
      </section>

      {/* Secondary Dashboard Sections (Smoothly visible on scroll) */}
      <div id="study-details" ref={detailsRef} className="dashboard-content-container">
        {/* Row 1: Study Tasks + Weekly Habits Tracker */}
        <div className="productivity-suite-grid">
          {/* Integrated Study Tasks / To-Do List */}
          <TaskList />

          {/* Weekly Habits Tracker */}
          <HabitsTracker />
        </div>

        {/* Row 2: Analytics & Session History Dashboard */}
        <StatsDashboard 
          filterDays={filterDays} 
          setFilterDays={setFilterDays} 
          refreshTrigger={refreshTrigger}
          onSessionDeleted={triggerRefresh}
        />

        {/* Row 3: Visual Contribution Heatmap */}
        <StudyHeatmap filterDays={filterDays} refreshTrigger={refreshTrigger} />

        {/* Row 4: Backup & Data Management */}
        <BackupPanel onBackupImported={triggerRefresh} />
      </div>
    </div>
  );
}
