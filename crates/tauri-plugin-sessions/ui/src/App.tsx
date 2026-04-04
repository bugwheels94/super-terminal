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
  const [connecting, setConnecting] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<Record<string, string>>({});
  const [passwordPrompt, setPasswordPrompt] = useState<Record<string, boolean>>({});
  const [passwords, setPasswords] = useState<Record<string, string>>({});

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

  const handleConnect = async (id: string, password?: string) => {
    setConnecting(id);
    setConnectError((prev) => { const next = { ...prev }; delete next[id]; return next; });
    try {
      await invoke('plugin:sessions|connect_session', { id, password: password || null });
      // Success — clear password state
      setPasswordPrompt((prev) => { const next = { ...prev }; delete next[id]; return next; });
      setPasswords((prev) => { const next = { ...prev }; delete next[id]; return next; });
    } catch (e: any) {
      console.error('Failed to connect:', e);
      const err = typeof e === 'object' && e !== null ? e : { kind: 'other', message: String(e) };
      if (err.kind === 'ssh_auth') {
        setPasswordPrompt((prev) => ({ ...prev, [id]: true }));
        setConnectError((prev) => ({ ...prev, [id]: err.message || 'Authentication failed' }));
      } else {
        setConnectError((prev) => ({ ...prev, [id]: err.message || String(e) }));
      }
    } finally {
      setConnecting(null);
    }
  };

  const handleSave = async (data: { name: string; sessionType: SessionType }) => {
    try {
      console.log('Saving session:', JSON.stringify(data, null, 2));
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
          <div key={s.id}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', border: '1px solid #e0e0e0', borderRadius: 8, background: '#fafafa' }}>
              <div
                style={{ flex: 1, cursor: connecting ? 'default' : 'pointer', opacity: connecting && connecting !== s.id ? 0.5 : 1 }}
                onClick={() => !connecting && handleConnect(s.id)}
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
            {connecting === s.id && (
              <div style={{ padding: '6px 16px', fontSize: 12, color: '#666', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid #ccc', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                Connecting...
              </div>
            )}
            {connectError[s.id] && (
              <div style={{ padding: '6px 16px', fontSize: 12, color: '#c00' }}>
                {connectError[s.id]}
              </div>
            )}
            {passwordPrompt[s.id] && (
              <form
                onSubmit={(e) => { e.preventDefault(); handleConnect(s.id, passwords[s.id] || ''); }}
                style={{ padding: '8px 16px', display: 'flex', gap: 8, alignItems: 'center' }}
              >
                <input
                  type="password"
                  placeholder="SSH Password"
                  value={passwords[s.id] || ''}
                  onChange={(e) => setPasswords((prev) => ({ ...prev, [s.id]: e.target.value }))}
                  style={{ flex: 1, padding: '6px 10px', border: '1px solid #d0d0d0', borderRadius: 6, fontSize: 13 }}
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={connecting === s.id}
                  style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 13 }}
                >
                  {connecting === s.id ? 'Connecting...' : 'Connect'}
                </button>
              </form>
            )}
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
