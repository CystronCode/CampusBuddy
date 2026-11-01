import React, { useState, useEffect } from 'react';
import { apiClient } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import {
  CalendarDays,
  Utensils,
  GraduationCap,
  Sparkles,
  MapPin,
  Clock3,
  UserRound,
  Leaf,
  Search,
  SlidersHorizontal,
  Mail,
  DoorOpen,
  Calendar,
  PartyPopper
} from 'lucide-react';

type SubTab = 'timetable' | 'canteen' | 'faculty' | 'calendar' | 'events';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const BrowseView: React.FC = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<SubTab>('timetable');

  // Timetable state
  const [ttView, setTtView] = useState<'day' | 'week'>('day');
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay() || 1);
  const [timetableSlots, setTimetableSlots] = useState<any[]>([]);
  const [loadingTt, setLoadingTt] = useState(false);

  // Canteen state
  const [foodQuery, setFoodQuery] = useState('');
  const [budget, setBudget] = useState<number>(150);
  const [dietFilter, setDietFilter] = useState<'all' | 'veg' | 'nonveg'>('all');
  const [mealFilter, setMealFilter] = useState<string>('all');
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(false);

  // Faculty state
  const [facultyQuery, setFacultyQuery] = useState('');
  const [facultyList, setFacultyList] = useState<any[]>([]);
  const [loadingFaculty, setLoadingFaculty] = useState(false);

  // Calendar / Holidays state
  const [calQuery, setCalQuery] = useState('');
  const [holidaysList, setHolidaysList] = useState<any[]>([]);
  const [loadingCal, setLoadingCal] = useState(false);

  // Events state
  const [eventsList, setEventsList] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  // 1. Fetch Timetable
  useEffect(() => {
    if (tab === 'timetable') {
      setLoadingTt(true);
      apiClient
        .get('/api/timetable?scope=week')
        .then((res) => {
          const slots = res.data?.slots || [];
          setTimetableSlots(slots);
        })
        .catch((e) => console.warn('Could not load timetable:', e))
        .finally(() => setLoadingTt(false));
    }
  }, [tab]);

  // 2. Fetch Canteen Menu
  useEffect(() => {
    if (tab === 'canteen') {
      setLoadingMenu(true);
      const params: any = {};
      if (dietFilter === 'veg') params.veg = true;
      if (dietFilter === 'nonveg') params.veg = false;
      if (mealFilter !== 'all') params.meal = mealFilter;
      if (budget) params.max_price = budget;

      apiClient
        .get('/api/menu', { params })
        .then((res) => {
          setMenuItems(res.data?.items || []);
        })
        .catch((e) => console.warn('Could not load menu:', e))
        .finally(() => setLoadingMenu(false));
    }
  }, [tab, dietFilter, mealFilter, budget]);

  // 3. Fetch Faculty
  useEffect(() => {
    if (tab === 'faculty') {
      setLoadingFaculty(true);
      apiClient
        .get('/api/faculty', { params: facultyQuery ? { q: facultyQuery } : {} })
        .then((res) => {
          setFacultyList(res.data?.matches || []);
        })
        .catch((e) => console.warn('Could not load faculty:', e))
        .finally(() => setLoadingFaculty(false));
    }
  }, [tab, facultyQuery]);

  // 4. Fetch Calendar & Holidays
  useEffect(() => {
    if (tab === 'calendar') {
      setLoadingCal(true);
      apiClient
        .get('/api/holidays')
        .then((res) => {
          setHolidaysList(res.data?.holidays || []);
        })
        .catch((e) => console.warn('Could not load calendar:', e))
        .finally(() => setLoadingCal(false));
    }
  }, [tab]);

  // 5. Fetch Events
  useEffect(() => {
    if (tab === 'events') {
      setLoadingEvents(true);
      apiClient
        .get('/api/events')
        .then((res) => {
          setEventsList(res.data?.events || []);
        })
        .catch((e) => console.warn('Could not load events:', e))
        .finally(() => setLoadingEvents(false));
    }
  }, [tab]);

  // Filtered Canteen Items by Search
  const filteredFood = menuItems.filter((it) =>
    foodQuery ? it.item?.toLowerCase().includes(foodQuery.toLowerCase()) : true
  );

  // Filtered Holidays by Search
  const filteredHols = holidaysList.filter((h) =>
    calQuery ? h.name?.toLowerCase().includes(calQuery.toLowerCase()) : true
  );

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
          color: '#ffffff',
          padding: '1.75rem 2rem',
          borderRadius: '16px',
          marginBottom: '1.5rem',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
              Campus Explorer · CampusBuddy Mode
            </div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>Campus Directories & Schedules</h2>
            <p style={{ color: '#cbd5e1', fontSize: '0.9rem', marginTop: '4px' }}>
              Instant structured browsing for your section schedule, canteen budget meals, faculty directory, and academic milestones.
            </p>
          </div>
          {user && (
            <div style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '8px 16px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 600 }}>
              {user.branch} · Year {user.year} · Sec {user.section}
            </div>
          )}
        </div>
      </div>

      {/* CampusBuddy Sub-Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          background: '#ffffff',
          padding: '6px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          marginBottom: '1.5rem',
          overflowX: 'auto',
        }}
      >
        <button
          onClick={() => setTab('timetable')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 18px',
            borderRadius: '8px',
            border: 'none',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            background: tab === 'timetable' ? '#2563eb' : 'transparent',
            color: tab === 'timetable' ? '#ffffff' : '#475569',
            transition: 'all 0.2s',
          }}
        >
          <CalendarDays size={18} />
          Timetable
        </button>

        <button
          onClick={() => setTab('canteen')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 18px',
            borderRadius: '8px',
            border: 'none',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            background: tab === 'canteen' ? '#2563eb' : 'transparent',
            color: tab === 'canteen' ? '#ffffff' : '#475569',
            transition: 'all 0.2s',
          }}
        >
          <Utensils size={18} />
          Canteen & Menu
        </button>

        <button
          onClick={() => setTab('faculty')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 18px',
            borderRadius: '8px',
            border: 'none',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            background: tab === 'faculty' ? '#2563eb' : 'transparent',
            color: tab === 'faculty' ? '#ffffff' : '#475569',
            transition: 'all 0.2s',
          }}
        >
          <GraduationCap size={18} />
          Faculty Directory
        </button>

        <button
          onClick={() => setTab('calendar')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 18px',
            borderRadius: '8px',
            border: 'none',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            background: tab === 'calendar' ? '#2563eb' : 'transparent',
            color: tab === 'calendar' ? '#ffffff' : '#475569',
            transition: 'all 0.2s',
          }}
        >
          <Calendar size={18} />
          Academic Calendar
        </button>

        <button
          onClick={() => setTab('events')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 18px',
            borderRadius: '8px',
            border: 'none',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            background: tab === 'events' ? '#2563eb' : 'transparent',
            color: tab === 'events' ? '#ffffff' : '#475569',
            transition: 'all 0.2s',
          }}
        >
          <PartyPopper size={18} />
          Events
        </button>
      </div>

      {/* ================= TAB 1: TIMETABLE ================= */}
      {tab === 'timetable' && (
        <div>
          {/* Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setTtView('day')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: ttView === 'day' ? '#1e293b' : '#ffffff',
                  color: ttView === 'day' ? '#ffffff' : '#1e293b',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Day View
              </button>
              <button
                onClick={() => setTtView('week')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: ttView === 'week' ? '#1e293b' : '#ffffff',
                  color: ttView === 'week' ? '#ffffff' : '#1e293b',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Full Week View
              </button>
            </div>

            {ttView === 'day' && (
              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto' }}>
                {DAY_NAMES.map((name, idx) => (
                  <button
                    key={name}
                    onClick={() => setSelectedDay(idx + 1)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: selectedDay === idx + 1 ? '#2563eb' : '#ffffff',
                      color: selectedDay === idx + 1 ? '#ffffff' : '#475569',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                    }}
                  >
                    {name.slice(0, 3)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {loadingTt ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Loading timetable schedule...</div>
          ) : timetableSlots.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', color: '#64748b' }}>
              No timetable slots found for your active section.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {timetableSlots
                .filter((s) => (ttView === 'day' ? s.day === selectedDay : true))
                .sort((a, b) => a.day - b.day || a.start_time.localeCompare(b.start_time))
                .map((s, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '1.25rem',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
                      transition: 'transform 0.15s, box-shadow 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase' }}>
                        {DAY_NAMES[(s.day || 1) - 1]}
                      </span>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '999px',
                          background: s.kind === 'lab' ? '#fef3c7' : '#e0e7ff',
                          color: s.kind === 'lab' ? '#92400e' : '#3730a3',
                          textTransform: 'uppercase',
                        }}
                      >
                        {s.kind || 'lecture'}
                      </span>
                    </div>

                    <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: '0 0 10px 0' }}>{s.subject}</h4>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem', color: '#475569' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock3 size={15} color="#64748b" />
                        <span>
                          {s.start_time} - {s.end_time}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <MapPin size={15} color="#64748b" />
                        <span>Room {s.room || 'TBD'}</span>
                      </div>
                      {s.faculty_id && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <UserRound size={15} color="#64748b" />
                          <span>Prof. {s.faculty_id}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 2: CANTEEN & MENU ================= */}
      {tab === 'canteen' && (
        <div>
          {/* Filter Bar */}
          <div
            style={{
              background: '#ffffff',
              padding: '1.25rem',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              marginBottom: '1.5rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
              alignItems: 'center',
            }}
          >
            {/* Search */}
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>Search Menu</label>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Filter coffee, dosa, thali..."
                  value={foodQuery}
                  onChange={(e) => setFoodQuery(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px 8px 34px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                />
              </div>
            </div>

            {/* Budget Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                <span>Budget Cap</span>
                <span style={{ color: '#2563eb', fontWeight: 700 }}>₹{budget}</span>
              </div>
              <input
                type="range"
                min="20"
                max="250"
                step="10"
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
                style={{ width: '100%', cursor: 'pointer' }}
              />
            </div>

            {/* Diet Filter */}
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>Diet Preference</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => setDietFilter('all')}
                  style={{
                    flex: 1,
                    padding: '7px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: dietFilter === 'all' ? '#1e293b' : '#ffffff',
                    color: dietFilter === 'all' ? '#ffffff' : '#475569',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  All
                </button>
                <button
                  onClick={() => setDietFilter('veg')}
                  style={{
                    flex: 1,
                    padding: '7px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: dietFilter === 'veg' ? '#15803d' : '#ffffff',
                    color: dietFilter === 'veg' ? '#ffffff' : '#475569',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  🌱 Veg
                </button>
              </div>
            </div>
          </div>

          {loadingMenu ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Loading canteen delicacies...</div>
          ) : filteredFood.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', color: '#64748b' }}>
              No food items match your filter. Try adjusting your budget slider or diet preference.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
              {filteredFood.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '1.25rem',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          color: item.is_veg ? '#16a34a' : '#dc2626',
                        }}
                      >
                        <Leaf size={14} />
                        {item.is_veg ? 'VEG' : 'NON-VEG'}
                      </span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'capitalize' }}>
                        {item.meal || 'Snacks'}
                      </span>
                    </div>

                    <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: '0 0 6px 0' }}>{item.item}</h4>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed #f1f5f9' }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>₹{item.price}</span>
                    <span style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '6px', background: '#f8fafc', color: '#64748b', fontWeight: 600 }}>
                      Available
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 3: FACULTY DIRECTORY ================= */}
      {tab === 'faculty' && (
        <div>
          <div style={{ marginBottom: '1.5rem', maxWidth: '400px', position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search faculty by name or subject..."
              value={facultyQuery}
              onChange={(e) => setFacultyQuery(e.target.value)}
              style={{ width: '100%', padding: '10px 12px 10px 38px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
            />
          </div>

          {loadingFaculty ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Searching faculty directory...</div>
          ) : facultyList.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', color: '#64748b' }}>
              No faculty records found.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
              {facultyList.map((f, idx) => (
                <div
                  key={idx}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '1.25rem',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 2px 0' }}>{f.name}</h4>
                      <div style={{ fontSize: '0.8rem', color: '#2563eb', fontWeight: 600 }}>
                        {f.designation || 'Faculty'} · {f.department || 'Engineering'}
                      </div>
                    </div>
                    {f.short_code && (
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: '#f1f5f9', color: '#475569' }}>
                        {f.short_code}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem', color: '#475569', marginTop: '10px' }}>
                    {f.cabin && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <DoorOpen size={15} color="#64748b" />
                        <span>Cabin: {f.cabin}</span>
                      </div>
                    )}
                    {f.email && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Mail size={15} color="#64748b" />
                        <span>{f.email}</span>
                      </div>
                    )}
                    {f.subjects_text && (
                      <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '6px' }}>
                        <strong>Subjects:</strong> {f.subjects_text}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 4: ACADEMIC CALENDAR & HOLIDAYS ================= */}
      {tab === 'calendar' && (
        <div>
          <div style={{ marginBottom: '1.5rem', maxWidth: '400px', position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search exam, quiz, semester end..."
              value={calQuery}
              onChange={(e) => setCalQuery(e.target.value)}
              style={{ width: '100%', padding: '10px 12px 10px 38px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
            />
          </div>

          {loadingCal ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Loading academic calendar milestones...</div>
          ) : filteredHols.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', color: '#64748b' }}>
              No calendar milestones found.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredHols.map((h, idx) => {
                const isExam = h.name?.toLowerCase().includes('exam') || h.name?.toLowerCase().includes('quiz');
                const isCommence = h.name?.toLowerCase().includes('commencement') || h.name?.toLowerCase().includes('induction');
                return (
                  <div
                    key={idx}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '1rem 1.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '8px',
                          background: isExam ? '#fee2e2' : isCommence ? '#dbeafe' : '#f1f5f9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: isExam ? '#dc2626' : isCommence ? '#2563eb' : '#475569',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                        }}
                      >
                        {h.date ? h.date.split('-')[2] : '•'}
                      </div>
                      <div>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0f172a', margin: 0 }}>{h.name}</h4>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>{h.date}</div>
                      </div>
                    </div>

                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '4px 10px',
                        borderRadius: '999px',
                        background: isExam ? '#fef2f2' : '#f0fdf4',
                        color: isExam ? '#b91c1c' : '#15803d',
                      }}
                    >
                      {isExam ? 'EXAMINATION' : 'ACADEMIC'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 5: EVENTS ================= */}
      {tab === 'events' && (
        <div>
          {loadingEvents ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Loading campus club events...</div>
          ) : eventsList.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', color: '#64748b' }}>
              No campus events scheduled right now. Check back soon!
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
              {eventsList.map((e, idx) => (
                <div
                  key={idx}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '1.25rem',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase' }}>
                      {e.club || 'Campus Club'}
                    </span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>
                      {e.starts_at ? new Date(e.starts_at).toLocaleDateString() : 'Upcoming'}
                    </span>
                  </div>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 6px 0' }}>{e.title}</h4>
                  <p style={{ fontSize: '0.85rem', color: '#475569', margin: '0 0 10px 0' }}>{e.description || 'Join this exciting campus event!'}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#64748b' }}>
                    <MapPin size={15} />
                    <span>Venue: {e.venue || 'Campus Auditorium'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
