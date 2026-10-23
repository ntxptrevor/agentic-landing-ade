import React, { useState } from 'react';
import { loginPassphrase } from '../utils/api.js';

// Server auth_error codes (web/public/auth/*.php). Older code names are kept as aliases.
const ERRORS = {
  bad_state: 'Sign-in expired or was opened in another tab — try again.',
  access_denied: 'Google sign-in was cancelled — try again or use the passphrase.',
  domain: 'Sign in with an @ntxpllc.com Google account.',
  token: 'Google sign-in could not be verified — try again.',
  config: 'Google sign-in is not configured on the server yet — use the passphrase.',
  nonce: 'Sign-in could not be verified (replayed or expired request) — try again.',
  unverified: 'That Google account email is not verified — verify it with Google or use the passphrase.',
};
const ALIASES = {
  state: 'bad_state', state_expired: 'bad_state', domain_not_allowed: 'domain', hd_mismatch: 'domain',
  token_exchange_failed: 'token', token_invalid: 'token', google_not_configured: 'config', email_unverified: 'unverified',
};
const authErrorMessage = code => (code ? ERRORS[code] || ERRORS[ALIASES[code]] || `Sign-in failed (${String(code).slice(0, 40)}).` : '');

export default function LoginGate({ session, onAuthenticated }) {
  const [pass, setPass] = useState('');
  const [error, setError] = useState(() => {
    return authErrorMessage(new URLSearchParams(location.search).get('auth_error'));
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
        <h2>NTXP CPM Gantt Schedules</h2>
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
