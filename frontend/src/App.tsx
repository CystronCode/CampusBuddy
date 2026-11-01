import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { apiClient, setColdStartNoticeListener } from './lib/api';
import { LoginView } from './components/auth/LoginView';
import { OnboardingModal } from './components/auth/OnboardingModal';
import { NextClassCard } from './components/dashboard/NextClassCard';
import { MessMenuCard } from './components/dashboard/MessMenuCard';
import { TimetableCard } from './components/dashboard/TimetableCard';
import { EventsCard } from './components/dashboard/EventsCard';
import { ChatView } from './components/chat/ChatView';
import { SubmissionReviewDetail } from './components/admin/SubmissionReviewDetail';
import { UploadCard } from './components/admin/UploadCard';
import { BrowseView } from './components/browse/BrowseView';
import { SettingsView } from './components/settings/SettingsView';
import {
  LayoutDashboard,
  Compass,
  MessagesSquare,
  Settings as SettingsIcon,
  ClipboardList
} from 'lucide-react';

export const App: React.FC = () => {
  const { user, loading, profileComplete, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'browse' | 'chat' | 'settings' | 'review'>('dashboard');
  const [coldStartNotice, setColdStartNotice] = useState(false);
  const [reviewSubmissionId, setReviewSubmissionId] = useState('');
  const [submissionsList, setSubmissionsList] = useState<any[]>([]);

  const fetchSubmissions = async () => {
    try {
      const res = await apiClient.get('/api/submissions?limit=15');
      if (res.data && res.data.length > 0) {
        setSubmissionsList(res.data);
        if (!reviewSubmissionId) {
          setReviewSubmissionId(res.data[0].id);
        }
      }
    } catch (err) {
      console.warn('Could not load submissions queue:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'review') {
      fetchSubmissions();
      const interval = setInterval(() => {
        // Auto-refresh queue if any item is still processing
        if (submissionsList.some((s) => s.status === 'processing')) {
          fetchSubmissions();
        }
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [activeTab, submissionsList]);

  useEffect(() => {
    setColdStartNoticeListener((isSlow) => {
      setColdStartNotice(isSlow);
      if (isSlow) {
        setTimeout(() => setColdStartNotice(false), 8000);
      }
    });
  }, []);

  if (loading) {
    return (
      <div className="splash-screen">
        <div className="spinner"></div>
        <h2>Campus Intelligence</h2>
        <p>Connecting to campus systems...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  return (
    <div className="app-shell">
      {/* Cold Start Banner */}
      {coldStartNotice && (
        <div className="cold-start-banner">
          ⏳ Waking up campus server from container sleep... thank you for your patience!
        </div>
      )}

      {/* Blocking Onboarding Modal */}
      {!profileComplete && <OnboardingModal />}

      {/* App Header */}
      <header className="app-header">
        <div className="header-brand">
          <h1>Campus Intelligence</h1>
          <span className="user-badge">{user.role.toUpperCase()}</span>
        </div>
        <div className="header-meta">
          {user.branch && user.section && (
            <span className="profile-pill">
              {user.branch}-{user.year}-{user.section}
            </span>
          )}
          <button className="logout-btn" onClick={logout} title="Sign Out">
            Logout
          </button>
        </div>
      </header>

      {/* Navigation Bar */}
      <nav className="app-nav" style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
        <button
          className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <LayoutDashboard size={18} />
          Dashboard
        </button>
        <button
          className={`nav-btn ${activeTab === 'browse' ? 'active' : ''}`}
          onClick={() => setActiveTab('browse')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Compass size={18} />
          Explore Campus
        </button>
        <button
          className={`nav-btn ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <MessagesSquare size={18} />
          Campus AI
        </button>
        <button
          className={`nav-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <SettingsIcon size={18} />
          Preferences
        </button>
        {(user.role === 'admin' || user.role === 'staff') && (
          <button
            className={`nav-btn ${activeTab === 'review' ? 'active' : ''}`}
            onClick={() => setActiveTab('review')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <ClipboardList size={18} />
            Review Queue
          </button>
        )}
      </nav>

      {/* Main Content View */}
      <main className="app-main">
        {activeTab === 'dashboard' && (
          <div className="dashboard-grid">
            <NextClassCard />
            <MessMenuCard />
            <TimetableCard />
            <EventsCard />
          </div>
        )}

        {activeTab === 'browse' && <BrowseView />}

        {activeTab === 'chat' && <ChatView />}

        {activeTab === 'settings' && <SettingsView />}

        {activeTab === 'review' && (
          <div className="review-view">
            <UploadCard
              onUploadSuccess={(newSubId) => {
                setReviewSubmissionId(newSubId);
                fetchSubmissions();
              }}
            />

            {submissionsList.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '1.5rem',
                  padding: '12px 16px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                }}
              >
                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}>
                  📑 Document Ingestion Queue:
                </span>
                <select
                  value={reviewSubmissionId}
                  onChange={(e) => setReviewSubmissionId(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem',
                    background: '#ffffff',
                    fontWeight: 500,
                  }}
                >
                  {submissionsList.map((s) => {
                    let count = 0;
                    if (Array.isArray(s.extracted)) count = s.extracted.length;
                    else if (s.extracted && typeof s.extracted === 'object') {
                      count = (s.extracted.slots || s.extracted.items || s.extracted.holidays || s.extracted.faculty || []).length;
                    }
                    return (
                      <option key={s.id} value={s.id}>
                        [{s.data_type?.toUpperCase()}] {s.scope || s.data_type} — {s.status.toUpperCase()} ({count} rows) ({new Date(s.created_at).toLocaleTimeString()})
                      </option>
                    );
                  })}
                </select>
                <button
                  onClick={fetchSubmissions}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '6px',
                    background: '#e2e8f0',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                  }}
                >
                  🔄 Refresh Queue
                </button>
              </div>
            )}

            {reviewSubmissionId && reviewSubmissionId !== 'demo-sub-id' && (
              <SubmissionReviewDetail
                key={reviewSubmissionId}
                submissionId={reviewSubmissionId}
                onExtractionComplete={fetchSubmissions}
                onApproveSuccess={() => {
                  fetchSubmissions();
                  setActiveTab('dashboard');
                }}
                onRejectSuccess={() => {
                  fetchSubmissions();
                }}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
};
