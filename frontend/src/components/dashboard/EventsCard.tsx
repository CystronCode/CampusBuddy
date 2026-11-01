import React, { useState, useEffect } from 'react';
import { apiClient } from '../../lib/api';

interface CampusEvent {
  id: number;
  title: string;
  club: string;
  description?: string;
  venue?: string;
  starts_at?: string;
  ends_at?: string;
  valid_until?: string;
}

export const EventsCard: React.FC = () => {
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [selectedClub, setSelectedClub] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedClub) params.append('club', selectedClub);

      const res = await apiClient.get(`/api/events?${params.toString()}`);
      setEvents(res.data.events || []);
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [selectedClub]);

  const uniqueClubs = Array.from(new Set(events.map((e) => e.club))).filter(Boolean);

  return (
    <div className="card events-card">
      <div className="card-header">
        <h3>Campus Events & Posters</h3>
        {uniqueClubs.length > 0 && (
          <select
            className="club-select"
            value={selectedClub}
            onChange={(e) => setSelectedClub(e.target.value)}
          >
            <option value="">All Clubs</option>
            {uniqueClubs.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
      </div>

      <div className="events-grid">
        {loading ? (
          <p className="status-text">Checking for active posters & events...</p>
        ) : events.length === 0 ? (
          <p className="no-items">No active campus events found at this time.</p>
        ) : (
          events.map((ev) => (
            <div key={ev.id} className="event-item">
              <div className="event-badge">{ev.club}</div>
              <h4>{ev.title}</h4>
              {ev.description && <p className="event-desc">{ev.description}</p>}
              <div className="event-footer">
                <span>📍 {ev.venue || 'Campus Auditorium'}</span>
                {ev.starts_at && (
                  <span>🕒 {new Date(ev.starts_at).toLocaleDateString()}</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
