/**
 * OnboardingWizard.tsx
 * First-run setup wizard for new tenants.
 * Shows as a modal overlay until all steps are completed.
 * Steps: Profile → Leave Types → Team → Modules → Branding → Done
 */

import { useState, useEffect } from 'react';
import { useOnboardingWizard } from './hooks/api';
import { C } from './platform/branding/theme';
import { useQueryClient } from '@tanstack/react-query';

const API_URL = import.meta.env.VITE_API_URL ?? 'https://api-v2.xavvy.uk';

const STEPS = [
  { key: 'profile',  icon: '🏢', title: 'Company Profile',  desc: 'Set your company name, address and contact details' },
  { key: 'leave',    icon: '🌴', title: 'Leave Types',       desc: 'Review and configure leave types for your team' },
  { key: 'team',     icon: '👥', title: 'Invite Your Team',  desc: 'Add employees or send invite links' },
  { key: 'modules',  icon: '🧩', title: 'Enable Modules',    desc: 'Choose which features your team needs' },
  { key: 'branding', icon: '🎨', title: 'Branding',          desc: 'Add your logo and company colours' },
  { key: 'complete', icon: '🎉', title: 'All Done!',         desc: 'Your workspace is ready to use' },
];

async function markStep(step: string, next: string) {
  const tok = localStorage.getItem('xs_token') ?? '';
  await fetch(`\${API_URL}/api/onboarding/wizard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
    body: JSON.stringify({ step, next_step: next }),
  });
}

export default function OnboardingWizard({ onNavigate }: { onNavigate: (module: string) => void }) {
  const { data: wizard, isLoading, refetch } = useOnboardingWizard();
  const qc = useQueryClient();
  const [dismissed, setDismissed] = useState(() => !!localStorage.getItem('xv_wizard_dismissed'));
  const [stepIdx, setStepIdx] = useState(0);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    if (!wizard) return;
    const completed: string[] = JSON.parse(wizard.completed_steps ?? '[]');
    // Find first incomplete step
    const idx = STEPS.findIndex(s => !completed.includes(s.key));
    setStepIdx(idx === -1 ? STEPS.length - 1 : idx);
  }, [wizard]);

  if (isLoading) return null;

  // If tenant has completed all steps — don't show
  if (wizard) {
    const completed: string[] = JSON.parse(wizard.completed_steps ?? '[]');
    if (completed.includes('complete')) return null;
  }

  // Dismissed this browser session
  if (dismissed) return null;

  // If no wizard record at all for this tenant — show from step 0
  const completed: string[] = wizard ? JSON.parse(wizard.completed_steps ?? '[]') : [];
  const currentStep = STEPS[stepIdx] ?? STEPS[0];
  const pct = Math.round((completed.length / STEPS.length) * 100);

  const handleNext = async () => {
    setCompleting(true);
    try {
      const nextStep = STEPS[stepIdx + 1] ?? STEPS[STEPS.length - 1];
      await markStep(currentStep.key, nextStep.key);
      await refetch();
      if (stepIdx < STEPS.length - 1) {
        setStepIdx(i => i + 1);
      }
    } finally { setCompleting(false); }
  };

  const handleGoTo = () => {
    const nav: Record<string, string> = {
      profile:  'settings',
      leave:    'leave',
      team:     'hr',
      modules:  'settings',
      branding: 'settings',
    };
    const mod = nav[currentStep.key];
    if (mod) onNavigate(mod);
  };

  const handleDismiss = () => {
    localStorage.setItem('xv_wizard_dismissed', '1');
    setDismissed(true);
  };

  return (
    <>
      {/* Backdrop */}
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', zIndex: 8000 }} />

      {/* Wizard card */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 560, background: C.card, borderRadius: 20, border: `1px solid ${C.border}`,
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)', zIndex: 8001,
        fontFamily: 'Inter, system-ui, sans-serif', overflow: 'hidden',
      }}>
        {/* Progress bar */}
        <div style={{ height: 4, background: C.border }}>
          <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg,${C.primary},#8B5CF6)`, transition: 'width 0.5s ease' }} />
        </div>

        {/* Step dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '20px 24px 0' }}>
          {STEPS.map((s, i) => (
            <div key={s.key} onClick={() => completed.includes(s.key) && setStepIdx(i)}
              style={{
                width: i === stepIdx ? 24 : 8, height: 8, borderRadius: 4,
                background: completed.includes(s.key) ? C.primary : i === stepIdx ? C.primary : C.border,
                cursor: completed.includes(s.key) ? 'pointer' : 'default',
                transition: 'all 0.3s ease',
              }} />
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: '28px 32px' }}>
          {completed.includes('complete') || stepIdx === STEPS.length - 1 ? (
            /* Completion screen */
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: C.text, marginBottom: 8 }}>You're all set!</div>
              <div style={{ fontSize: 14, color: C.muted, marginBottom: 32, lineHeight: 1.6 }}>
                Your XavvySuite workspace is configured and ready.<br />
                Your team can now start logging time, requesting leave and managing projects.
              </div>
              <button onClick={async () => {
                await markStep('complete', 'complete');
                handleDismiss();
              }} style={{ background: `linear-gradient(135deg,${C.primary},#8B5CF6)`, color: '#fff', border: 'none', borderRadius: 12, padding: '14px 32px', fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>
                Go to Dashboard →
              </button>
            </div>
          ) : (
            /* Step screen */
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, background: C.primary + '22', border: `1px solid ${C.primary}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>
                  {currentStep.icon}
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.primary, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                    Step {stepIdx + 1} of {STEPS.length - 1}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: C.text }}>{currentStep.title}</div>
                </div>
              </div>

              <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.7, marginBottom: 24, background: C.elevated, borderRadius: 12, padding: '14px 16px' }}>
                {currentStep.desc}
                {currentStep.key === 'leave' && (
                  <div style={{ marginTop: 8, fontSize: 12, color: C.dim }}>
                    💡 We've pre-loaded UK statutory leave types. Review and adjust entitlements for your team.
                  </div>
                )}
                {currentStep.key === 'team' && (
                  <div style={{ marginTop: 8, fontSize: 12, color: C.dim }}>
                    💡 Go to HR → Add Employee to create employee records, or send email invites for self-registration.
                  </div>
                )}
                {currentStep.key === 'modules' && (
                  <div style={{ marginTop: 8, fontSize: 12, color: C.dim }}>
                    💡 Settings → Modules lets you enable/disable features. Unused modules stay hidden from your team.
                  </div>
                )}
              </div>

              {/* Completed steps list */}
              {completed.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Completed</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {STEPS.filter(s => completed.includes(s.key) && s.key !== 'complete').map(s => (
                      <span key={s.key} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: C.success + '22', color: C.success, fontWeight: 700 }}>
                        ✓ {s.title}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={handleGoTo} style={{ flex: 2, background: C.primary, color: '#fff', border: 'none', borderRadius: 12, padding: '12px 0', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: `0 4px 16px ${C.primary}44` }}>
                  Go to {currentStep.title} →
                </button>
                <button onClick={handleNext} disabled={completing} style={{ flex: 1, background: C.elevated, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 0', fontSize: 13, cursor: 'pointer' }}>
                  {completing ? '...' : 'Skip for now'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 24px 16px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 11, color: C.dim }}>{pct}% complete</div>
          <button onClick={handleDismiss} style={{ background: 'none', border: 'none', color: C.dim, fontSize: 12, cursor: 'pointer' }}>
            Dismiss wizard
          </button>
        </div>
      </div>
    </>
  );
}
