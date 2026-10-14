import React, { useState } from 'react';
import { loginPassphrase } from '../utils/api.js';

const ERRORS = {
  domain: 'Sign in with an @ntxpllc.com Google account.',
  state: 'Sign-in expired — try again.',
  token: 'Google sign-in could not be verified — try again.',
  config: 'Google sign-in is not configured on the server yet — use the passphrase.',
};

export default function LoginGate({ session, onAuthenticated }) {
  const [pass, setPass] = useState('');
  const [error, setError] = useState(() => {
    const code = new URLSearchParams(location.search).get('auth_error');
    return code ? ERRORS[code] || `Sign-in failed (${code}).` : '';
  });
  const [busy, setBusy] = useState(false);

  const submit = async e => {
    e.preventDefault();
    setBusy(true);
    const r = await loginPassphrase(pass);
    setBusy(false);
    if (r.ok) onAuthenticated(r); else setError(r.error);
  };

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <img src="./ntxp-logo-reversed.png" alt="NTXP" className="login-logo" />
        <h2>BidForge Schedules</h2>
        <p className="input-hint">schedule.ntxpllc.com — NTXP team access only.</p>
        {session.authMethods?.google !== false && (
          <a className="btn btn-primary login-google" href="./auth/google.php">Sign in with Google (@ntxpllc.com)</a>
        )}
        {session.authMethods?.passphrase !== false && (
          <form onSubmit={submit} className="login-pass">
            <label htmlFor="pp">Or team passphrase</label>
            <input id="pp" type="password" autoComplete="current-password" value={pass} onChange={e => setPass(e.target.value)} />
            <button className="btn btn-secondary" disabled={!pass || busy}>{busy ? 'Checking…' : 'Enter'}</button>
          </form>
        )}
        {error && <div className="login-error" role="alert">{error}</div>}
      </div>
    </div>
  );
}
