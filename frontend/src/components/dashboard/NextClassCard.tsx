import React, { useEffect, useState } from 'react';
import { apiClient } from '../../lib/api';

interface ClassSlot {
  subject: string;
  room: string;
  start_time: string;
  end_time: string;
  faculty_name?: string;
  kind?: string;
}

interface NextClassData {
  status: 'active' | 'upcoming_day' | 'no_classes' | 'no_timetable';
  ongoing?: ClassSlot | null;
  next_class?: ClassSlot | null;
  is_today?: boolean;
  day_name?: string;
  target_date?: string;
  message?: string;
}

export const NextClassCard: React.FC = () => {
  const [data, setData] = useState<NextClassData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchNextClass = async () => {
    try {
      const res = await apiClient.get('/api/dashboard/next-class');
      setData(res.data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load next class:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNextClass();
    const interval = setInterval(fetchNextClass, 60000); // 1-minute live tick
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="card loading-card">Checking schedule in live IST...</div>;
  }

  if (!data || data.status === 'no_classes' || data.status === 'no_timetable') {
    return (
      <div className="card next-class-card empty">
        <div className="card-header">
          <h3>Academic Schedule</h3>
          <span className="live-pill">LIVE IST</span>
        </div>
        <p className="empty-msg">
          {data?.message || 'No upcoming classes scheduled. Enjoy your break!'}
        </p>
      </div>
    );
  }

  const { ongoing, next_class, is_today, day_name } = data;

  return (
    <div className="card next-class-card">
      <div className="card-header">
        <h3>{is_today ? "Today's Schedule" : `Next Class: ${day_name}`}</h3>
        <span className="live-pill">LIVE IST</span>
      </div>

      {ongoing && (
        <div className="slot ongoing-slot">
          <div className="badge-row">
            <span className="badge ongoing-badge">● HAPPENING NOW</span>
            {ongoing.kind && <span className="kind-badge">{ongoing.kind.toUpperCase()}</span>}
          </div>
          <h4>{ongoing.subject}</h4>
          <p className="slot-meta">
            Room: <strong>{ongoing.room || 'TBA'}</strong> | Ends at {ongoing.end_time.slice(0, 5)}
          </p>
        </div>
      )}

      {next_class && (
        <div className="slot upcoming-slot">
          <div className="badge-row">
            <span className="badge upcoming-badge">{ongoing ? 'UP NEXT' : 'NEXT UP'}</span>
            {next_class.kind && <span className="kind-badge">{next_class.kind.toUpperCase()}</span>}
          </div>
          <h4>{next_class.subject}</h4>
          <p className="slot-meta">
            Time: <strong>{next_class.start_time.slice(0, 5)} – {next_class.end_time.slice(0, 5)}</strong> | Room: <strong>{next_class.room || 'TBA'}</strong>
          </p>
          {next_class.faculty_name && (
            <p className="faculty-meta">Faculty: {next_class.faculty_name}</p>
          )}
        </div>
      )}
    </div>
  );
};
