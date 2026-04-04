import { useState } from 'react';

type SessionType =
  | { type: 'local'; port: number }
  | { type: 'http'; host: string; port: number; password?: string }
  | { type: 'ssh'; sshHost: string; sshPort?: number; remotePort: number; localPort: number; identityFile?: string };

interface Session {
  id: string;
  name: string;
  sessionType: SessionType;
}

interface Props {
  initial: Session | null;
  onSave: (data: { name: string; sessionType: SessionType }) => void;
  onCancel: () => void;
}

export default function SessionForm({ initial, onSave, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<'local' | 'http' | 'ssh'>(initial?.sessionType.type ?? 'local');

  const [port, setPort] = useState(
    initial?.sessionType.type === 'local' ? initial.sessionType.port : 3879
  );

  const [httpHost, setHttpHost] = useState(
    initial?.sessionType.type === 'http' ? initial.sessionType.host : ''
  );
  const [httpPort, setHttpPort] = useState(
    initial?.sessionType.type === 'http' ? initial.sessionType.port : 3879
  );
  const [httpPassword, setHttpPassword] = useState(
    initial?.sessionType.type === 'http' ? initial.sessionType.password ?? '' : ''
  );

  const [sshHost, setSshHost] = useState(
    initial?.sessionType.type === 'ssh' ? initial.sessionType.sshHost : ''
  );
  const [sshPort, setSshPort] = useState(
    initial?.sessionType.type === 'ssh' ? initial.sessionType.sshPort ?? 22 : 22
  );
  const [remotePort, setRemotePort] = useState(
    initial?.sessionType.type === 'ssh' ? initial.sessionType.remotePort : 3879
  );
  const [localPort, setLocalPort] = useState(
    initial?.sessionType.type === 'ssh' ? initial.sessionType.localPort : 13879
  );
  const [identityFile, setIdentityFile] = useState(
    initial?.sessionType.type === 'ssh' ? initial.sessionType.identityFile ?? '' : ''
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted, type:', type, 'sshHost:', sshHost);
    let sessionType: SessionType;
    switch (type) {
      case 'local':
        sessionType = { type: 'local', port };
        break;
      case 'http':
        sessionType = { type: 'http', host: httpHost, port: httpPort, ...(httpPassword ? { password: httpPassword } : {}) };
        break;
      case 'ssh':
        sessionType = {
          type: 'ssh', sshHost, remotePort, localPort,
          ...(sshPort !== 22 ? { sshPort } : {}),
          ...(identityFile ? { identityFile } : {}),
        };
        break;
    }
    console.log('sessionType payload:', JSON.stringify(sessionType));
    onSave({ name, sessionType });
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form onSubmit={handleSubmit} style={{ background: '#fff', borderRadius: 12, padding: 24, minWidth: 360, maxWidth: 440, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
        <h3 style={{ marginTop: 0 }}>{initial ? 'Edit Session' : 'New Session'}</h3>

        <label style={labelStyle}>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required style={inputStyle} />
        </label>

        <label style={labelStyle}>
          Type
          <select value={type} onChange={(e) => setType(e.target.value as 'local' | 'http' | 'ssh')} style={inputStyle}>
            <option value="local">Local</option>
            <option value="http">HTTP</option>
            <option value="ssh">SSH</option>
          </select>
        </label>

        {type === 'local' && (
          <label style={labelStyle}>
            Port
            <input type="number" value={port} onChange={(e) => setPort(Number(e.target.value))} style={inputStyle} />
          </label>
        )}

        {type === 'http' && (
          <>
            <label style={labelStyle}>
              Host
              <input value={httpHost} onChange={(e) => setHttpHost(e.target.value)} required placeholder="192.168.1.100" style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Port
              <input type="number" value={httpPort} onChange={(e) => setHttpPort(Number(e.target.value))} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Password (optional)
              <input type="password" value={httpPassword} onChange={(e) => setHttpPassword(e.target.value)} style={inputStyle} />
            </label>
          </>
        )}

        {type === 'ssh' && (
          <>
            <label style={labelStyle}>
              SSH Host (user@hostname)
              <input value={sshHost} onChange={(e) => setSshHost(e.target.value)} required placeholder="user@server.com" style={inputStyle} />
            </label>
            <label style={labelStyle}>
              SSH Port
              <input type="number" value={sshPort} onChange={(e) => setSshPort(Number(e.target.value))} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Remote Port
              <input type="number" value={remotePort} onChange={(e) => setRemotePort(Number(e.target.value))} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Local Tunnel Port
              <input type="number" value={localPort} onChange={(e) => setLocalPort(Number(e.target.value))} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Identity File (optional)
              <input value={identityFile} onChange={(e) => setIdentityFile(e.target.value)} placeholder="~/.ssh/id_ed25519" style={inputStyle} />
            </label>
          </>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" onClick={onCancel} style={{ background: '#f0f0f0', color: '#333', border: 'none', borderRadius: 6, padding: '8px 20px', cursor: 'pointer', fontSize: 14 }}>Cancel</button>
          <button type="submit" style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 20px', cursor: 'pointer', fontSize: 14 }}>Save</button>
        </div>
      </form>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12, fontSize: 13, fontWeight: 500,
};

const inputStyle: React.CSSProperties = {
  padding: '8px 10px', border: '1px solid #d0d0d0', borderRadius: 6, fontSize: 14,
};
