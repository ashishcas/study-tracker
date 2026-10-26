# ⏱️ StudiesTimer • Aesthetic Study Tracker & Productivity Suite

A sleek, minimalist Pomodoro timer, weekly habit builder, task planner, and productivity analytics dashboard built with **Next.js 16**, **TypeScript**, and **Dexie.js (IndexedDB)**.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-prompt--forge.in-orange?style=for-the-badge&logo=vercel)](https://prompt-forge.in)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org)
[![Dexie.js](https://img.shields.io/badge/Database-Dexie.js%20(IndexedDB)-purple?style=for-the-badge)](https://dexie.org)

---

## ✨ Features

### 🍅 Expansive Sleek Hero Timer & Zen View
- **Hero Screen Display**: A minimal `~90vh` timer with geometric typography, slender SVG progress ring, and ambient breathing halo.
- **Zen View**: One-click distraction-free fullscreen mode (press <kbd>F</kbd> or click **Zen View**).
- **Flexible Modes**: Switch seamlessly between Pomodoro (Focus, Short Break, Long Break) and an open Stopwatch timer.
- **Preset Durations**: 15m, 25m, 30m, 45m, and 60m focus blocks with optional auto-start breaks.

### ⚡ 1-Click Instant "Stop & Record"
- Study for whatever time you have (even 10 minutes) and click **"■ Stop & Record"**.
- Automatically saves your study time tagged directly to your selected subject into IndexedDB — **no confirmation prompts or repetitive inputs required**.
- **Subject Persistence**: Once you pick a subject, it stays saved across reloads. When the timer starts, the dropdown switches to a clean `● [Subject]` active label.

### 💾 Dexie.js IndexedDB Persistence & Privacy
- **Local Data Ownership**: All study sessions, tasks, habits, and subjects are indexed client-side using [Dexie.js](https://dexie.org).
- **Zero Cloud Tracking**: Works 100% offline with zero latency and zero external analytics tracking.
- **Dual-Layer Synchronization**: Instant UI rendering combined with persistent background IndexedDB transactions.

### 📊 Productivity Analytics & Visualization
- **Overview Stat Cards**: Total study hours, daily average focus minutes, peak productivity hour (e.g. `14:00 - 15:00`), and daily study streak 🔥.
- **Interactive 7-Day Bar Chart**: SVG daily study hour visualization with floating hover tooltips.
- **Subject Distribution**: Percentage share breakdown and duration bars across subjects.
- **GitHub-Style Contribution Heatmap**: 30-day, 60-day, or annual study activity grid with custom intensity coloring.

### 🎯 Task Planning & Weekly Habits Tracker
- **Task Milestones**: Create study tasks with estimated vs. actual Pomodoro tracking (🍅). Link any task to the active timer with one click.
- **Weekly Habit Builder**: Inspired by *StudiesTimer*, monitor Monday–Sunday daily routines, track completion percentages, and build consistency streaks.

### 🗄️ Backup & Restore
- **Markdown Export (`.md`)**: Export your entire focus log into formatted markdown tables.
- **SQL Dump Export (`.sql`)**: Generate raw SQLite DDL and INSERT statements.
- **Dropzone Import**: Restore or merge logs from previously exported files anytime.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>Space</kbd> | Start / Pause Timer |
| <kbd>F</kbd> | Toggle Zen Fullscreen Mode |
| <kbd>Esc</kbd> | Exit Zen Mode / Close Modals |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18.18+ or 20+
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/ashishcas/study-tracker.git
   cd study-tracker
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript
- **Database**: [Dexie.js v4](https://www.npmjs.com/package/dexie) (IndexedDB Wrapper)
- **Styling**: Vanilla CSS (Custom tokens, glassmorphism, responsive animations)
- **Audio**: Web Audio API synthesized focus chimes (no external audio assets required)
- **CI/CD**: GitHub Actions deploying static export to GitHub Pages

---

## 🌐 Custom Domain Deployment

This project is deployed to GitHub Pages and custom domains using static HTML export:

1. **Build Static Bundle**:
   ```bash
   npm run build
   ```
2. The static output is generated in `/out`.
3. Automated deployment is handled by [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) on push to `main`.

---

## 📄 License

MIT License © 2026 [Ashish Chiluka](https://github.com/ashishcas)
