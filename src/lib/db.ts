import Dexie, { type EntityTable } from 'dexie';

/* =========================================================================
   INTERFACES & SCHEMA DEFINITIONS
   ========================================================================= */

export interface StudySession {
  id: string;
  subject: string;
  durationSeconds: number;
  completedAt: string; // ISO date-time string
  mode: 'focus' | 'shortBreak' | 'longBreak';
  taskId?: string;
  notes?: string;
}

export interface StudyTask {
  id: string;
  title: string;
  subject: string;
  estPomodoros: number;
  actPomodoros: number;
  completed: boolean;
  createdAt: string;
  completedAt?: string;
}

export interface StudyHabit {
  id: string;
  title: string;
  category: string;
  targetDaysPerWeek: number;
  history: Record<string, boolean>; // 'YYYY-MM-DD': true
  createdAt: string;
}

export interface StudySubject {
  id: string;
  name: string;
  color?: string;
  createdAt: string;
}

/* =========================================================================
   DEXIE INDEXED-DB CLASS
   ========================================================================= */

export class StudyTrackerDexieDB extends Dexie {
  sessions!: EntityTable<StudySession, 'id'>;
  tasks!: EntityTable<StudyTask, 'id'>;
  habits!: EntityTable<StudyHabit, 'id'>;
  subjects!: EntityTable<StudySubject, 'id'>;

  constructor() {
    super('StudyTrackerDB');
    this.version(1).stores({
      sessions: 'id, subject, completedAt, mode, taskId, durationSeconds',
      tasks: 'id, subject, completed, createdAt',
      habits: 'id, category, createdAt',
      subjects: 'id, &name',
    });
  }
}

// Singleton Dexie instance
export const dexieDb = typeof window !== 'undefined' 
  ? new StudyTrackerDexieDB() 
  : (null as unknown as StudyTrackerDexieDB);

/* =========================================================================
   IN-MEMORY CACHE & PERSISTENCE SYNC
   ========================================================================= */

const STORAGE_KEY_SESSIONS = 'study_tracker_sessions';
const STORAGE_KEY_TASKS = 'study_tracker_tasks';
const STORAGE_KEY_HABITS = 'study_tracker_habits';
const STORAGE_KEY_SUBJECTS = 'study_tracker_subjects';
const ACTIVE_TASK_KEY = 'study_tracker_active_task_id';

let isDexieInitialized = false;

/**
 * Initialize Dexie IndexedDB and migrate any existing localStorage data.
 */
export async function initDexie(): Promise<void> {
  if (typeof window === 'undefined' || isDexieInitialized || !dexieDb) return;
  isDexieInitialized = true;

  try {
    await dexieDb.open();

    // 1. Sync Sessions
    const countSessions = await dexieDb.sessions.count();
    if (countSessions === 0) {
      const raw = localStorage.getItem(STORAGE_KEY_SESSIONS);
      if (raw) {
        const localSessions = JSON.parse(raw) as StudySession[];
        if (localSessions.length > 0) {
          await dexieDb.sessions.bulkPut(localSessions);
        }
      }
    } else {
      // Refresh local cache with latest Dexie data
      const allSessions = await dexieDb.sessions.orderBy('completedAt').reverse().toArray();
      localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(allSessions));
    }

    // 2. Sync Tasks
    const countTasks = await dexieDb.tasks.count();
    if (countTasks === 0) {
      const raw = localStorage.getItem(STORAGE_KEY_TASKS);
      if (raw) {
        const localTasks = JSON.parse(raw) as StudyTask[];
        if (localTasks.length > 0) {
          await dexieDb.tasks.bulkPut(localTasks);
        }
      }
    } else {
      const allTasks = await dexieDb.tasks.toArray();
      localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(allTasks));
    }

    // 3. Sync Habits
    const countHabits = await dexieDb.habits.count();
    if (countHabits === 0) {
      const raw = localStorage.getItem(STORAGE_KEY_HABITS);
      if (raw) {
        const localHabits = JSON.parse(raw) as StudyHabit[];
        if (localHabits.length > 0) {
          await dexieDb.habits.bulkPut(localHabits);
        }
      }
    } else {
      const allHabits = await dexieDb.habits.toArray();
      localStorage.setItem(STORAGE_KEY_HABITS, JSON.stringify(allHabits));
    }

    // 4. Sync Subjects
    const countSubjects = await dexieDb.subjects.count();
    if (countSubjects === 0) {
      const raw = localStorage.getItem(STORAGE_KEY_SUBJECTS);
      const subs = raw ? JSON.parse(raw) : ['General'];
      const subjectEntities: StudySubject[] = subs.map((s: string) => ({
        id: 'sub_' + Math.random().toString(36).substring(2, 9),
        name: s,
        createdAt: new Date().toISOString(),
      }));
      await dexieDb.subjects.bulkPut(subjectEntities);
    }
  } catch (error) {
    console.warn('Dexie initialization notice:', error);
  }
}

// Auto-trigger initialization in client environments
if (typeof window !== 'undefined') {
  initDexie();
}

/* =========================================================================
   STUDY SESSIONS CRUD (Dexie IndexedDB + Reactive Events)
   ========================================================================= */

/**
 * Get all study sessions, sorted by completedAt date descending.
 */
export function getSessions(): StudySession[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SESSIONS);
    if (!raw) return [];
    const sessions = JSON.parse(raw) as StudySession[];
    return sessions.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
  } catch (error) {
    console.error('Failed to parse sessions from storage', error);
    return [];
  }
}

/**
 * Asynchronously query sessions directly from Dexie IndexedDB.
 */
export async function getSessionsAsync(): Promise<StudySession[]> {
  if (!dexieDb) return getSessions();
  try {
    return await dexieDb.sessions.orderBy('completedAt').reverse().toArray();
  } catch {
    return getSessions();
  }
}

/**
 * Save a new study session to Dexie IndexedDB and update local reactive cache.
 */
export function saveSession(session: Omit<StudySession, 'id'>): StudySession {
  const newSession: StudySession = {
    ...session,
    id: Math.random().toString(36).substring(2, 11) + Date.now().toString(36),
  };

  const sessions = getSessions();
  sessions.unshift(newSession);
  localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessions));

  // Persist asynchronously into Dexie IndexedDB
  if (dexieDb) {
    dexieDb.sessions.put(newSession).catch(err => {
      console.error('Dexie saveSession error:', err);
    });
  }

  // Dispatch reactive update event
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('study-sessions-updated'));
  }

  return newSession;
}

/**
 * Delete a study session by ID from Dexie IndexedDB and local cache.
 */
export function deleteSession(id: string): void {
  const sessions = getSessions().filter(s => s.id !== id);
  localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessions));

  if (dexieDb) {
    dexieDb.sessions.delete(id).catch(err => {
      console.error('Dexie deleteSession error:', err);
    });
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('study-sessions-updated'));
  }
}

/**
 * Bulk import study sessions into Dexie IndexedDB.
 */
export function importSessions(newSessions: StudySession[], overwrite = false): number {
  let merged: StudySession[] = [];
  
  if (overwrite) {
    merged = [...newSessions];
  } else {
    const current = getSessions();
    const currentMap = new Map(current.map(s => [s.id, s]));
    newSessions.forEach(s => currentMap.set(s.id, s));
    merged = Array.from(currentMap.values());
  }

  localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(merged));

  if (dexieDb) {
    if (overwrite) {
      dexieDb.sessions.clear().then(() => dexieDb.sessions.bulkPut(merged)).catch(console.error);
    } else {
      dexieDb.sessions.bulkPut(newSessions).catch(console.error);
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('study-sessions-updated'));
  }

  return newSessions.length;
}

/* =========================================================================
   ADVANCED DEXIE ANALYTICS ENGINE
   ========================================================================= */

export interface SubjectAnalytics {
  subject: string;
  totalSeconds: number;
  formattedTime: string;
  sessionCount: number;
  averageSessionMinutes: number;
  percentageShare: number;
}

export interface DetailedAnalyticsSummary {
  totalSeconds: number;
  formattedTotalHours: string;
  sessionCount: number;
  dailyAverageMinutes: number;
  activeDaysCount: number;
  subjectAnalytics: SubjectAnalytics[];
  mostStudiedSubject: string;
  peakStudyHour: string;
  productivityScore: number;
}

/**
 * Calculate comprehensive analytics across all tracked study data using Dexie.
 */
export function calculateAnalyticsSummary(filterDays: number = 30, sessionsList?: StudySession[]): DetailedAnalyticsSummary {
  const allSessions = sessionsList !== undefined ? sessionsList : getSessions();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - filterDays);
  const cutoffTime = cutoff.getTime();

  const sessions = allSessions.filter(s => {
    if (s.mode !== 'focus') return false;
    return new Date(s.completedAt).getTime() >= cutoffTime;
  });

  const totalSeconds = sessions.reduce((sum, s) => sum + s.durationSeconds, 0);
  const sessionCount = sessions.length;

  // Breakdown by subject
  const subjectMap = new Map<string, { seconds: number; count: number }>();
  // Breakdown by hour of day
  const hourMap = new Map<number, number>();
  // Active unique dates
  const activeDates = new Set<string>();

  sessions.forEach(s => {
    // Subject stats
    const existing = subjectMap.get(s.subject) || { seconds: 0, count: 0 };
    subjectMap.set(s.subject, {
      seconds: existing.seconds + s.durationSeconds,
      count: existing.count + 1,
    });

    // Hour of day stats
    const d = new Date(s.completedAt);
    const hour = d.getHours();
    hourMap.set(hour, (hourMap.get(hour) || 0) + s.durationSeconds);

    // Active date
    const dateKey = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    activeDates.add(dateKey);
  });

  const subjectAnalytics: SubjectAnalytics[] = Array.from(subjectMap.entries())
    .map(([sub, data]) => {
      const mins = Math.round(data.seconds / 60);
      const hours = (data.seconds / 3600).toFixed(1);
      const share = totalSeconds > 0 ? Math.round((data.seconds / totalSeconds) * 100) : 0;
      return {
        subject: sub,
        totalSeconds: data.seconds,
        formattedTime: data.seconds >= 3600 ? `${hours} hrs` : `${mins} mins`,
        sessionCount: data.count,
        averageSessionMinutes: data.count > 0 ? Math.round((data.seconds / data.count) / 60) : 0,
        percentageShare: share,
      };
    })
    .sort((a, b) => b.totalSeconds - a.totalSeconds);

  // Peak study hour calculation
  let peakHour = 9;
  let maxHourSecs = 0;
  hourMap.forEach((secs, hour) => {
    if (secs > maxHourSecs) {
      maxHourSecs = secs;
      peakHour = hour;
    }
  });

  const formattedPeakHour = `${peakHour.toString().padStart(2, '0')}:00 - ${(peakHour + 1).toString().padStart(2, '0')}:00`;
  const activeDaysCount = Math.max(1, activeDates.size);
  const dailyAverageMinutes = Math.round((totalSeconds / Math.min(filterDays, activeDaysCount)) / 60);

  return {
    totalSeconds,
    formattedTotalHours: (totalSeconds / 3600).toFixed(1),
    sessionCount,
    dailyAverageMinutes,
    activeDaysCount: activeDates.size,
    subjectAnalytics,
    mostStudiedSubject: subjectAnalytics[0]?.subject || 'None',
    peakStudyHour: maxHourSecs > 0 ? formattedPeakHour : 'Afternoon',
    productivityScore: Math.min(100, Math.round((totalSeconds / (filterDays * 7200)) * 100)),
  };
}

/* =========================================================================
   SUBJECTS CRUD
   ========================================================================= */

export function getSubjects(): string[] {
  if (typeof window === 'undefined') return ['General'];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SUBJECTS);
    if (!raw) return ['General'];
    const subjects = JSON.parse(raw) as string[];
    if (!subjects.includes('General')) {
      subjects.unshift('General');
    }
    return subjects;
  } catch {
    return ['General'];
  }
}

export function saveSubject(subject: string): void {
  const trimmed = subject.trim();
  if (!trimmed) return;
  const subjects = getSubjects();
  if (!subjects.includes(trimmed)) {
    subjects.push(trimmed);
    localStorage.setItem(STORAGE_KEY_SUBJECTS, JSON.stringify(subjects));

    if (dexieDb) {
      dexieDb.subjects.put({
        id: 'sub_' + Math.random().toString(36).substring(2, 9),
        name: trimmed,
        createdAt: new Date().toISOString(),
      }).catch(console.error);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('study-subjects-updated'));
    }
  }
}

export function deleteSubject(subject: string): void {
  if (subject === 'General') return;
  const subjects = getSubjects().filter(s => s !== subject);
  localStorage.setItem(STORAGE_KEY_SUBJECTS, JSON.stringify(subjects));

  if (dexieDb) {
    dexieDb.subjects.where('name').equals(subject).delete().catch(console.error);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('study-subjects-updated'));
  }
}

/* =========================================================================
   TASK / TO-DO LIST CRUD (Dexie IndexedDB Backed)
   ========================================================================= */

export function getTasks(): StudyTask[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TASKS);
    if (!raw) return [];
    return JSON.parse(raw) as StudyTask[];
  } catch {
    return [];
  }
}

export function saveTask(task: Omit<StudyTask, 'id' | 'createdAt' | 'actPomodoros' | 'completed'>): StudyTask {
  const newTask: StudyTask = {
    ...task,
    id: 'task_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
    actPomodoros: 0,
    completed: false,
    createdAt: new Date().toISOString(),
  };

  const tasks = getTasks();
  tasks.unshift(newTask);
  localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(tasks));

  if (dexieDb) {
    dexieDb.tasks.put(newTask).catch(console.error);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('study-tasks-updated'));
  }

  return newTask;
}

export function updateTask(id: string, updates: Partial<StudyTask>): void {
  const tasks = getTasks().map(task => {
    if (task.id === id) {
      const updated = { ...task, ...updates };
      if (updates.completed !== undefined) {
        updated.completedAt = updates.completed ? new Date().toISOString() : undefined;
      }
      return updated;
    }
    return task;
  });

  localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(tasks));

  if (dexieDb) {
    dexieDb.tasks.update(id, updates).catch(console.error);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('study-tasks-updated'));
  }
}

export function deleteTask(id: string): void {
  const tasks = getTasks().filter(t => t.id !== id);
  localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(tasks));

  if (dexieDb) {
    dexieDb.tasks.delete(id).catch(console.error);
  }

  if (getActiveTaskId() === id) {
    setActiveTaskId(null);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('study-tasks-updated'));
  }
}

export function incrementTaskPomodoro(id: string): void {
  const tasks = getTasks().map(task => {
    if (task.id === id) {
      return { ...task, actPomodoros: task.actPomodoros + 1 };
    }
    return task;
  });

  localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(tasks));

  if (dexieDb) {
    dexieDb.tasks.get(id).then(existing => {
      if (existing) {
        dexieDb.tasks.update(id, { actPomodoros: existing.actPomodoros + 1 });
      }
    }).catch(console.error);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('study-tasks-updated'));
  }
}

export function getActiveTaskId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACTIVE_TASK_KEY);
}

export function setActiveTaskId(id: string | null): void {
  if (typeof window === 'undefined') return;
  if (id) {
    localStorage.setItem(ACTIVE_TASK_KEY, id);
  } else {
    localStorage.removeItem(ACTIVE_TASK_KEY);
  }
  window.dispatchEvent(new Event('study-active-task-updated'));
}

/* =========================================================================
   WEEKLY HABITS TRACKER CRUD (Dexie IndexedDB Backed)
   ========================================================================= */

export function getHabits(): StudyHabit[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_HABITS);
    if (!raw) {
      const defaultHabits: StudyHabit[] = [
        {
          id: 'habit_1',
          title: 'Daily Deep Focus (2+ hrs)',
          category: 'Focus',
          targetDaysPerWeek: 5,
          history: {},
          createdAt: new Date().toISOString(),
        },
        {
          id: 'habit_2',
          title: 'Review Lecture / Book Notes',
          category: 'Revision',
          targetDaysPerWeek: 4,
          history: {},
          createdAt: new Date().toISOString(),
        },
        {
          id: 'habit_3',
          title: 'Solve Practice Problems',
          category: 'Practice',
          targetDaysPerWeek: 5,
          history: {},
          createdAt: new Date().toISOString(),
        }
      ];
      localStorage.setItem(STORAGE_KEY_HABITS, JSON.stringify(defaultHabits));
      if (dexieDb) {
        dexieDb.habits.bulkPut(defaultHabits).catch(console.error);
      }
      return defaultHabits;
    }
    return JSON.parse(raw) as StudyHabit[];
  } catch {
    return [];
  }
}

export function saveHabit(habit: Omit<StudyHabit, 'id' | 'createdAt' | 'history'>): StudyHabit {
  const newHabit: StudyHabit = {
    ...habit,
    id: 'habit_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
    history: {},
    createdAt: new Date().toISOString(),
  };

  const habits = getHabits();
  habits.push(newHabit);
  localStorage.setItem(STORAGE_KEY_HABITS, JSON.stringify(habits));

  if (dexieDb) {
    dexieDb.habits.put(newHabit).catch(console.error);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('study-habits-updated'));
  }

  return newHabit;
}

export function toggleHabitDate(id: string, dateKey: string): void {
  const habits = getHabits().map(h => {
    if (h.id === id) {
      const updatedHistory = { ...h.history };
      if (updatedHistory[dateKey]) {
        delete updatedHistory[dateKey];
      } else {
        updatedHistory[dateKey] = true;
      }
      const updated = { ...h, history: updatedHistory };
      if (dexieDb) {
        dexieDb.habits.update(id, { history: updatedHistory }).catch(console.error);
      }
      return updated;
    }
    return h;
  });

  localStorage.setItem(STORAGE_KEY_HABITS, JSON.stringify(habits));

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('study-habits-updated'));
  }
}

export function deleteHabit(id: string): void {
  const habits = getHabits().filter(h => h.id !== id);
  localStorage.setItem(STORAGE_KEY_HABITS, JSON.stringify(habits));

  if (dexieDb) {
    dexieDb.habits.delete(id).catch(console.error);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('study-habits-updated'));
  }
}

export function calculateHabitStreak(habit: StudyHabit): number {
  let streak = 0;
  const now = new Date();
  
  const formatDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayKey = formatDate(now);
  const checkDate = new Date(now);

  if (habit.history[todayKey]) {
    streak = 1;
    checkDate.setDate(checkDate.getDate() - 1);
  } else {
    checkDate.setDate(checkDate.getDate() - 1);
    const yesterdayKey = formatDate(checkDate);
    if (habit.history[yesterdayKey]) {
      streak = 1;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      return 0;
    }
  }

  while (true) {
    const key = formatDate(checkDate);
    if (habit.history[key]) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

/* =========================================================================
   TIMER PREFERENCES
   ========================================================================= */

export interface TimerPreferences {
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
  timerType: 'pomodoro' | 'stopwatch';
  selectedFocusPreset: number;
  selectedSubject?: string;
}

const TIMER_PREFS_KEY = 'study_tracker_timer_prefs';

export function getTimerPreferences(): TimerPreferences {
  const defaults: TimerPreferences = {
    autoStartBreaks: false,
    autoStartFocus: false,
    timerType: 'pomodoro',
    selectedFocusPreset: 25,
    selectedSubject: 'General',
  };

  if (typeof window === 'undefined') return defaults;

  try {
    const raw = localStorage.getItem(TIMER_PREFS_KEY);
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
}

export function saveTimerPreferences(prefs: Partial<TimerPreferences>): TimerPreferences {
  const current = getTimerPreferences();
  const updated = { ...current, ...prefs };
  if (typeof window !== 'undefined') {
    localStorage.setItem(TIMER_PREFS_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event('study-timer-prefs-updated'));
  }
  return updated;
}

/* =========================================================================
   MARKDOWN & SQL EXPORT / IMPORT HELPERS
   ========================================================================= */

export function exportToMarkdown(sessions: StudySession[]): string {
  const tableRows = sessions.map(s => {
    const date = new Date(s.completedAt).toLocaleString();
    const durationMins = (s.durationSeconds / 60).toFixed(1);
    const modeLabel = s.mode === 'focus' ? 'Focus' : s.mode === 'shortBreak' ? 'Short Break' : 'Long Break';
    return `| ${s.id} | ${s.subject.replace(/\|/g, '\\|')} | ${durationMins} | ${date} | ${modeLabel} |`;
  });

  const content = [
    '# Study Tracker History',
    '',
    `Exported on: ${new Date().toLocaleString()}`,
    `Total sessions: ${sessions.length}`,
    '',
    '| ID | Subject | Duration (minutes) | Completed At | Mode |',
    '| --- | --- | --- | --- | --- |',
    ...tableRows,
    '',
    '<!-- STUDY_TRACKER_RAW_DATA:',
    JSON.stringify(sessions, null, 2),
    '-->',
  ].join('\n');

  return content;
}

export function importFromMarkdown(text: string): StudySession[] {
  const commentMatch = text.match(/<!-- STUDY_TRACKER_RAW_DATA:\s*([\s\S]*?)\s*-->/);
  if (commentMatch && commentMatch[1]) {
    try {
      const data = JSON.parse(commentMatch[1]) as StudySession[];
      if (Array.isArray(data)) return data;
    } catch (e) {
      console.warn('Found raw JSON in markdown but failed to parse it.', e);
    }
  }

  const lines = text.split('\n');
  const parsedSessions: StudySession[] = [];

  for (const line of lines) {
    if (line.trim().startsWith('|') && !line.includes('---') && !line.toLowerCase().includes('duration (minutes)')) {
      const parts = line.split('|').map(p => p.trim());
      if (parts.length >= 6) {
        const id = parts[1] || Math.random().toString(36).substring(2, 11);
        const subject = parts[2] || 'General';
        const durationMins = parseFloat(parts[3]) || 25;
        const dateStr = parts[4];
        const modeStr = parts[5].toLowerCase();

        let completedAt = new Date().toISOString();
        if (dateStr) {
          const parsedDate = new Date(dateStr);
          if (!isNaN(parsedDate.getTime())) {
            completedAt = parsedDate.toISOString();
          }
        }

        let mode: 'focus' | 'shortBreak' | 'longBreak' = 'focus';
        if (modeStr.includes('short')) mode = 'shortBreak';
        else if (modeStr.includes('long')) mode = 'longBreak';

        parsedSessions.push({
          id,
          subject,
          durationSeconds: Math.round(durationMins * 60),
          completedAt,
          mode,
        });
      }
    }
  }

  return parsedSessions;
}

export function exportToSqlDump(sessions: StudySession[]): string {
  const schema = [
    '-- Study Tracker SQLite Export (Dexie IndexedDB Backed)',
    '-- Generated at: ' + new Date().toISOString(),
    '',
    'CREATE TABLE IF NOT EXISTS study_sessions (',
    '  id TEXT PRIMARY KEY,',
    '  subject TEXT,',
    '  duration_seconds INTEGER,',
    '  completed_at TEXT,',
    '  mode TEXT',
    ');',
    '',
  ].join('\n');

  const escapeSql = (str: string) => str.replace(/'/g, "''");

  const inserts = sessions.map(s => {
    return `INSERT OR REPLACE INTO study_sessions (id, subject, duration_seconds, completed_at, mode) VALUES ('${escapeSql(s.id)}', '${escapeSql(s.subject)}', ${s.durationSeconds}, '${escapeSql(s.completedAt)}', '${s.mode}');`;
  }).join('\n');

  return schema + inserts + '\n';
}

export function importFromSqlDump(text: string): StudySession[] {
  const sessions: StudySession[] = [];
  const insertRegex = /VALUES\s*\(\s*'([^']+)'\s*,\s*'([^']*)'\s*,\s*(\d+)\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*\)/gi;
  let match;
  const cleanedText = text.replace(/--.*$/gm, '');

  while ((match = insertRegex.exec(cleanedText)) !== null) {
    const id = match[1];
    const subject = match[2];
    const durationSecs = match[3];
    const completedAt = match[4];
    const mode = match[5];
    
    let validMode: 'focus' | 'shortBreak' | 'longBreak' = 'focus';
    if (mode === 'shortBreak' || mode === 'longBreak') {
      validMode = mode;
    }

    sessions.push({
      id,
      subject: subject.replace(/''/g, "'"),
      durationSeconds: parseInt(durationSecs, 10),
      completedAt: new Date(completedAt).toISOString(),
      mode: validMode,
    });
  }

  return sessions;
}
