'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  saveSession, 
  getSubjects, 
  saveSubject, 
  getTasks,
  getActiveTaskId, 
  setActiveTaskId,
  incrementTaskPomodoro, 
  StudyTask,
  getTimerPreferences,
  saveTimerPreferences
} from '../lib/db';
import { playChime } from '../lib/audio';

type TimerType = 'pomodoro' | 'stopwatch';
type TimerMode = 'focus' | 'shortBreak' | 'longBreak';
type TimerStatus = 'idle' | 'running' | 'paused';

interface PomodoroTimerProps {
  onSessionLogged: () => void;
  onScrollToDetails?: () => void;
}

const PRESET_DURATIONS = [15, 25, 30, 45, 60];

const MOTIVATIONAL_QUOTES = [
  "“The secret of getting ahead is getting started.”",
  "“Deep focus creates effortless mastery.”",
  "“Small daily efforts compound into extraordinary results.”",
  "“Action is the foundational key to all success.”",
  "“Your future self is created by what you do today.”"
];

export default function PomodoroTimer({ onSessionLogged, onScrollToDetails }: PomodoroTimerProps) {
  // Timer type: Pomodoro or Stopwatch
  const [timerType, setTimerType] = useState<TimerType>('pomodoro');

  // Fullscreen / Zen Mode
  const [isZenMode, setIsZenMode] = useState(false);

  // Pomodoro Timer lengths (in seconds)
  const [focusLength, setFocusLength] = useState(25 * 60);
  const [shortBreakLength, setShortBreakLength] = useState(5 * 60);
  const [longBreakLength, setLongBreakLength] = useState(15 * 60);

  // Auto-start breaks setting
  const [autoStartBreaks, setAutoStartBreaks] = useState(false);

  // Pomodoro Timer states
  const [mode, setMode] = useState<TimerMode>('focus');
  const [status, setStatus] = useState<TimerStatus>('idle');
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [completedCycles, setCompletedCycles] = useState(0);

  // Stopwatch states (in seconds)
  const [stopwatchSeconds, setStopwatchSeconds] = useState(0);
  const [stopwatchStatus, setStopwatchStatus] = useState<TimerStatus>('idle');

  // Subject states
  const [subject, setSubject] = useState('General');
  const [subjectInput, setSubjectInput] = useState('');
  const [existingSubjects, setExistingSubjects] = useState<string[]>(['General']);
  const [showAddSubject, setShowAddSubject] = useState(false);

  // Active Task
  const [activeTask, setActiveTask] = useState<StudyTask | null>(null);

  // Motivational quote
  const [quoteIndex, setQuoteIndex] = useState(0);

  // Notification / toast feedback
  const [sessionToast, setSessionToast] = useState<string | null>(null);

  // QUICK MANUAL LOG MODAL (Log past 10m, 15m, 30m without waiting for clock)
  const [showQuickLogModal, setShowQuickLogModal] = useState(false);
  const [quickLogMinutes, setQuickLogMinutes] = useState<number>(10);
  const [quickLogSubject, setQuickLogSubject] = useState<string>('General');

  // Refs for background interval & drift correction
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const targetTimeRef = useRef<number | null>(null);
  const stopwatchIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const stopwatchStartRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Rotate quote every 45s
  useEffect(() => {
    const quoteInterval = setInterval(() => {
      setQuoteIndex(prev => (prev + 1) % MOTIVATIONAL_QUOTES.length);
    }, 45000);
    return () => clearInterval(quoteInterval);
  }, []);

  // Keyboard shortcut listener (Space = start/pause, Esc = exit zen, F = toggle zen)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (timerType === 'pomodoro') {
          handleStartPause();
        } else {
          handleStopwatchStartPause();
        }
      } else if (e.key === 'Escape') {
        if (showQuickLogModal) setShowQuickLogModal(false);
        else if (isZenMode) setIsZenMode(false);
      } else if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey) {
        setIsZenMode(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [timerType, status, stopwatchStatus, isZenMode, showQuickLogModal, timeLeft, stopwatchSeconds]);

  // Load preferences, subjects, and active task
  useEffect(() => {
    const prefs = getTimerPreferences();
    setAutoStartBreaks(prefs.autoStartBreaks);
    setTimerType(prefs.timerType || 'pomodoro');
    const initialPresetSec = (prefs.selectedFocusPreset || 25) * 60;
    setFocusLength(initialPresetSec);
    setTimeLeft(initialPresetSec);
    if (prefs.selectedSubject) {
      setSubject(prefs.selectedSubject);
    }

    const updateSubjects = () => {
      const subs = getSubjects();
      setExistingSubjects(subs);
      const savedSubject = getTimerPreferences().selectedSubject;
      if (savedSubject && subs.includes(savedSubject)) {
        setSubject(savedSubject);
      } else if (!subs.includes(subject)) {
        setSubject(subs[0] || 'General');
      }
    };

    const updateTasks = () => {
      const activeId = getActiveTaskId();
      const allTasks = getTasks();
      const current = allTasks.find(t => t.id === activeId) || null;
      setActiveTask(current);
      if (current && current.subject) {
        setSubject(current.subject);
      }
    };

    updateSubjects();
    updateTasks();

    window.addEventListener('study-subjects-updated', updateSubjects);
    window.addEventListener('study-active-task-updated', updateTasks);
    window.addEventListener('study-tasks-updated', updateTasks);

    return () => {
      window.removeEventListener('study-subjects-updated', updateSubjects);
      window.removeEventListener('study-active-task-updated', updateTasks);
      window.removeEventListener('study-tasks-updated', updateTasks);
    };
  }, []);

  // Sync quick log subject default with current subject
  useEffect(() => {
    setQuickLogSubject(subject);
  }, [subject]);

  // Trigger brief floating confirmation toast
  const showToast = (msg: string) => {
    setSessionToast(msg);
    setTimeout(() => {
      setSessionToast(null);
    }, 4500);
  };

  // Handle Pomodoro regular completion (counted down to 0)
  const handleTimerComplete = () => {
    if (mode === 'focus') {
      const currentActiveId = getActiveTaskId();

      saveSession({
        subject,
        durationSeconds: focusLength,
        completedAt: new Date().toISOString(),
        mode: 'focus',
        taskId: currentActiveId || undefined,
      });

      if (currentActiveId) {
        incrementTaskPomodoro(currentActiveId);
      }

      playChime('focusEnd');
      onSessionLogged();
      showToast(`Completed full ${Math.round(focusLength / 60)}m session in ${subject}! 🍅`);

      const newCycles = completedCycles + 1;
      setCompletedCycles(newCycles);

      const nextBreakMode = newCycles % 4 === 0 ? 'longBreak' : 'shortBreak';
      const nextBreakDuration = nextBreakMode === 'longBreak' ? longBreakLength : shortBreakLength;

      setMode(nextBreakMode);
      setTimeLeft(nextBreakDuration);

      if (autoStartBreaks) {
        setStatus('running');
      } else {
        setStatus('idle');
      }
    } else {
      playChime('breakEnd');
      setMode('focus');
      setTimeLeft(focusLength);
      setStatus('idle');
      showToast("Break completed! Ready for next focus block.");
    }
  };

  // AUTOMATIC STOP & RECORD (Saves elapsed study time tagged to active subject directly without asking again)
  const handleAutoStopAndRecord = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (stopwatchIntervalRef.current) clearInterval(stopwatchIntervalRef.current);

    const elapsedSeconds = timerType === 'pomodoro' 
      ? Math.max(0, focusLength - timeLeft) 
      : Math.max(0, stopwatchSeconds);

    if (elapsedSeconds < 5) {
      showToast('⚠️ Session too brief (< 5 seconds) to record.');
      if (timerType === 'pomodoro') handleReset();
      else handleStopwatchReset();
      return;
    }

    const durationSeconds = Math.max(60, elapsedSeconds);
    const recordedMinutes = Math.max(1, Math.round(durationSeconds / 60));
    const currentActiveId = getActiveTaskId();

    saveSession({
      subject,
      durationSeconds,
      completedAt: new Date().toISOString(),
      mode: 'focus',
      taskId: currentActiveId || undefined,
    });

    if (currentActiveId && recordedMinutes >= 15) {
      incrementTaskPomodoro(currentActiveId);
    }

    playChime('focusEnd');
    onSessionLogged();
    showToast(`✓ Saved ${recordedMinutes}m study session tagged to "${subject}"! 🍅`);

    // Reset clock back to clean idle state
    setStatus('idle');
    setStopwatchStatus('idle');
    if (timerType === 'pomodoro') {
      setTimeLeft(focusLength);
    } else {
      setStopwatchSeconds(0);
    }
  };

  // CONFIRM QUICK PAST STUDY LOG (e.g. studied 10 mins away from screen)
  const handleConfirmQuickLog = (e: React.FormEvent) => {
    e.preventDefault();
    const minutesToSave = Math.max(1, Number(quickLogMinutes));
    const targetSubject = quickLogSubject.trim() || subject;
    const currentActiveId = getActiveTaskId();

    saveSession({
      subject: targetSubject,
      durationSeconds: minutesToSave * 60,
      completedAt: new Date().toISOString(),
      mode: 'focus',
      taskId: currentActiveId || undefined,
    });

    if (currentActiveId && minutesToSave >= 15) {
      incrementTaskPomodoro(currentActiveId);
    }

    playChime('taskComplete');
    onSessionLogged();
    showToast(`✓ Logged ${minutesToSave} mins of study for "${targetSubject}"!`);
    setShowQuickLogModal(false);
  };

  // Pomodoro countdown ticker with drift compensation
  useEffect(() => {
    if (timerType === 'pomodoro' && status === 'running') {
      targetTimeRef.current = Date.now() + timeLeft * 1000;

      timerIntervalRef.current = setInterval(() => {
        if (targetTimeRef.current === null) return;
        const delta = Math.max(0, Math.round((targetTimeRef.current - Date.now()) / 1000));
        setTimeLeft(delta);

        if (delta === 0) {
          handleTimerComplete();
        }
      }, 200);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      targetTimeRef.current = null;
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerType, status, timeLeft, mode, autoStartBreaks, focusLength, shortBreakLength, longBreakLength]);

  // Stopwatch counter ticker with drift compensation
  useEffect(() => {
    if (timerType === 'stopwatch' && stopwatchStatus === 'running') {
      stopwatchStartRef.current = Date.now() - stopwatchSeconds * 1000;

      stopwatchIntervalRef.current = setInterval(() => {
        if (stopwatchStartRef.current === null) return;
        const elapsed = Math.floor((Date.now() - stopwatchStartRef.current) / 1000);
        setStopwatchSeconds(elapsed);
      }, 250);
    } else {
      if (stopwatchIntervalRef.current) {
        clearInterval(stopwatchIntervalRef.current);
        stopwatchIntervalRef.current = null;
      }
      stopwatchStartRef.current = null;
    }

    return () => {
      if (stopwatchIntervalRef.current) {
        clearInterval(stopwatchIntervalRef.current);
      }
    };
  }, [timerType, stopwatchStatus, stopwatchSeconds]);

  // Controls for Pomodoro
  const handleStartPause = () => {
    if (status === 'running') {
      setStatus('paused');
    } else {
      setStatus('running');
    }
  };

  const handleReset = () => {
    setStatus('idle');
    if (mode === 'focus') setTimeLeft(focusLength);
    else if (mode === 'shortBreak') setTimeLeft(shortBreakLength);
    else if (mode === 'longBreak') setTimeLeft(longBreakLength);
  };

  const handleSkip = () => {
    setStatus('idle');
    if (mode === 'focus') {
      const newCycles = completedCycles + 1;
      setCompletedCycles(newCycles);
      if (newCycles % 4 === 0) {
        setMode('longBreak');
        setTimeLeft(longBreakLength);
      } else {
        setMode('shortBreak');
        setTimeLeft(shortBreakLength);
      }
    } else {
      setMode('focus');
      setTimeLeft(focusLength);
    }
  };

  const switchMode = (newMode: TimerMode) => {
    setStatus('idle');
    setMode(newMode);
    if (newMode === 'focus') setTimeLeft(focusLength);
    else if (newMode === 'shortBreak') setTimeLeft(shortBreakLength);
    else if (newMode === 'longBreak') setTimeLeft(longBreakLength);
  };

  const handlePresetSelect = (minutes: number) => {
    const sec = minutes * 60;
    setFocusLength(sec);
    saveTimerPreferences({ selectedFocusPreset: minutes });
    if (mode === 'focus') {
      setStatus('idle');
      setTimeLeft(sec);
    }
  };

  const toggleAutoStartBreaks = () => {
    const nextVal = !autoStartBreaks;
    setAutoStartBreaks(nextVal);
    saveTimerPreferences({ autoStartBreaks: nextVal });
  };

  // Stopwatch controls
  const handleStopwatchStartPause = () => {
    if (stopwatchStatus === 'running') {
      setStopwatchStatus('paused');
    } else {
      setStopwatchStatus('running');
    }
  };

  const handleStopwatchReset = () => {
    setStopwatchStatus('idle');
    setStopwatchSeconds(0);
  };

  const handleSelectSubject = (selectedSub: string) => {
    setSubject(selectedSub);
    saveTimerPreferences({ selectedSubject: selectedSub });
    try {
      localStorage.setItem('study_tracker_selected_subject', selectedSub);
    } catch {}
  };

  const handleAddSubject = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = subjectInput.trim();
    if (trimmed !== '') {
      saveSubject(trimmed);
      setSubject(trimmed);
      saveTimerPreferences({ selectedSubject: trimmed });
      try {
        localStorage.setItem('study_tracker_selected_subject', trimmed);
      } catch {}
      setQuickLogSubject(trimmed);
      setSubjectInput('');
      setShowAddSubject(false);
    }
  };

  const toggleZenMode = () => {
    setIsZenMode(prev => !prev);
  };

  // Formatter for MM:SS or HH:MM:SS
  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Elapsed focus time
  const elapsedFocusSeconds = timerType === 'pomodoro' 
    ? (mode === 'focus' ? (focusLength - timeLeft) : 0) 
    : stopwatchSeconds;
  const elapsedMinutesDisplay = Math.floor(elapsedFocusSeconds / 60);
  const elapsedSecondsRemainder = elapsedFocusSeconds % 60;

  // Progress for ring
  const totalLength = mode === 'focus' ? focusLength : mode === 'shortBreak' ? shortBreakLength : longBreakLength;
  const progressPercent = timerType === 'pomodoro' 
    ? ((totalLength - timeLeft) / totalLength) * 100 
    : ((stopwatchSeconds % 3600) / 3600) * 100;

  const isRunning = timerType === 'pomodoro' ? status === 'running' : stopwatchStatus === 'running';
  const isTimerStarted = timerType === 'pomodoro' ? status !== 'idle' : stopwatchStatus !== 'idle';
  const hasElapsedStudyTime = elapsedFocusSeconds >= 10;

  return (
    <div 
      ref={containerRef}
      className={`hero-timer-screen mode-${timerType === 'stopwatch' ? 'stopwatch' : mode} ${isZenMode ? 'is-zen-fullscreen' : ''} ${isRunning ? 'is-timer-active' : ''}`}
    >
      {/* Background Ambient Glow Halo */}
      <div className="ambient-timer-halo" />

      {/* Floating Notification Toast */}
      {sessionToast && (
        <div className="floating-session-toast animate-slide-down">
          <span>{sessionToast}</span>
        </div>
      )}

      {/* Top Header Controls Bar */}
      <div className="timer-top-bar">
        {/* Type Switcher */}
        <div className="timer-type-selector">
          <button 
            type="button"
            className={`type-btn ${timerType === 'pomodoro' ? 'active' : ''}`}
            onClick={() => {
              setTimerType('pomodoro');
              saveTimerPreferences({ timerType: 'pomodoro' });
            }}
          >
            <span className="type-icon">🍅</span> Pomodoro
          </button>
          <button 
            type="button"
            className={`type-btn ${timerType === 'stopwatch' ? 'active' : ''}`}
            onClick={() => {
              setTimerType('stopwatch');
              saveTimerPreferences({ timerType: 'stopwatch' });
            }}
          >
            <span className="type-icon">⏱️</span> Stopwatch
          </button>
        </div>

        {/* Center Mode Selector (Pomodoro only) */}
        {timerType === 'pomodoro' ? (
          <div className="mode-selector hero-mode-selector">
            <button 
              className={mode === 'focus' ? 'active' : ''} 
              onClick={() => switchMode('focus')}
            >
              Focus
            </button>
            <button 
              className={mode === 'shortBreak' ? 'active' : ''} 
              onClick={() => switchMode('shortBreak')}
            >
              Short Break
            </button>
            <button 
              className={mode === 'longBreak' ? 'active' : ''} 
              onClick={() => switchMode('longBreak')}
            >
              Long Break
            </button>
          </div>
        ) : (
          <div className="stopwatch-badge-hero">
            <span>⏱️ Open Focus Mode</span>
          </div>
        )}

        {/* Quick Log & Zen View Buttons */}
        <div className="top-action-btns">
          <button 
            type="button"
            className="btn-quick-log"
            onClick={() => setShowQuickLogModal(true)}
            title="Directly log 10, 15, or 30 mins studied to a subject"
          >
            ⚡ Quick Log
          </button>

          <button 
            type="button"
            className={`btn-zen-mode ${isZenMode ? 'active' : ''}`}
            onClick={toggleZenMode}
            title={isZenMode ? "Exit Fullscreen (Esc)" : "Enter Sleek Fullscreen (F)"}
          >
            {isZenMode ? (
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              </svg>
            )}
            <span className="zen-btn-text">{isZenMode ? 'Exit' : 'Zen View'}</span>
          </button>
        </div>
      </div>

      {/* Quick Duration Presets & Auto-Break Settings */}
      {timerType === 'pomodoro' && (
        <div className="hero-subcontrols-bar">
          {mode === 'focus' && (
            <div className="duration-presets-row">
              <span className="presets-label">Quick Presets:</span>
              <div className="presets-pills">
                {PRESET_DURATIONS.map(m => {
                  const isCurrent = Math.round(focusLength / 60) === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      className={`preset-pill ${isCurrent ? 'active' : ''}`}
                      onClick={() => handlePresetSelect(m)}
                    >
                      {m}m
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <button 
            type="button" 
            className={`auto-break-toggle ${autoStartBreaks ? 'enabled' : ''}`}
            onClick={toggleAutoStartBreaks}
            title="Automatically start break countdown when focus ends"
          >
            <span className="toggle-indicator">{autoStartBreaks ? '●' : '○'}</span>
            <span>Auto-Breaks: {autoStartBreaks ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      )}

      {/* Linked Active Task Banner */}
      {activeTask && (
        <div className="timer-active-task-pill hero-active-task">
          <span className="pill-prefix">🎯 Current Target:</span>
          <span className="pill-title">{activeTask.title}</span>
          <span className="pill-poms">({activeTask.actPomodoros}/{activeTask.estPomodoros} 🍅)</span>
          <button 
            type="button" 
            className="pill-clear"
            onClick={() => setActiveTaskId(null)}
            title="Deselect active focus task"
          >
            ✕
          </button>
        </div>
      )}

      {/* Grand Sleek Center Ring Display */}
      <div className="hero-timer-display">
        <svg className="hero-progress-ring" viewBox="0 0 100 100">
          <circle className="progress-ring-bg" cx="50" cy="50" r="45" />
          <circle 
            className="progress-ring-fg" 
            cx="50" 
            cy="50" 
            r="45" 
            strokeDasharray="282.7" 
            strokeDashoffset={
              timerType === 'pomodoro' 
                ? 282.7 - (282.7 * progressPercent) / 100 
                : 282.7 - (282.7 * ((stopwatchSeconds % 60) / 60))
            }
          />
        </svg>

        <div className="hero-timer-text-container">
          <span className="hero-timer-digits">
            {timerType === 'pomodoro' ? formatTime(timeLeft) : formatTime(stopwatchSeconds)}
          </span>
          <span className="hero-timer-state-label">
            {timerType === 'pomodoro' ? (
              status === 'running' 
                ? (mode === 'focus' ? 'Deep Focus...' : 'Rest & Recharge...') 
                : status === 'paused' ? 'Paused' : 'Ready to begin'
            ) : (
              stopwatchStatus === 'running' ? 'Tracking study...' : stopwatchStatus === 'paused' ? 'Paused' : 'Ready'
            )}
          </span>
        </div>
      </div>

      {/* LIVE ELAPSED STUDY BANNER WITH DIRECT CLICK-TO-SAVE */}
      {hasElapsedStudyTime && (
        <div className="partial-study-recorder animate-fade-in">
          <div className="partial-study-info">
            <span className="partial-fire-icon">🔥</span>
            <span>
              Studied <strong>{elapsedMinutesDisplay > 0 ? `${elapsedMinutesDisplay}m ` : ''}{elapsedSecondsRemainder}s</strong> of <strong>{subject}</strong>
            </span>
          </div>
          <button 
            type="button" 
            className="btn-log-partial"
            onClick={handleAutoStopAndRecord}
            title={`Stop clock and automatically record ${elapsedMinutesDisplay > 0 ? `${elapsedMinutesDisplay}m` : `${elapsedSecondsRemainder}s`} to ${subject}`}
          >
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            <span>■ Stop & Save {elapsedMinutesDisplay > 0 ? `${elapsedMinutesDisplay}m` : `${elapsedSecondsRemainder}s`}</span>
          </button>
        </div>
      )}

      {/* Sleek Floating Timer Controls - Uniform 50px Button Size */}
      <div className="hero-timer-controls">
        {/* Reset Button */}
        <button 
          className="btn btn-secondary hero-btn-round" 
          onClick={timerType === 'pomodoro' ? handleReset : handleStopwatchReset} 
          title="Reset timer without saving"
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
        </button>

        {/* Primary Play / Pause Button - Matching 50px size */}
        <button 
          className="btn btn-primary hero-btn-play" 
          onClick={timerType === 'pomodoro' ? handleStartPause : handleStopwatchStartPause}
          title={isRunning ? 'Pause (Space)' : 'Start (Space)'}
        >
          {isRunning ? (
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 0 1 .75-.75H9a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H7.5a.75.75 0 0 1-.75-.75V5.25Zm7.5 0A.75.75 0 0 1 15 4.5h1.5a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H15a.75.75 0 0 1-.75-.75V5.25Z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24" style={{ transform: 'translateX(1px)' }}>
              <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
            </svg>
          )}
        </button>

        {/* PROMINENT STOP & SAVE BUTTON - Saves automatically without modal */}
        <button 
          className={`btn hero-btn-stop-save ${hasElapsedStudyTime ? 'can-save' : ''}`}
          onClick={handleAutoStopAndRecord}
          title={hasElapsedStudyTime 
            ? `Stop clock now and automatically record ${elapsedMinutesDisplay > 0 ? `${elapsedMinutesDisplay}m` : `${elapsedSecondsRemainder}s`} to ${subject}` 
            : `Stop and save study session to ${subject}`
          }
        >
          <span className="stop-square-icon">■</span>
          <span className="stop-save-label">
            {hasElapsedStudyTime ? `Stop & Record (${elapsedMinutesDisplay > 0 ? `${elapsedMinutesDisplay}m` : `${elapsedSecondsRemainder}s`})` : 'Stop & Record'}
          </span>
        </button>

        {/* Skip Button (Pomodoro Mode Only) */}
        {timerType === 'pomodoro' && (
          <button className="btn btn-secondary hero-btn-round" onClick={handleSkip} title="Skip to next mode">
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
              <path d="M5.055 7.06C5.005 7.16 5 7.275 5 7.39v9.22c0 .115.005.23.055.33a.73.73 0 0 0 .396.397c.1.049.215.053.33.053h.273c.183 0 .365-.05.526-.145l6.91-4.11a.884.884 0 0 0 .375-.386c.05-.1.05-.246 0-.348a.884.884 0 0 0-.375-.386l-6.91-4.11a1.014 1.014 0 0 0-.8-.092.73.73 0 0 0-.396.397ZM19 6.25a.75.75 0 0 1 .75.75v10a.75.75 0 0 1-1.5 0V7a.75.75 0 0 1 .75-.75Z" />
            </svg>
          </button>
        )}
      </div>

      {/* Cycle Indicator & Subject Selector */}
      <div className="hero-bottom-meta">
        {timerType === 'pomodoro' && (
          <div className="cycle-indicator hero-cycle-indicator">
            <span className="cycle-label">Cycle:</span>
            <div className="cycle-dots">
              {[0, 1, 2, 3].map(i => (
                <div 
                  key={i} 
                  className={`dot ${i < (completedCycles % 4) ? 'completed' : ''} ${mode === 'focus' && i === (completedCycles % 4) && status === 'running' ? 'active-pulse' : ''}`}
                />
              ))}
            </div>
            <span className="cycle-text">{(completedCycles % 4)}/4</span>
          </div>
        )}

        {/* Minimal Subject Tag: active label when timer started, dropdown when idle */}
        <div className={`subject-tracker hero-subject-tracker ${isTimerStarted ? 'is-active-subject' : ''}`}>
          {isTimerStarted ? (
            <>
              <span className="hero-subject-label-tag">Subject:</span>
              <div className="hero-subject-badge">
                <span className="hero-subject-active-dot">●</span>
                <span className="hero-subject-name font-semibold">{subject}</span>
              </div>
            </>
          ) : (
            <>
              <label htmlFor="hero-subject-select">Subject:</label>
              <div className="subject-controls">
                {!showAddSubject ? (
                  <>
                    <select 
                      id="hero-subject-select"
                      value={subject}
                      onChange={(e) => handleSelectSubject(e.target.value)}
                      className="subject-dropdown hero-subject-dropdown"
                    >
                      {existingSubjects.map(sub => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </select>
                    <button 
                      type="button" 
                      onClick={() => setShowAddSubject(true)}
                      className="btn btn-icon btn-add-sub"
                      title="Add new subject"
                    >
                      <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                    </button>
                  </>
                ) : (
                  <form onSubmit={handleAddSubject} className="add-subject-form">
                    <input 
                      type="text" 
                      placeholder="New subject..."
                      value={subjectInput}
                      onChange={(e) => setSubjectInput(e.target.value)}
                      className="subject-input"
                      autoFocus
                      required
                    />
                    <div className="add-subject-actions">
                      <button type="submit" className="btn btn-icon btn-confirm">
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      </button>
                      <button 
                        type="button" 
                        onClick={() => { setShowAddSubject(false); setSubjectInput(''); }} 
                        className="btn btn-icon btn-cancel"
                      >
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Motivational Rotating Quote */}
      <div className="hero-quote-container">
        <p className="hero-quote-text">{MOTIVATIONAL_QUOTES[quoteIndex]}</p>
        <span className="hero-shortcut-hint">
          Shortcuts: <code>Space</code> Play/Pause · <code>F</code> Zen Fullscreen
        </span>
      </div>

      {/* Scroll Down Prompt (if not in Zen fullscreen) */}
      {!isZenMode && onScrollToDetails && (
        <button 
          type="button" 
          className="hero-scroll-btn"
          onClick={onScrollToDetails}
          title="Scroll down to Tasks, Habits & Stats"
        >
          <span>Tasks, Habits & Stats</span>
          <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
      )}



      {/* =========================================================================
         MODAL 2: QUICK LOG PAST STUDY TIME (e.g. studied 10 mins away from screen)
         ========================================================================= */}
      {showQuickLogModal && (
        <div className="modal-backdrop-overlay" onClick={() => setShowQuickLogModal(false)}>
          <div className="modal-dialog-box animate-modal-pop" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon-badge quick-badge">
                <span style={{ fontSize: '1.2rem' }}>⚡</span>
              </div>
              <div>
                <h3 className="modal-title">Quick Log Past Study Time</h3>
                <p className="modal-subtitle">Log minutes you already studied directly to any subject</p>
              </div>
            </div>

            <form onSubmit={handleConfirmQuickLog} className="modal-form-content">
              {/* Duration Field */}
              <div className="modal-field">
                <label>Minutes Studied:</label>
                <div className="modal-input-row">
                  <input 
                    type="number"
                    min="1"
                    max="600"
                    value={quickLogMinutes}
                    onChange={e => setQuickLogMinutes(Number(e.target.value))}
                    className="modal-number-input"
                    required
                  />
                  <span className="input-unit">minutes</span>
                </div>
                <div className="quick-minute-chips">
                  {[10, 15, 20, 25, 30, 45, 60, 90].map(m => (
                    <button
                      key={m}
                      type="button"
                      className={`minute-chip ${quickLogMinutes === m ? 'active' : ''}`}
                      onClick={() => setQuickLogMinutes(m)}
                    >
                      {m}m
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject Tagging Field */}
              <div className="modal-field">
                <label>Tag to Subject:</label>
                <select 
                  value={quickLogSubject}
                  onChange={e => setQuickLogSubject(e.target.value)}
                  className="modal-select"
                >
                  {existingSubjects.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Action Buttons */}
              <div className="modal-action-row">
                <button 
                  type="button" 
                  className="btn btn-secondary modal-cancel-btn"
                  onClick={() => setShowQuickLogModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary modal-save-btn"
                >
                  ✓ Log Study Time
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
