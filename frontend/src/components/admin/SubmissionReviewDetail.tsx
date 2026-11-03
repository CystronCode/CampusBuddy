import React, { useState, useEffect, useRef } from 'react';
import { apiClient } from '../../lib/api';

interface Props {
  submissionId: string;
  onApproveSuccess?: () => void;
  onRejectSuccess?: () => void;
  onExtractionComplete?: () => void;
}

export const SubmissionReviewDetail: React.FC<Props> = ({
  submissionId,
  onApproveSuccess,
  onRejectSuccess,
  onExtractionComplete,
}) => {
  const [sub, setSub] = useState<any>(null);
  const [fileUrl, setFileUrl] = useState<string>('');
  const [extractedRows, setExtractedRows] = useState<any[]>([]);
  const [confidence, setConfidence] = useState<any>({ cells: {}, has_errors: false, has_warnings: false });
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);

  const retryCountRef = useRef(0);

  const loadSubmission = async () => {
    try {
      const res = await apiClient.get(`/api/submissions/${submissionId}`);
      if (!isMounted.current) return;
      setSub(res.data);
      
      let rawData = res.data.extracted;
      if (typeof rawData === 'string') {
        try {
          rawData = JSON.parse(rawData);
        } catch (e) {
          console.warn('Failed to parse extracted JSON string:', e);
        }
      }

      let rows: any[] = [];
      if (Array.isArray(rawData)) {
        rows = rawData;
      } else if (rawData && typeof rawData === 'object') {
        if (Array.isArray(rawData.slots) && rawData.slots.length > 0) rows = rawData.slots;
        else if (Array.isArray(rawData.items) && rawData.items.length > 0) rows = rawData.items;
        else if (Array.isArray(rawData.holidays) && rawData.holidays.length > 0) rows = rawData.holidays;
        else if (Array.isArray(rawData.faculty) && rawData.faculty.length > 0) rows = rawData.faculty;
        else rows = [];
      }
      setExtractedRows(rows);
      setConfidence(res.data.confidence || { cells: {}, has_errors: false, has_warnings: false });

      // Fetch file preview URL
      if (res.data.file_id) {
        try {
          const urlRes = await apiClient.get(`/api/files/${res.data.file_id}/url`);
          if (isMounted.current) {
            setFileUrl(urlRes.data.signed_url);
          }
        } catch (e) {
          console.warn('Could not fetch signed file url:', e);
        }
      }

      // Auto-poll if still processing or if rows are empty but extraction could still be completing
      if (res.data.status === 'processing' || (rows.length === 0 && retryCountRef.current < 8)) {
        retryCountRef.current += 1;
        if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
        pollTimerRef.current = setTimeout(() => {
          if (isMounted.current) loadSubmission();
        }, 1500);
      } else if (rows.length > 0) {
        // Extraction completed! Notify parent to update dropdown counts
        onExtractionComplete?.();
      }
    } catch (err) {
      console.error('Failed to load submission:', err);
    }
  };

  useEffect(() => {
    isMounted.current = true;
    loadSubmission();
    return () => {
      isMounted.current = false;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [submissionId]);

  const triggerPatchValidation = (updated: any[]) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        const patchRes = await apiClient.patch(`/api/submissions/${submissionId}`, {
          extracted: updated,
        });
        setConfidence(patchRes.data.confidence);
      } catch (err) {
        console.error('Failed to save cell update:', err);
      } finally {
        setSaving(false);
      }
    }, 400); // 400ms debounce
  };

  const handleCellChange = (rowIdx: number, field: string, value: any) => {
    const updated = [...extractedRows];
    updated[rowIdx] = { ...updated[rowIdx], [field]: value };
    setExtractedRows(updated);
    triggerPatchValidation(updated);
  };

  const handleApprove = async () => {
    setApproving(true);
    try {
      await apiClient.post(`/api/submissions/${submissionId}/approve`);
      alert('Submission approved and published to active scopes successfully!');
      onApproveSuccess?.();
    } catch (err: any) {
      alert(err.response?.data?.detail?.message || 'Approval failed.');
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    try {
      await apiClient.post(`/api/submissions/${submissionId}/reject`, {
        reject_reason: rejectReason.trim(),
      });
      setShowRejectModal(false);
      alert('Submission has been declined.');
      onRejectSuccess?.();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Rejection failed.');
    }
  };

  if (!sub) return <div className="loading-state">Loading submission review...</div>;

  return (
    <div className="split-review-container">
      {/* LEFT PANE: Original Document Viewer */}
      <div className="left-pane-preview">
        <div className="pane-header">
          <h4>Original Uploaded Document</h4>
          {fileUrl && (
            <a href={fileUrl} target="_blank" rel="noreferrer" className="open-link">
              ↗ Open in new tab
            </a>
          )}
        </div>
        <div className="preview-body">
          {fileUrl ? (
            <iframe
              src={fileUrl}
              title="Original Document Preview"
              width="100%"
              height="100%"
              className="preview-iframe"
            />
          ) : (
            <div className="empty-preview">
              <p>📄 Document preview ready.</p>
              <p className="filename-meta">{sub.scope || sub.data_type}</p>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANE: Editable Tabular Grid with Real-Time Flags */}
      <div className="right-pane-editor">
        <div className="editor-header">
          <div className="title-group">
            <h4>Extracted Data Verification ({sub.data_type})</h4>
            <span className={`status-badge ${sub.status}`}>{sub.status.toUpperCase()}</span>
            <button
              onClick={() => { retryCountRef.current = 0; loadSubmission(); }}
              style={{
                marginLeft: '8px',
                padding: '4px 8px',
                fontSize: '0.8rem',
                borderRadius: '4px',
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                cursor: 'pointer',
              }}
              title="Refresh extracted table"
            >
              🔄 Refresh
            </button>
          </div>

          <div className="actions-group">
            {saving && <span className="saving-indicator">● Validating...</span>}
            <button
              className="danger-btn"
              onClick={() => setShowRejectModal(true)}
              disabled={approving}
            >
              Reject
            </button>
            <button
              className="approve-btn"
              onClick={handleApprove}
              disabled={confidence.has_errors || approving}
              title={
                confidence.has_errors
                  ? 'Resolve all highlighted hard errors before publishing'
                  : 'Atomically publish to live version'
              }
            >
              {approving ? 'Publishing...' : 'Approve & Publish'}
            </button>
          </div>
        </div>

        {/* Processing Indicator Banner */}
        {sub.status === 'processing' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', marginBottom: '1rem', color: '#1e40af' }}>
            <div className="spinner" style={{ width: '20px', height: '20px', border: '3px solid #bfdbfe', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <div>
              <div style={{ fontWeight: 600 }}>AI Extraction in Progress...</div>
              <div style={{ fontSize: '0.85rem', color: '#3b82f6' }}>Parsing timetable schedule and validating slots. The table will appear automatically here once complete!</div>
            </div>
          </div>
        )}

        {/* Validation Warning & Error Banners */}
        {confidence.has_errors && (
          <div className="banner error-banner">
            ⚠️ <strong>Hard Errors Detected:</strong> Red bordered cells must be corrected before approval.
          </div>
        )}
        {confidence.has_warnings && !confidence.has_errors && (
          <div className="banner warning-banner">
            ⚡ <strong>Warnings:</strong> Amber cells highlight items like split batches or unstated veg status. Approval permitted.
          </div>
        )}

        {/* Tabular Grid, Menu List, or Paragraph Viewer */}
        <div className="table-wrapper">
          {extractedRows.length === 0 ? (
            <div className="no-rows">
              {sub.status === 'processing'
                ? 'Parsing rows with AI... please wait a few seconds.'
                : 'No structured rows extracted for this document type.'}
            </div>
          ) : sub.data_type === 'menu' ? (
            /* MENU INTERFACE: List format for menu items */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px' }}>
              <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '4px' }}>
                Canteen Menu List ({extractedRows.length} items) · Click any cell to edit dish name, meal, veg status, or price:
              </div>
              {extractedRows.map((row, rIdx) => {
                const isVeg = row.is_veg === true || String(row.is_veg).toLowerCase() === 'true';
                return (
                  <div
                    key={rIdx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      gap: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                      <span
                        style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          background: isVeg ? '#16a34a' : '#dc2626',
                          flexShrink: 0,
                        }}
                      />
                      <input
                        type="text"
                        value={row.item || row.item_name || ''}
                        onChange={(e) => handleCellChange(rIdx, 'item', e.target.value)}
                        placeholder="Dish Name"
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontWeight: 600,
                          fontSize: '0.9rem',
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <select
                        value={row.meal || 'lunch'}
                        onChange={(e) => handleCellChange(rIdx, 'meal', e.target.value)}
                        style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                      >
                        <option value="breakfast">Breakfast</option>
                        <option value="lunch">Lunch</option>
                        <option value="snacks">Snacks</option>
                        <option value="dinner">Dinner</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => handleCellChange(rIdx, 'is_veg', !isVeg)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          background: isVeg ? '#dcfce7' : '#fee2e2',
                          color: isVeg ? '#15803d' : '#b91c1c',
                        }}
                      >
                        {isVeg ? 'Veg' : 'Non-Veg'}
                      </button>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontWeight: 700 }}>₹</span>
                        <input
                          type="number"
                          value={row.price ?? ''}
                          onChange={(e) => handleCellChange(rIdx, 'price', Number(e.target.value))}
                          style={{
                            width: '70px',
                            padding: '6px 8px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            fontWeight: 700,
                            fontSize: '0.9rem',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : sub.data_type === 'timetable' ? (
            /* TIMETABLE INTERFACE: Table format only for timetable */
            <table className="review-table">
              <thead>
                <tr>
                  <th>#</th>
                  {Object.keys(extractedRows[0]).map((col) => (
                    <th key={col}>{col.replace('_', ' ').toUpperCase()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {extractedRows.map((row, rIdx) => (
                  <tr key={rIdx}>
                    <td className="row-num">{rIdx + 1}</td>
                    {Object.entries(row).map(([field, val]) => {
                      const flagKey = `${rIdx}.${field}`;
                      const flag = confidence.cells?.[flagKey];
                      return (
                        <td
                          key={field}
                          className={`cell ${flag ? `has-flag ${flag.type}` : ''}`}
                        >
                          <input
                            type="text"
                            value={val === null || val === undefined ? '' : String(val)}
                            onChange={(e) => handleCellChange(rIdx, field, e.target.value)}
                            title={flag?.message || ''}
                          />
                          {flag && (
                            <span
                              className={`flag-dot ${flag.type}`}
                              title={flag.message}
                            >
                              ●
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            /* OTHER THINGS: Paragraph format for notices, circulars, syllabus */
            <div style={{ padding: '16px', background: '#ffffff', borderRadius: '8px', lineHeight: 1.7, color: '#1e293b' }}>
              <h5 style={{ margin: '0 0 10px 0', fontSize: '0.95rem', fontWeight: 700, color: '#334155' }}>
                Document Paragraph Content:
              </h5>
              <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem', background: '#f8fafc', padding: '14px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                {extractedRows
                  .map((r) => (typeof r === 'string' ? r : r.content || r.text || r.description || JSON.stringify(r)))
                  .join('\n\n')}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Reject Reason Modal */}
      {showRejectModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h4>Reject Submission</h4>
            <p>Please enter the specific reason so the uploader can correct and re-submit.</p>
            <textarea
              rows={3}
              placeholder="E.g., Missing lab faculty codes, low OCR clarity..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="modal-actions">
              <button className="secondary-btn" onClick={() => setShowRejectModal(false)}>
                Cancel
              </button>
              <button
                className="danger-btn"
                onClick={handleReject}
                disabled={!rejectReason.trim()}
              >
                Confirm Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
