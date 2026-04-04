import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import SessionForm from './SessionForm';

interface Session {
  id: string;
  name: string;
  sessionType: SessionType;
  createdAt: string;
}

type SessionType =
  | { type: 'local'; port: number }
  | { type: 'http'; host: string; port: number; password?: string }
  | { type: 'ssh'; sshHost: string; sshPort?: number; remotePort: number; localPort: number; identityFile?: string };

export default function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [editing, setEditing] = useState<Session | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    try {
      const list = await invoke<Session[]>('plugin:sessions|list_sessions');
      setSessions(list);
      setError(null);
    } catch (e) {
      console.error('Failed to load sessions:', e);
      setError(String(e));
    }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const handleDelete = async (id: string) => {
    try {
      await invoke('plugin:sessions|delete_session', { id });
      loadSessions();
    } catch (e) {
      console.error('Failed to delete:', e);
      setError(String(e));
    }
  };

  const handleConnect = async (id: string) => {
    try {
      await invoke('plugin:sessions|connect_session', { id });
    } catch (e) {
      console.error('Failed to connect:', e);
      setError(String(e));
    }
  };

  const handleSave = async (data: { name: string; sessionType: SessionType }) => {
    try {
      if (editing) {
        await invoke('plugin:sessions|update_session', { args: { id: editing.id, ...data } });
      } else {
        await invoke('plugin:sessions|create_session', { args: data });
      }
      setEditing(null);
      setShowForm(false);
      loadSessions();
    } catch (e) {
      console.error('Failed to save:', e);
      setError(String(e));
    }
  };

  const typeLabel = (st: SessionType) => {
    switch (st.type) {
      case 'local': return `Local :${st.port}`;
      case 'http': return `HTTP ${st.host}:${st.port}`;
      case 'ssh': return `SSH ${st.sshHost}`;
    }
  };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 24, maxWidth: 600, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>Sessions</h2>
        <button
          type="button"
          onClick={() => { setEditing(null); setShowForm(true); }}
          style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontSize: 14 }}
        >
          + Add New
        </button>
      </div>

      {error && (
        <div style={{ background: '#fee', border: '1px solid #c00', borderRadius: 6, padding: 12, marginBottom: 16, color: '#c00', fontSize: 13 }}>
          {error}
        </div>
      )}

      {sessions.length === 0 && !error && (
        <p style={{ color: '#888', textAlign: 'center', padding: 40 }}>
          No sessions yet. Click "+ Add New" to create one.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sessions.map((s) => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', border: '1px solid #e0e0e0', borderRadius: 8, background: '#fafafa' }}>
            <div
              style={{ flex: 1, cursor: 'pointer' }}
              onClick={() => handleConnect(s.id)}
              title="Click to connect"
            >
              <strong>{s.name}</strong>
              <span style={{ marginLeft: 12, color: '#888', fontSize: 13 }}>{typeLabel(s.sessionType)}</span>
            </div>
            <button type="button" onClick={() => { setEditing(s); setShowForm(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: '4px 8px' }} title="Edit">
              &#9998;
            </button>
            <button type="button" onClick={() => handleDelete(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: '4px 8px', color: '#c00' }} title="Delete">
              &#10005;
            </button>
          </div>
        ))}
      </div>

      {showForm && (
        <SessionForm
          initial={editing}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
}
