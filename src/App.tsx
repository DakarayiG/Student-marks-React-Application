import React, { useEffect, useState } from 'react';
import { Provider } from 'react-redux';
import { store, clearAll, loadTests } from './store';
import { useAppDispatch, useAppSelector } from './hooks/redux';
import Upload from './components/Upload/Upload';
import ClassDashboard from './components/Dashboard/ClassDashboard';
import StudentDashboard from './components/Dashboard/StudentDashboard';
import ExamComparison from './components/Dashboard/ExamComparison';
import './App.css';

const PAGES = [
  { id: 'upload', icon: '⬆', title: 'Upload PDFs', Component: Upload },
  { id: 'class', icon: '📊', title: 'Class Analytics', Component: ClassDashboard },
  { id: 'student', icon: '👤', title: 'Student Progress', Component: StudentDashboard },
  { id: 'exam', icon: '📈', title: 'Tests & Exam', Component: ExamComparison },
];

function AppInner() {
  const [pageId, setPageId] = useState('upload');
  const page = PAGES.find((p) => p.id === pageId)!;
  const dispatch = useAppDispatch();
  const { status, error } = useAppSelector((s) => s.marks);

  useEffect(() => {
    dispatch(loadTests());
  }, [dispatch]);

  const handleClear = () => {
    if (window.confirm('Delete all uploaded data? This cannot be undone.')) dispatch(clearAll());
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">M</div>
          <div>
            <div className="logo-title">MarkTrack</div>
            <div className="logo-sub">Academic Analytics</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {PAGES.map((p) => (
            <button key={p.id} className={`nav-btn ${p.id === pageId ? 'nav-btn-active' : ''}`} onClick={() => setPageId(p.id)}>
              <span className="nav-icon">{p.icon}</span>
              <span>{p.title}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span>v1.0 · Data saved in MySQL</span>
        </div>
      </aside>

      <main className="main-content">
        <div className="topbar">
          <h2 className="topbar-title">{page.title}</h2>
          <button className="btn btn-ghost btn-sm" onClick={handleClear}>
            🗑 Clear all data
          </button>
        </div>

        {status === 'failed' && (
          <div className="db-error-banner">
            ⚠ Could not reach the database: {error}. Is the API server running (
            <code>cd server && npm run dev</code>)?
          </div>
        )}

        <div className="page-content">
          {status === 'loading' && pageId !== 'upload' ? (
            <div className="empty-state"><p>Loading data…</p></div>
          ) : (
            <page.Component />
          )}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <AppInner />
    </Provider>
  );
}
