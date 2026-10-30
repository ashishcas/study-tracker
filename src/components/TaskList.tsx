'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  StudyTask, 
  getTasks, 
  saveTask, 
  updateTask, 
  deleteTask, 
  getActiveTaskId, 
  setActiveTaskId,
  getSubjects 
} from '../lib/db';
import { playChime } from '../lib/audio';

export default function TaskList() {
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [activeTaskId, setActiveId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [subjectInput, setSubjectInput] = useState('General');
  const [estPomodoros, setEstPomodoros] = useState(2);
  const [subjects, setSubjects] = useState<string[]>(['General']);

  const loadData = () => {
    setTasks(getTasks());
    setActiveId(getActiveTaskId());
    setSubjects(getSubjects());
  };

  useEffect(() => {
    loadData();

    const handleTasksUpdate = () => setTasks(getTasks());
    const handleActiveTaskUpdate = () => setActiveId(getActiveTaskId());
    const handleSubjectsUpdate = () => setSubjects(getSubjects());

    window.addEventListener('study-tasks-updated', handleTasksUpdate);
    window.addEventListener('study-active-task-updated', handleActiveTaskUpdate);
    window.addEventListener('study-subjects-updated', handleSubjectsUpdate);

    return () => {
      window.removeEventListener('study-tasks-updated', handleTasksUpdate);
      window.removeEventListener('study-active-task-updated', handleActiveTaskUpdate);
      window.removeEventListener('study-subjects-updated', handleSubjectsUpdate);
    };
  }, []);

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titleInput.trim()) return;

    const created = saveTask({
      title: titleInput.trim(),
      subject: subjectInput,
      estPomodoros: Math.max(1, estPomodoros),
    });

    // If no active task currently, auto-select this new task
    if (!activeTaskId) {
      setActiveTaskId(created.id);
    }

    setTitleInput('');
    setEstPomodoros(2);
    setShowAddForm(false);
  };

  const handleToggleComplete = (task: StudyTask) => {
    const nextCompleted = !task.completed;
    if (nextCompleted) {
      playChime('taskComplete');
      // If completed was the active task, clear active task
      if (activeTaskId === task.id) {
        setActiveTaskId(null);
      }
    }
    updateTask(task.id, { completed: nextCompleted });
  };

  const handleSelectActive = (task: StudyTask) => {
    if (activeTaskId === task.id) {
      setActiveTaskId(null);
    } else {
      setActiveTaskId(task.id);
    }
  };

  const handleQuickAdd = (title: string, est: number) => {
    saveTask({
      title,
      subject: subjects[0] || 'General',
      estPomodoros: est,
    });
  };

  const filteredTasks = tasks.filter(t => {
    if (filter === 'active') return !t.completed;
    if (filter === 'completed') return t.completed;
    return true;
  });

  const completedCount = tasks.filter(t => t.completed).length;
  const totalActPomodoros = tasks.reduce((sum, t) => sum + (t.actPomodoros || 0), 0);
  const totalEstPomodoros = tasks.reduce((sum, t) => sum + (t.estPomodoros || 1), 0);

  const activeTask = tasks.find(t => t.id === activeTaskId);

  return (
    <div className="task-list-card glass-card">
      {/* Top Header */}
      <div className="task-list-header">
        <div className="task-header-left">
          <div className="task-icon-badge">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <div>
            <h2 className="task-list-title">Study Tasks</h2>
            <p className="task-list-subtitle">
              {tasks.length > 0 ? `${completedCount}/${tasks.length} done · 🍅 ${totalActPomodoros}/${totalEstPomodoros}` : 'Plan and track your study milestones'}
            </p>
          </div>
        </div>

        <button 
          className="btn btn-secondary btn-sm"
          onClick={() => setShowAddForm(prev => !prev)}
        >
          {showAddForm ? '✕ Close' : '+ New Task'}
        </button>
      </div>

      {/* Active Task Banner */}
      {activeTask && !activeTask.completed && (
        <div className="active-focus-banner">
          <div className="active-pulse-dot" />
          <div className="active-task-info">
            <span className="active-tag">Current Focus Task:</span>
            <span className="active-task-name">{activeTask.title}</span>
            <span className="active-task-poms">
              🍅 {activeTask.actPomodoros} / {activeTask.estPomodoros} completed
            </span>
          </div>
          <button 
            type="button" 
            className="btn-clear-active" 
            onClick={() => setActiveTaskId(null)}
            title="Deselect active focus task"
          >
            ✕
          </button>
        </div>
      )}

      {/* Add Task Form */}
      {showAddForm && (
        <form onSubmit={handleCreateTask} className="task-add-form animate-fade-in">
          <div className="task-input-row">
            <input 
              type="text" 
              placeholder="What are you working on? (e.g. Chapter 3 Exercises)..."
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              className="task-title-input"
              autoFocus
              required
            />
          </div>

          <div className="task-meta-row">
            <div className="task-form-group">
              <label>Subject</label>
              <select 
                value={subjectInput} 
                onChange={(e) => setSubjectInput(e.target.value)}
                className="task-select"
              >
                {subjects.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="task-form-group">
              <label>Est. Pomodoros</label>
              <div className="pomodoro-stepper">
                <button 
                  type="button" 
                  className="stepper-btn"
                  onClick={() => setEstPomodoros(prev => Math.max(1, prev - 1))}
                >
                  -
                </button>
                <span className="stepper-val">🍅 {estPomodoros}</span>
                <button 
                  type="button" 
                  className="stepper-btn"
                  onClick={() => setEstPomodoros(prev => Math.min(12, prev + 1))}
                >
                  +
                </button>
              </div>
            </div>

            <div className="task-form-actions">
              <button type="submit" className="btn btn-primary btn-sm">
                Save Task
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Filter Tabs */}
      {tasks.length > 0 && (
        <div className="task-filters">
          <button 
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({tasks.length})
          </button>
          <button 
            className={`filter-btn ${filter === 'active' ? 'active' : ''}`}
            onClick={() => setFilter('active')}
          >
            Active ({tasks.length - completedCount})
          </button>
          <button 
            className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
            onClick={() => setFilter('completed')}
          >
            Completed ({completedCount})
          </button>
        </div>
      )}

      {/* Task Items List */}
      <div className="task-items-container">
        {filteredTasks.length === 0 ? (
          <div className="task-empty-state">
            {tasks.length === 0 ? (
              <>
                <p className="empty-title">No tasks added yet</p>
                <p className="empty-hint">Create your first task or click a starter template:</p>
                <div className="quick-starters">
                  <button 
                    type="button" 
                    className="starter-chip"
                    onClick={() => handleQuickAdd('Review Lecture & Notes', 2)}
                  >
                    + Review Notes (2 🍅)
                  </button>
                  <button 
                    type="button" 
                    className="starter-chip"
                    onClick={() => handleQuickAdd('Solve 5 Practice Problems', 3)}
                  >
                    + Practice Problems (3 🍅)
                  </button>
                  <button 
                    type="button" 
                    className="starter-chip"
                    onClick={() => handleQuickAdd('Draft Project Outline', 2)}
                  >
                    + Project Outline (2 🍅)
                  </button>
                </div>
              </>
            ) : (
              <p className="empty-title">No {filter} tasks found.</p>
            )}
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredTasks.map(task => {
              const isActive = activeTaskId === task.id;
              return (
                <motion.div 
                  key={task.id} 
                  layout
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.15 } }}
                  transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                  className={`task-item ${task.completed ? 'completed' : ''} ${isActive ? 'is-active-task' : ''}`}
                >
                  {/* Checkbox with spring tap feedback */}
                  <motion.button 
                    type="button"
                    className={`task-checkbox ${task.completed ? 'checked' : ''}`}
                    onClick={() => handleToggleComplete(task)}
                    whileTap={{ scale: 0.8 }}
                    whileHover={{ scale: 1.08 }}
                    title={task.completed ? 'Mark incomplete' : 'Mark completed'}
                  >
                    {task.completed && (
                      <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    )}
                  </motion.button>

                  {/* Content */}
                  <div className="task-content">
                    <div className="task-title-row">
                      <span className="task-title">{task.title}</span>
                      <span className="task-subject-tag">{task.subject}</span>
                    </div>

                    <div className="task-footer-row">
                      <span className="task-pom-count">
                        <span className="pom-icon">🍅</span> {task.actPomodoros || 0} / {task.estPomodoros}
                      </span>
                      {task.completedAt && (
                        <span className="task-completed-time">
                          Done {new Date(task.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="task-actions">
                    {!task.completed && (
                      <motion.button 
                        type="button"
                        className={`btn-focus-task ${isActive ? 'active' : ''}`}
                        onClick={() => handleSelectActive(task)}
                        whileTap={{ scale: 0.93 }}
                        title={isActive ? 'Deselect from focus timer' : 'Set as current timer task'}
                      >
                        {isActive ? '🎯 In Focus' : 'Focus'}
                      </motion.button>
                    )}
                    <motion.button 
                      type="button"
                      className="btn-delete-task"
                      onClick={() => deleteTask(task.id)}
                      whileTap={{ scale: 0.85 }}
                      whileHover={{ scale: 1.1 }}
                      title="Delete task"
                    >
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </motion.button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
