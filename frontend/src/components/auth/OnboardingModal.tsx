import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

const BRANCHES = ['CSE', 'ECE', 'MECH', 'CIVIL', 'EEE', 'IT'];
const YEARS = [1, 2, 3, 4];
const SECTIONS = ['A', 'B', 'C', 'D'];

export const OnboardingModal: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const [branch, setBranch] = useState(user?.branch || 'CSE');
  const [year, setYear] = useState<number>(user?.year || 1);
  const [section, setSection] = useState(user?.section || 'A');
  const [vegPref, setVegPref] = useState(user?.veg_pref || false);
  const [budgetDefault, setBudgetDefault] = useState<number>(user?.budget_default || 150);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await updateProfile({
        branch,
        year,
        section,
        veg_pref: vegPref,
        budget_default: budgetDefault,
      });
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <h3>Complete Your Academic Profile</h3>
          <p>We need your section details to tailor your timetable, next class alerts, and notices.</p>
        </div>

        {error && <div className="alert-box error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Department / Branch</label>
              <select value={branch} onChange={(e) => setBranch(e.target.value)}>
                {BRANCHES.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Year of Study</label>
              <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {YEARS.map((y) => (
                  <option key={y} value={y}>Year {y}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Section</label>
              <select value={section} onChange={(e) => setSection(e.target.value)}>
                {SECTIONS.map((s) => (
                  <option key={s} value={s}>Section {s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row optional-row">
            <div className="form-group toggle-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={vegPref}
                  onChange={(e) => setVegPref(e.target.checked)}
                />
                Vegetarian preference by default
              </label>
            </div>

            <div className="form-group">
              <label>Meal Budget Ceiling (₹)</label>
              <input
                type="number"
                min="20"
                max="500"
                step="10"
                value={budgetDefault}
                onChange={(e) => setBudgetDefault(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="submit" className="primary-btn" disabled={loading}>
              {loading ? 'Saving Profile...' : 'Save & Continue to Dashboard'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
