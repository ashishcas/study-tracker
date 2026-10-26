'use client';

import React, { useState, useRef } from 'react';
import {
  getSessions,
  importSessions,
  exportToMarkdown,
  importFromMarkdown,
  exportToSqlDump,
  importFromSqlDump,
  StudySession
} from '../lib/db';

interface BackupPanelProps {
  onBackupImported: () => void;
}

export default function BackupPanel({ onBackupImported }: BackupPanelProps) {
  const [importMode, setImportMode] = useState<'merge' | 'overwrite'>('merge');
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const triggerDownload = (content: string, filename: string, contentType: string) => {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportMarkdown = () => {
    const sessions = getSessions();
    const md = exportToMarkdown(sessions);
    const dateStr = new Date().toISOString().split('T')[0];
    triggerDownload(md, `study_history_${dateStr}.md`, 'text/markdown;charset=utf-8');
  };

  const handleExportSql = () => {
    const sessions = getSessions();
    const sql = exportToSqlDump(sessions);
    const dateStr = new Date().toISOString().split('T')[0];
    triggerDownload(sql, `study_history_${dateStr}.sql`, 'text/plain;charset=utf-8');
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) {
        setImportStatus({ type: 'error', message: 'Failed to read file content.' });
        return;
      }

      let parsedSessions: StudySession[] = [];
      const extension = file.name.split('.').pop()?.toLowerCase();

      try {
        if (extension === 'md') {
          parsedSessions = importFromMarkdown(text);
        } else if (extension === 'sql') {
          parsedSessions = importFromSqlDump(text);
        } else {
          setImportStatus({ type: 'error', message: 'Unsupported file format. Please upload a .md or .sql file.' });
          return;
        }

        if (parsedSessions.length === 0) {
          setImportStatus({
            type: 'error',
            message: `No study sessions found in the ${extension === 'md' ? 'Markdown table' : 'SQL insert statements'}.`
          });
          return;
        }

        importSessions(parsedSessions, importMode === 'overwrite');
        setImportStatus({
          type: 'success',
          message: `Successfully imported ${parsedSessions.length} session logs (${importMode === 'overwrite' ? 'overwrote' : 'merged with'} current database)!`
        });
        
        onBackupImported();
      } catch (err) {
        console.error('Import failed:', err);
        setImportStatus({ type: 'error', message: 'Error occurred during parsing. Check console for details.' });
      }
    };

    reader.onerror = () => {
      setImportStatus({ type: 'error', message: 'File read error.' });
    };

    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleResetDb = () => {
    const conf1 = confirm('WARNING: You are about to clear all study sessions from this browser database. This cannot be undone unless you have exported a backup. Continue?');
    if (conf1) {
      const conf2 = confirm('Double Confirmation: Are you absolutely certain you want to wipe the local study history database?');
      if (conf2) {
        localStorage.removeItem('study_tracker_sessions');
        window.dispatchEvent(new Event('study-sessions-updated'));
        setImportStatus({ type: 'success', message: 'Database wiped successfully.' });
        onBackupImported();
      }
    }
  };

  return (
    <div className="backup-panel-grid">
      {/* Exporter Section */}
      <div className="backup-box glass-card exporter-box">
        <h3>Database Backup (Export)</h3>
        <p>Save your study sessions to a local file. Use this to transfer data between browsers or keep offline records.</p>
        
        <div className="export-actions">
          <button className="btn btn-secondary btn-export-md" onClick={handleExportMarkdown}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m.75 12 3 3m0 0 3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            Export to Markdown (.md)
          </button>
          
          <button className="btn btn-secondary btn-export-sql" onClick={handleExportSql}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0v3.75" />
            </svg>
            Export SQLite SQL Dump (.sql)
          </button>
        </div>

        <div className="danger-zone">
          <h4>Danger Zone</h4>
          <button className="btn btn-danger" onClick={handleResetDb}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
            Reset Local Database
          </button>
        </div>
      </div>

      {/* Importer Section */}
      <div className="backup-box glass-card importer-box">
        <h3>Restore Database (Import)</h3>
        <p>Upload a previously exported `.md` or `.sql` study log to recover your history.</p>

        {/* Sync Mode Settings */}
        <div className="import-mode-selector">
          <span className="mode-label font-semibold">Import Strategy:</span>
          <label className="radio-label">
            <input 
              type="radio" 
              name="importMode" 
              value="merge" 
              checked={importMode === 'merge'} 
              onChange={() => setImportMode('merge')} 
            />
            Merge (Keep existing, add new)
          </label>
          <label className="radio-label">
            <input 
              type="radio" 
              name="importMode" 
              value="overwrite" 
              checked={importMode === 'overwrite'} 
              onChange={() => setImportMode('overwrite')} 
            />
            Overwrite (Replace database)
          </label>
        </div>

        {/* Drag and Drop Zone */}
        <div 
          className={`dropzone ${dragOver ? 'drag-over' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept=".md,.sql" 
            style={{ display: 'none' }}
          />
          <svg className="dropzone-icon" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
          </svg>
          <p className="font-semibold">Drag & Drop file here, or click to browse</p>
          <span className="file-hint">Accepts .md and .sql exported database logs</span>
        </div>

        {/* Import Status Alert */}
        {importStatus && (
          <div className={`import-alert alert-${importStatus.type}`}>
            {importStatus.type === 'success' ? (
              <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.401 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
              </svg>
            )}
            <span>{importStatus.message}</span>
          </div>
        )}
      </div>
    </div>
  );
}
