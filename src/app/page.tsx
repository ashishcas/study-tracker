'use client';

import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import PomodoroTimer from '../components/PomodoroTimer';
import WeeklyStudyChart from '../components/WeeklyStudyChart';
import TaskList from '../components/TaskList';
import HabitsTracker from '../components/HabitsTracker';
import StatsDashboard from '../components/StatsDashboard';
import StudyHeatmap from '../components/StudyHeatmap';
import BackupPanel from '../components/BackupPanel';

export default function Home() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [filterDays, setFilterDays] = useState<number>(30); // Default to Last 30 Days (1 Month)
  const detailsRef = useRef<HTMLDivElement>(null);
  const habitsRef = useRef<HTMLDivElement>(null);
  const analyticsRef = useRef<HTMLDivElement>(null);

  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const scrollToDetails = () => {
    detailsRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToHabits = () => {
    habitsRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToAnalytics = () => {
    analyticsRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <main className="study-app-wrapper" id="main-content">
      {/* Sleek Minimal Top Navigation Bar */}
      <motion.header 
        className="sleek-top-navbar"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <div className="nav-left">
          <motion.div 
            className="brand-icon"
            whileHover={{ scale: 1.1, rotate: -8 }}
            whileTap={{ scale: 0.95 }}
          >
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-3.75V6z" clipRule="evenodd" />
            </svg>
          </motion.div>
          <h1 className="brand-title">Studies<span className="brand-accent">Timer</span></h1>
          <span className="nav-chip">Aesthetic Focus</span>
        </div>

        <nav className="nav-right">
          <motion.button 
            type="button" 
            className="nav-link-btn" 
            onClick={scrollToDetails}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
          >
            <span className="nav-text-desktop">Study Overview</span>
            <span className="nav-text-mobile">Overview</span>
          </motion.button>
          <motion.button 
            type="button" 
            className="nav-link-btn" 
            onClick={scrollToAnalytics}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
          >
            Analytics
          </motion.button>
          <motion.button 
            type="button" 
            className="nav-link-btn" 
            onClick={scrollToHabits}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
          >
            <span className="nav-text-desktop">Tasks & Habits</span>
            <span className="nav-text-mobile">Habits</span>
          </motion.button>
        </nav>
      </motion.header>

      {/* Main Full-Height Hero Section: Almost Entire Screen */}
      <section className="hero-screen-section">
        <PomodoroTimer 
          onSessionLogged={triggerRefresh} 
          onScrollToDetails={scrollToDetails} 
        />
      </section>

      {/* Secondary Dashboard Sections (Smoothly visible on scroll) */}
      <div id="study-details" ref={detailsRef} className="dashboard-content-container">
        {/* 1. Study Hours / Time (Last 7 Days) Overview Diagram */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <WeeklyStudyChart refreshTrigger={refreshTrigger} />
        </motion.div>

        {/* 2. Analytics & Session History Dashboard */}
        <motion.div 
          ref={analyticsRef} 
          className="analytics-section-wrapper"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
        >
          <StatsDashboard 
            filterDays={filterDays} 
            setFilterDays={setFilterDays} 
            refreshTrigger={refreshTrigger}
            onSessionDeleted={triggerRefresh}
          />
        </motion.div>

        {/* 3. Row: Study Tasks + Weekly Habits Tracker */}
        <motion.div 
          ref={habitsRef} 
          className="productivity-suite-grid"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.5, delay: 0.15, ease: 'easeOut' }}
        >
          {/* Integrated Study Tasks / To-Do List */}
          <TaskList />

          {/* Weekly Habits Tracker */}
          <HabitsTracker />
        </motion.div>

        {/* 4. Visual Contribution Heatmap */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.5, delay: 0.2, ease: 'easeOut' }}
        >
          <StudyHeatmap filterDays={filterDays} refreshTrigger={refreshTrigger} />
        </motion.div>

        {/* 5. Backup & Data Management */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.5, delay: 0.25, ease: 'easeOut' }}
        >
          <BackupPanel onBackupImported={triggerRefresh} />
        </motion.div>
      </div>

      {/* Semantic SEO & Accessibility Footer */}
      <footer className="study-app-footer">
        <div className="footer-content">
          <div className="footer-brand-info">
            <span className="footer-brand-title">Studies<span className="brand-accent">Timer</span></span>
            <p className="footer-description">
              Free aesthetic online Pomodoro timer, study habit tracker, and annual contribution heatmap designed for deep focus.
            </p>
          </div>
          <div className="footer-meta-info">
            <span className="footer-pill">🔒 100% Free · Local-First IndexedDB Privacy</span>
            <span className="footer-copyright">
              © {new Date().getFullYear()} StudiesTimer · prompt-forge.in
            </span>
          </div>
        </div>
      </footer>
    </main>
  );
}
