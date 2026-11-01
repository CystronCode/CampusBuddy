import React, { useState } from 'react';
import { apiClient } from '../../lib/api';

interface Props {
  onUploadSuccess: (submissionId: string) => void;
}

export const UploadCard: React.FC<Props> = ({ onUploadSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [dataType, setDataType] = useState<string>('timetable');
  const [branch, setBranch] = useState<string>('CSE');
  const [year, setYear] = useState<number>(3);
  const [section, setSection] = useState<string>('A');
  const [docKey, setDocKey] = useState<string>('notice:CSE:midterm-schedule');
  const [validUntil, setValidUntil] = useState<string>('2026-12-31');
  const [uploading, setUploading] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file to upload.');
      return;
    }

    setUploading(true);
    setError(null);
    setMessage(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('data_type', dataType);

    if (dataType === 'timetable') {
      formData.append('branch', branch);
      formData.append('year', year.toString());
      formData.append('section', section);
    } else if (dataType === 'notice' || dataType === 'syllabus') {
      formData.append('doc_key', docKey);
      formData.append('valid_until', validUntil);
      formData.append('branch', branch);
    } else if (dataType === 'poster') {
      formData.append('valid_until', validUntil);
    }

    try {
      const resp = await apiClient.post('/api/uploads', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMessage(`Uploaded successfully! Submission ID: ${resp.data.submission_id}`);
      onUploadSuccess(resp.data.submission_id);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to upload document.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="card upload-card" style={{ marginBottom: '1.5rem', padding: '1.5rem', background: '#ffffff', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
      <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>📤</span> Admin Document Ingestion (PDF, DOCX, XLSX, Images)
      </h3>
      <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1rem' }}>
        Upload campus schedules, mess menus, notices, or holiday calendars. The AI ingestion engine will extract structured tables and evaluate deterministic validation rules automatically.
      </p>

      {error && <div className="error-banner" style={{ background: '#fef2f2', color: '#b91c1c', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem' }}>{error}</div>}
      {message && <div className="success-banner" style={{ background: '#f0fdf4', color: '#15803d', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem' }}>{message}</div>}

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Document Type</label>
            <select
              value={dataType}
              onChange={(e) => setDataType(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            >
              <option value="timetable">📅 Timetable / Class Schedule</option>
              <option value="menu">🍲 Mess Menu</option>
              <option value="holidays">🏖️ Academic Holidays</option>
              <option value="faculty">👨‍🏫 Faculty Directory</option>
              <option value="notice">📢 Campus Notice / Circular</option>
              <option value="poster">🎨 Club Event Poster</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Select File (PDF, DOCX, XLSX, PNG)</label>
            <input
              type="file"
              accept=".pdf,.docx,.xlsx,.png,.jpeg,.jpg,.webp"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              style={{ width: '100%', padding: '6px' }}
            />
          </div>
        </div>

        {dataType === 'timetable' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Branch</label>
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value.toUpperCase())}
                placeholder="e.g. CSE"
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Year (1-4)</label>
              <input
                type="number"
                min={1}
                max={6}
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value) || 1)}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Section</label>
              <input
                type="text"
                value={section}
                onChange={(e) => setSection(e.target.value.toUpperCase())}
                placeholder="e.g. A"
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>
          </div>
        )}

        {(dataType === 'notice' || dataType === 'syllabus') && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Doc Key (Namespace)</label>
              <input
                type="text"
                value={docKey}
                onChange={(e) => setDocKey(e.target.value)}
                placeholder="notice:CSE:exam-rules"
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Valid Until (YYYY-MM-DD)</label>
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={uploading || !file}
          style={{
            padding: '10px 20px',
            background: uploading ? '#94a3b8' : '#2563eb',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            cursor: uploading ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            fontSize: '0.95rem'
          }}
        >
          {uploading ? '⏳ Uploading & Extracting...' : '🚀 Upload & Parse Document'}
        </button>
      </form>
    </div>
  );
};
