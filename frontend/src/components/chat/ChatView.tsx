import React, { useState, useRef, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { Mic, MicOff } from 'lucide-react';
import { apiClient } from '../../lib/api';

interface Citation {
  title: string;
  section?: string;
  page?: number;
}

interface ChatMessage {
  sender: 'user' | 'bot';
  text: string;
  citations?: Citation[];
  queryLogId?: number;
  tools?: string[];
  feedbackGiven?: number;
}

export const ChatView: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [sttSupported, setSttSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        setSttSupported(true);
        const recog = new SpeechRecognition();
        recog.continuous = false;
        recog.interimResults = true;
        recog.lang = 'en-IN';

        recog.onresult = (event: any) => {
          let transcript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            transcript += event.results[i][0].transcript;
          }
          setInput(transcript);
        };

        recog.onerror = (e: any) => {
          console.warn('Speech recognition error:', e);
          setIsListening(false);
        };

        recog.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recog;
      }
    }
  }, []);

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.warn('Could not start recognition:', err);
      }
    }
  };

  const chips = [
    { label: 'Next Class', id: 'chip_next_class' },
    { label: 'Today Timetable', id: 'chip_today_timetable' },
    { label: 'Veg Menu', id: 'chip_veg_menu' },
    { label: 'Upcoming Holidays', id: 'chip_upcoming_holidays' },
    { label: 'Club Events', id: 'chip_club_events' },
  ];

  const sendMessage = async (payload: { message?: string; chip_id?: string }) => {
    const userDisplay = payload.message || chips.find((c) => c.id === payload.chip_id)?.label || '';
    setMessages((prev) => [...prev, { sender: 'user', text: userDisplay }]);
    setInput('');
    setLoading(true);

    try {
      const res = await apiClient.post('/api/chat', payload);
      
      // Extract citations if present in RAG response
      let citations: Citation[] | undefined = undefined;
      if (res.data.data && typeof res.data.data === 'object' && 'chunks' in res.data.data) {
        citations = res.data.data.chunks.map((c: any) => ({
          title: c.title || 'Document',
          section: c.section,
          page: c.page,
        }));
      }

      setMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: res.data.response || 'Information retrieved.',
          citations,
          queryLogId: res.data.query_log_id,
          tools: res.data.tools,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: 'Smart assistant is currently busy. Please select one of the instant dashboard cards or quick chips.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleThumbs = async (msgIndex: number, queryLogId: number, thumbs: 1 | -1) => {
    try {
      await apiClient.post('/api/feedback', { query_log_id: queryLogId, thumbs });
      setMessages((prev) =>
        prev.map((m, idx) => (idx === msgIndex ? { ...m, feedbackGiven: thumbs } : m))
      );
    } catch (err) {
      console.error('Failed to submit feedback:', err);
    }
  };

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  return (
    <div className="chat-container">
      {/* Quick Action Chips Bar */}
      <div className="chips-bar">
        {chips.map((chip) => (
          <button
            key={chip.id}
            className="chip-btn"
            onClick={() => sendMessage({ chip_id: chip.id })}
            disabled={loading}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Message Stream */}
      <div className="messages-stream">
        {messages.length === 0 && (
          <div className="empty-chat-state">
            <h4>Ask anything about campus</h4>
            <p>E.g., "when is my next class?", "what's for lunch?", or tap a quick chip above.</p>
          </div>
        )}

        {messages.map((m, idx) => (
          <div key={idx} className={`message-bubble ${m.sender}`}>
            <div
              className="message-text"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(m.text) }}
            />

            {/* Clickable Document Citation Pills */}
            {m.citations && m.citations.length > 0 && (
              <div className="citations-tray">
                {m.citations.map((c, ci) => (
                  <span key={ci} className="citation-pill" title={`Section: ${c.section || 'General'}`}>
                    📄 {c.title} {c.page ? `(p. ${c.page})` : ''}
                  </span>
                ))}
              </div>
            )}

            {/* Thumbs Up / Down Telemetry */}
            {m.sender === 'bot' && m.queryLogId && (
              <div className="feedback-tray">
                <button
                  className={`feedback-btn ${m.feedbackGiven === 1 ? 'active' : ''}`}
                  onClick={() => handleThumbs(idx, m.queryLogId!, 1)}
                  title="Helpful response"
                >
                  👍
                </button>
                <button
                  className={`feedback-btn ${m.feedbackGiven === -1 ? 'active' : ''}`}
                  onClick={() => handleThumbs(idx, m.queryLogId!, -1)}
                  title="Unhelpful response"
                >
                  👎
                </button>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="message-bubble bot thinking">
            <span className="dot-pulse">● ● ●</span> Checking schedule and records...
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input Bar */}
      <form
        className="chat-input-bar"
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim()) sendMessage({ message: input });
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isListening ? 'Listening... speak now' : 'Ask about timetable, mess menu, faculty, or syllabus...'}
          disabled={loading}
          style={isListening ? { borderColor: '#ef4444', boxShadow: '0 0 0 2px rgba(239, 68, 68, 0.2)' } : undefined}
        />
        {sttSupported && (
          <button
            type="button"
            onClick={toggleVoiceInput}
            disabled={loading}
            title={isListening ? 'Listening... click to stop' : 'Voice Input (Speech to Text)'}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: isListening ? '#ef4444' : '#f8fafc',
              color: isListening ? '#ffffff' : '#475569',
              cursor: 'pointer',
            }}
          >
            {isListening ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
        )}
        <button type="submit" disabled={loading || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
};
