import React, { useState, useEffect } from 'react';
import { apiClient } from '../../lib/api';

interface MenuItem {
  item: string;
  price: number;
  meal: string;
  is_veg: boolean | null;
  day?: number | null;
}

const MEALS = ['breakfast', 'lunch', 'snacks', 'dinner'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const MessMenuCard: React.FC = () => {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [vegOnly, setVegOnly] = useState(false);
  const [maxPrice, setMaxPrice] = useState<number>(150);
  const [meal, setMeal] = useState<string>('lunch');
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const fetchMenu = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (vegOnly) params.append('veg', 'true');
      if (maxPrice) params.append('max_price', maxPrice.toString());
      if (meal) params.append('meal', meal);
      if (selectedDay) params.append('day', selectedDay);

      const res = await apiClient.get(`/api/menu?${params.toString()}`);
      setItems(res.data.items || []);
    } catch (err) {
      console.error('Failed to load menu:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenu();
  }, [vegOnly, maxPrice, meal, selectedDay]);

  return (
    <div className="card mess-card">
      <div className="card-header">
        <h3>Mess Menu</h3>
        <div className="meal-tabs">
          {MEALS.map((m) => (
            <button
              key={m}
              className={`tab-btn ${meal === m ? 'active' : ''}`}
              onClick={() => setMeal(m)}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="filters-bar">
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={vegOnly}
            onChange={(e) => setVegOnly(e.target.checked)}
          />
          Veg Only
        </label>

        <div className="slider-container">
          <span className="slider-label">Max Price: ₹{maxPrice}</span>
          <input
            type="range"
            min="20"
            max="300"
            step="10"
            value={maxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="menu-list">
        {loading ? (
          <p className="status-text">Fetching current mess items...</p>
        ) : items.length === 0 ? (
          <p className="no-items">No items match your selected filters.</p>
        ) : (
          items.map((item, i) => (
            <div key={i} className="menu-row">
              <span className={`veg-dot ${item.is_veg === true ? 'veg' : item.is_veg === false ? 'non-veg' : 'unknown'}`}>
                ●
              </span>
              <span className="item-title">{item.item}</span>
              <span className="item-cost">₹{item.price}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
