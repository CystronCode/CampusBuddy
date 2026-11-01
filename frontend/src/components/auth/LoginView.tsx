import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export const LoginView: React.FC = () => {
  const { requestOtp, verifyOtp } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const msg = await requestOtp(email);
      setNotice(msg);
      setStep('otp');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to dispatch login code.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await verifyOtp(email, code);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Incorrect or expired code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h2>Campus Intelligence</h2>
          <p>Sign in with your verified college email address</p>
        </div>

        {error && <div className="alert-box error">{error}</div>}
        {notice && <div className="alert-box info">{notice}</div>}

        {step === 'email' ? (
          <form onSubmit={handleRequestOtp}>
            <div className="form-group">
              <label htmlFor="email">College Email</label>
              <input
                id="email"
                type="email"
                placeholder="rollnumber@college.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <button type="submit" className="primary-btn" disabled={loading || !email.trim()}>
              {loading ? 'Sending Code...' : 'Send Login Code'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp}>
            <div className="form-group">
              <label htmlFor="code">6-Digit Code</label>
              <input
                id="code"
                type="text"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                required
                disabled={loading}
              />
            </div>
            <button type="submit" className="primary-btn" disabled={loading || code.length !== 6}>
              {loading ? 'Verifying...' : 'Verify & Enter'}
            </button>
            <button
              type="button"
              className="link-btn"
              onClick={() => { setStep('email'); setCode(''); }}
              disabled={loading}
            >
              Use different email
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
