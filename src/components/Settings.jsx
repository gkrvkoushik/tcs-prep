import React, { useState } from 'react';
import { Eye, EyeOff, ShieldCheck, RefreshCw, CheckCircle2, AlertTriangle, Cpu } from 'lucide-react';
import { testConnection } from '../utils/groq';

export default function Settings({ settings, onSaveSettings, onBack }) {
  const [keyA, setKeyA] = useState(settings.keyA || '');
  const [keyB, setKeyB] = useState(settings.keyB || '');
  const [modelA, setModelA] = useState(settings.modelA || 'llama-3.3-70b-versatile');
  const [modelB, setModelB] = useState(settings.modelB || 'llama-3.3-70b-versatile');
  
  const [showKeyA, setShowKeyA] = useState(false);
  const [showKeyB, setShowKeyB] = useState(false);
  
  const [statusA, setStatusA] = useState('idle'); // idle | testing | success | error
  const [statusB, setStatusB] = useState('idle'); // idle | testing | success | error
  
  const [toast, setToast] = useState(null);

  const handleTestKeyA = async () => {
    if (!keyA) {
      setStatusA('error');
      return;
    }
    setStatusA('testing');
    const success = await testConnection(keyA, modelA);
    setStatusA(success ? 'success' : 'error');
  };

  const handleTestKeyB = async () => {
    if (!keyB) {
      setStatusB('error');
      return;
    }
    setStatusB('testing');
    const success = await testConnection(keyB, modelB);
    setStatusB(success ? 'success' : 'error');
  };

  const handleSave = () => {
    onSaveSettings({ keyA, keyB, modelA, modelB });
    setToast('Settings saved successfully!');
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="card animate-fade-in" style={{ maxWidth: '700px', margin: '0 auto w-full' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
          <ShieldCheck style={{ color: 'var(--primary)' }} />
          Groq API Settings
        </h2>
        <button className="btn btn-secondary" onClick={onBack}>
          Back to Dashboard
        </button>
      </div>

      {toast && (
        <div style={{
          backgroundColor: 'var(--success-light)',
          color: 'var(--success)',
          padding: '0.75rem 1rem',
          borderRadius: '0.5rem',
          marginBottom: '1rem',
          fontSize: '0.875rem',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <CheckCircle2 size={16} />
          {toast}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Key A (Generator) Section */}
        <div className="card" style={{ border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <span className="badge badge-indigo">Key A</span>
            Paper Generator API
          </h3>
          
          <div className="form-group">
            <label className="form-label" htmlFor="key-a">API Key</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                id="key-a"
                type={showKeyA ? 'text' : 'password'}
                className="form-input"
                style={{ paddingRight: '2.5rem' }}
                placeholder="gsk_..."
                value={keyA}
                onChange={(e) => setKeyA(e.target.value)}
              />
              <button
                type="button"
                className="btn-icon-only"
                style={{ position: 'absolute', right: '0.25rem', border: 'none', background: 'transparent' }}
                onClick={() => setShowKeyA(!showKeyA)}
              >
                {showKeyA ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="model-a">Model String</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Cpu size={16} style={{ position: 'absolute', left: '0.75rem', color: 'var(--text-muted)' }} />
              <input
                id="model-a"
                type="text"
                className="form-input"
                style={{ paddingLeft: '2.25rem' }}
                value={modelA}
                onChange={(e) => setModelA(e.target.value)}
                placeholder="e.g. llama-3.3-70b-versatile"
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
            <button className="btn btn-secondary" onClick={handleTestKeyA} disabled={statusA === 'testing' || !keyA}>
              {statusA === 'testing' ? (
                <>
                  <RefreshCw size={14} className="spin" />
                  Testing...
                </>
              ) : 'Test Connection'}
            </button>

            {statusA === 'success' && (
              <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem' }}>
                <CheckCircle2 size={16} /> Connected
              </span>
            )}
            {statusA === 'error' && (
              <span style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem' }}>
                <AlertTriangle size={16} /> Connection Failed
              </span>
            )}
          </div>
        </div>

        {/* Key B (Evaluator) Section */}
        <div className="card" style={{ border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <span className="badge badge-indigo" style={{ background: 'rgba(124, 58, 237, 0.1)', color: 'var(--secondary)' }}>Key B</span>
            Response Evaluator API
          </h3>
          
          <div className="form-group">
            <label className="form-label" htmlFor="key-b">API Key</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                id="key-b"
                type={showKeyB ? 'text' : 'password'}
                className="form-input"
                style={{ paddingRight: '2.5rem' }}
                placeholder="gsk_..."
                value={keyB}
                onChange={(e) => setKeyB(e.target.value)}
              />
              <button
                type="button"
                className="btn-icon-only"
                style={{ position: 'absolute', right: '0.25rem', border: 'none', background: 'transparent' }}
                onClick={() => setShowKeyB(!showKeyB)}
              >
                {showKeyB ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="model-b">Model String</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Cpu size={16} style={{ position: 'absolute', left: '0.75rem', color: 'var(--text-muted)' }} />
              <input
                id="model-b"
                type="text"
                className="form-input"
                style={{ paddingLeft: '2.25rem' }}
                value={modelB}
                onChange={(e) => setModelB(e.target.value)}
                placeholder="e.g. llama-3.3-70b-versatile"
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
            <button className="btn btn-secondary" onClick={handleTestKeyB} disabled={statusB === 'testing' || !keyB}>
              {statusB === 'testing' ? (
                <>
                  <RefreshCw size={14} className="spin" />
                  Testing...
                </>
              ) : 'Test Connection'}
            </button>

            {statusB === 'success' && (
              <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem' }}>
                <CheckCircle2 size={16} /> Connected
              </span>
            )}
            {statusB === 'error' && (
              <span style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem' }}>
                <AlertTriangle size={16} /> Connection Failed
              </span>
            )}
          </div>
        </div>

      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
        <button className="btn btn-secondary" onClick={onBack}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave}>Save Settings</button>
      </div>
    </div>
  );
}
