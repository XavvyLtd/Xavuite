/**
 * CookieBanner.tsx
 * GDPR-compliant cookie consent banner.
 * - Shows on first visit (no prior consent in localStorage)
 * - Granular: Necessary / Functional / Analytics / Marketing
 * - Records consent server-side via POST /api/gdpr/consent
 * - Respects withdrawal: users can update via Settings → Privacy
 * - No analytics/tracking fires until consent is given
 */

import { useState, useEffect } from 'react';
import { C } from './platform/branding/theme';

const API_URL = import.meta.env.VITE_API_URL ?? 'https://api-v2.xavvy.uk';

// ── Types ─────────────────────────────────────────────────────
export interface ConsentState {
  necessary:  true;
  functional: boolean;
  analytics:  boolean;
  marketing:  boolean;
  sessionId:  string;
  consentedAt: string;
}

const SESSION_KEY = 'xv_cookie_consent';
const SESSION_ID_KEY = 'xv_session_id';

function getOrCreateSessionId(): string {
  let id = localStorage.getItem(SESSION_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_ID_KEY, id);
  }
  return id;
}

export function getConsent(): ConsentState | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function hasAnalyticsConsent(): boolean {
  return getConsent()?.analytics ?? false;
}

async function recordConsent(consent: Omit<ConsentState, 'sessionId' | 'consentedAt'>, sessionId: string) {
  try {
    await fetch(`\${API_URL}/api/gdpr/consent`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ...consent, sessionId }),
    });
  } catch { /* non-blocking */ }
}

// ── Cookie Banner ─────────────────────────────────────────────
export default function CookieBanner() {
  const [visible,  setVisible]  = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [prefs, setPrefs]       = useState({ functional: false, analytics: false, marketing: false });

  useEffect(() => {
    // Show banner if no prior consent
    if (!getConsent()) {
      // Small delay so the app loads first
      setTimeout(() => setVisible(true), 800);
    }
  }, []);

  const saveConsent = async (functional: boolean, analytics: boolean, marketing: boolean) => {
    const sessionId = getOrCreateSessionId();
    const consent: ConsentState = {
      necessary: true, functional, analytics, marketing,
      sessionId, consentedAt: new Date().toISOString(),
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(consent));
    await recordConsent({ necessary: true, functional, analytics, marketing }, sessionId);
    setVisible(false);
  };

  const acceptAll    = () => saveConsent(true,  true,  false);
  const acceptNecessary = () => saveConsent(false, false, false);
  const saveCustom   = () => saveConsent(prefs.functional, prefs.analytics, prefs.marketing);

  if (!visible) return null;

  return (
    <>
      {/* Backdrop - subtle */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)',
        pointerEvents: expanded ? 'auto' : 'none',
        opacity: expanded ? 1 : 0, transition: 'opacity 0.2s',
      }} onClick={() => setExpanded(false)} />

      {/* Banner */}
      <div style={{
        position: 'fixed', bottom: 20, left: 20, right: 20,
        maxWidth: 560, margin: '0 auto',
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 16, padding: '20px 24px',
        boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
        zIndex: 9999, fontFamily: 'Inter, system-ui, sans-serif',
        animation: 'slideUp 0.3s ease',
      }}>
        <style>{`
          @keyframes slideUp {
            from { transform: translateY(20px); opacity: 0; }
            to   { transform: translateY(0);    opacity: 1; }
          }
        `}</style>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
          <span style={{ fontSize: 24, flexShrink: 0 }}>🍪</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: C.text, marginBottom: 4 }}>
              We use cookies
            </div>
            <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
              XavvySuite uses cookies to keep you signed in and improve your experience.
              We never sell your data. You can customise your preferences below.
              {' '}<a href="/privacy" target="_blank" style={{ color: C.primary, textDecoration: 'none' }}>Privacy Policy</a>
            </div>
          </div>
        </div>

        {/* Expanded preferences */}
        {expanded && (
          <div style={{ marginBottom: 16, borderRadius: 10, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
            {[
              {
                key: 'necessary', label: 'Necessary', icon: '🔒',
                desc: 'Authentication, security, session management. Cannot be disabled.',
                checked: true, disabled: true,
              },
              {
                key: 'functional', label: 'Functional', icon: '⚙️',
                desc: 'Remember your layout and theme preferences.',
                checked: prefs.functional, disabled: false,
              },
              {
                key: 'analytics', label: 'Analytics', icon: '📊',
                desc: 'Anonymous usage data to improve the product. No personal data shared.',
                checked: prefs.analytics, disabled: false,
              },
              {
                key: 'marketing', label: 'Marketing', icon: '📢',
                desc: 'Product updates and feature announcements by email.',
                checked: prefs.marketing, disabled: false,
              },
            ].map((item, i) => (
              <div key={item.key} style={{
                display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px',
                background: i % 2 === 0 ? C.elevated : C.card,
                borderBottom: i < 3 ? `1px solid ${C.border}` : 'none',
              }}>
                <span style={{ fontSize: 18, marginTop: 1 }}>{item.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{item.label}</div>
                  <div style={{ fontSize: 11, color: C.dim, lineHeight: 1.5, marginTop: 2 }}>{item.desc}</div>
                </div>
                {/* Toggle */}
                <div
                  onClick={() => !item.disabled && setPrefs(p => ({ ...p, [item.key]: !p[item.key as keyof typeof p] }))}
                  style={{
                    width: 40, height: 22, borderRadius: 11, flexShrink: 0, marginTop: 2,
                    background: item.checked ? C.primary : C.border,
                    cursor: item.disabled ? 'default' : 'pointer',
                    position: 'relative', transition: 'background 0.2s',
                    opacity: item.disabled ? 0.5 : 1,
                  }}
                >
                  <div style={{
                    position: 'absolute', top: 2,
                    left: item.checked ? 20 : 2,
                    width: 18, height: 18, borderRadius: '50%',
                    background: '#fff', transition: 'left 0.2s',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                  }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!expanded ? (
            <>
              <button onClick={acceptAll} style={{
                flex: 2, background: C.primary, color: '#fff', border: 'none',
                borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                boxShadow: `0 4px 14px ${C.primary}44`,
              }}>
                Accept all
              </button>
              <button onClick={acceptNecessary} style={{
                flex: 1, background: C.elevated, color: C.muted, border: `1px solid ${C.border}`,
                borderRadius: 10, padding: '10px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}>
                Necessary only
              </button>
              <button onClick={() => setExpanded(true)} style={{
                flex: 1, background: 'none', color: C.dim, border: `1px solid ${C.border}`,
                borderRadius: 10, padding: '10px 12px', fontSize: 13, cursor: 'pointer',
              }}>
                Customise
              </button>
            </>
          ) : (
            <>
              <button onClick={saveCustom} style={{
                flex: 2, background: C.primary, color: '#fff', border: 'none',
                borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}>
                Save preferences
              </button>
              <button onClick={acceptAll} style={{
                flex: 1, background: C.elevated, color: C.muted, border: `1px solid ${C.border}`,
                borderRadius: 10, padding: '10px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}>
                Accept all
              </button>
              <button onClick={() => setExpanded(false)} style={{
                background: 'none', color: C.dim, border: 'none', fontSize: 18, cursor: 'pointer', padding: '0 8px',
              }}>✕</button>
            </>
          )}
        </div>

        {/* Legal footer */}
        <div style={{ marginTop: 12, fontSize: 10, color: C.dim, lineHeight: 1.5 }}>
          By using XavvySuite you agree to our{' '}
          <a href="/terms" target="_blank" style={{ color: C.primary, textDecoration: 'none' }}>Terms of Service</a>
          {' '}and{' '}
          <a href="/privacy" target="_blank" style={{ color: C.primary, textDecoration: 'none' }}>Privacy Policy</a>.
          XavvySuite is operated as a data processor under UK GDPR. Your employer is the data controller.
        </div>
      </div>
    </>
  );
}

// ── Cookie Settings Panel (for Settings → Privacy tab) ────────
export function CookieSettingsPanel() {
  const consent = getConsent();
  const [prefs, setPrefs] = useState({
    functional: consent?.functional ?? false,
    analytics:  consent?.analytics  ?? false,
    marketing:  consent?.marketing  ?? false,
  });
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    const sessionId = getOrCreateSessionId();
    const updated: ConsentState = {
      necessary: true, ...prefs,
      sessionId, consentedAt: new Date().toISOString(),
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
    // Update server record
    await fetch(`/api/gdpr/consent/${sessionId}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(prefs),
    }).catch(() => {});
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleWithdraw = async () => {
    const sessionId = getOrCreateSessionId();
    await fetch(`/api/gdpr/consent/${sessionId}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ withdraw: true }),
    }).catch(() => {});
    localStorage.removeItem(SESSION_KEY);
    setPrefs({ functional: false, analytics: false, marketing: false });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
        Manage how XavvySuite uses cookies on your browser. Necessary cookies are always enabled
        as they are required for the platform to function.
        {consent?.consentedAt && (
          <div style={{ marginTop: 6, fontSize: 11, color: C.dim }}>
            Consent recorded: {new Date(consent.consentedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        )}
      </div>

      {saved && (
        <div style={{ background: C.success + '22', border: `1px solid ${C.success}44`, borderRadius: 10, padding: '10px 14px', color: C.success, fontSize: 12, marginBottom: 14 }}>
          ✅ Preferences saved
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {[
          { key: 'necessary',  label: 'Necessary',  icon: '🔒', desc: 'Login sessions, security tokens. Required.', disabled: true, value: true },
          { key: 'functional', label: 'Functional',  icon: '⚙️', desc: 'Layout preferences, theme, sidebar state.',  disabled: false, value: prefs.functional },
          { key: 'analytics',  label: 'Analytics',   icon: '📊', desc: 'Anonymous usage analytics to improve the product.', disabled: false, value: prefs.analytics },
          { key: 'marketing',  label: 'Marketing',   icon: '📢', desc: 'Feature announcements and product updates.', disabled: false, value: prefs.marketing },
        ].map(item => (
          <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: C.elevated, borderRadius: 10, border: `1px solid ${C.border}` }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span>{item.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{item.label}</span>
                {item.disabled && <span style={{ fontSize: 10, color: C.dim, background: C.border, borderRadius: 4, padding: '1px 6px' }}>Required</span>}
              </div>
              <div style={{ fontSize: 11, color: C.dim }}>{item.desc}</div>
            </div>
            <div
              onClick={() => !item.disabled && setPrefs(p => ({ ...p, [item.key]: !p[item.key as keyof typeof p] }))}
              style={{
                width: 44, height: 24, borderRadius: 12, flexShrink: 0,
                background: item.value ? C.primary : C.border,
                cursor: item.disabled ? 'default' : 'pointer',
                position: 'relative', transition: 'background 0.2s',
                opacity: item.disabled ? 0.5 : 1,
              }}
            >
              <div style={{
                position: 'absolute', top: 3,
                left: item.value ? 22 : 3,
                width: 18, height: 18, borderRadius: '50%',
                background: '#fff', transition: 'left 0.2s',
              }} />
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={handleSave} style={{ flex: 1, background: C.primary, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          Save preferences
        </button>
        <button onClick={handleWithdraw} style={{ background: 'none', color: C.danger, border: `1px solid ${C.danger}44`, borderRadius: 10, padding: '10px 16px', fontSize: 13, cursor: 'pointer' }}>
          Withdraw all
        </button>
      </div>
    </div>
  );
}
