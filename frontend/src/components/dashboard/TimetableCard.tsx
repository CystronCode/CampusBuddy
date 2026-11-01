import React, { useState, useEffect } from 'react';
import { apiClient } from '../../lib/api';

interface Slot {
  id?: number;
  day: number;
  start_time: string;
  end_time: string;
  subject: string;
  kind?: string;
  room?: string;
  short_code?: string;
}

const WEEKDAYS = [
  { num: 1, label: 'Mon' },
  { num: 2, label: 'Tue' },
  { num: 3, label: 'Wed' },
  { num: 4, label: 'Thu' },
  { num: 5, label: 'Fri' },
  { num: 6, label: 'Sat' },
];

export const TimetableCard: React.FC = () => {
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay() || 1);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTimetable = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/timetable?scope=week');
      setSlots(res.data.slots || []);
    } catch (err) {
      console.error('Failed to load timetable:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimetable();
  }, []);

  const daySlots = slots
    .filter((s) => s.day === selectedDay)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  return (
    <div className="card timetable-card">
      <div className="card-header">
        <h3>Class Timetable</h3>
        <div className="day-selector">
          {WEEKDAYS.map((d) => (
            <button
              key={d.num}
              className={`day-btn ${selectedDay === d.num ? 'active' : ''}`}
              onClick={() => setSelectedDay(d.num)}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="slots-timeline">
        {loading ? (
          <p className="status-text">Loading timetable slots...</p>
        ) : daySlots.length === 0 ? (
          <p className="no-items">No classes scheduled on this day.</p>
        ) : (
          daySlots.map((slot, i) => (
            <div key={i} className="timeline-item">
              <div className="time-col">
                <span className="start-time">{slot.start_time.slice(0, 5)}</span>
                <span className="end-time">{slot.end_time.slice(0, 5)}</span>
              </div>
              <div className="slot-details">
                <div className="slot-top">
                  <h4>{slot.subject}</h4>
                  {slot.kind && <span className="kind-tag">{slot.kind}</span>}
                </div>
                <div className="slot-bottom">
                  <span>Room: {slot.room || 'TBA'}</span>
                  {slot.short_code && <span>Faculty: {slot.short_code}</span>}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
