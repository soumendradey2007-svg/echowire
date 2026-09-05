import React, { useState, useEffect, useRef } from 'react';
import type { AuthMode } from '../types';
import { apiFetch, setAuthToken } from '../lib/api';
import { IconEye, IconEyeOff } from '../components/Icons';
import LegalModal from '../components/LegalModal';

interface Props {
  mode: AuthMode;
  onModeChange: (m: AuthMode) => void;
  onAuth: (user?: any) => void;
}

export default function AuthView({ mode, onModeChange, onAuth }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailSentTo, setEmailSentTo] = useState<string | null>(null);
  const [verifyStatus, setVerifyStatus] = useState<string | null>(null);
  const [verifiedUser, setVerifiedUser] = useState<any>(null);

  // Legal & DPDP Act 2023 Compliance
  const [legalOpen, setLegalOpen] = useState(false);
  const [legalTab, setLegalTab] = useState<'privacy' | 'terms'>('privacy');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [guestAgreed, setGuestAgreed] = useState(false);

  // Bot Protection (Honeypot + Submission timing)
  const [honeypot, setHoneypot] = useState('');
  const formLoadTimestamp = useRef(Date.now());

  const [resetToken, setResetToken] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  const [guestName, setGuestName] = useState('');
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [pendingJoinRoom, setPendingJoinRoom] = useState<string | null>(null);

  const [googleLoaded, setGoogleLoaded] = useState(false);
  const [googleBlocked, setGoogleBlocked] = useState(false);
  const rememberMeRef = useRef(rememberMe);

  useEffect(() => {
    rememberMeRef.current = rememberMe;
  }, [rememberMe]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinId = params.get('joinRoom');
    if (joinId) {
      setPendingJoinRoom(joinId);
      setIsGuestMode(true);
    }
    const rToken = params.get('reset_token');
    if (rToken) {
      setResetToken(rToken);
      onModeChange('forgot');
    }
    // Clean URL params after reading so they don't persist after logout/navigation
    if (rToken || joinId) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleGuestLogin = async () => {
    setError(null);
    if (!guestName.trim()) {
      setError('Please enter a display name to continue');
      return;
    }
    if (!guestAgreed) {
      setError('You must agree to the Terms of Service and Privacy Policy to continue as a guest.');
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch('/api/auth/guest', {
        method: 'POST',
        body: JSON.stringify({ username: guestName.trim() }),
      });
      onAuth(res?.user);
    } catch (err: any) {
      setError(err.message || 'Failed to enter as guest');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verifyToken = params.get('verify_token');
    if (verifyToken) {
      setLoading(true);
      apiFetch(`/api/auth/verify?token=${verifyToken}`)
        .then((res: any) => {
          if (res?.user) {
            setVerifiedUser(res.user);
          }
          setVerifyStatus('success');
          window.history.replaceState({}, '', '/');
          setTimeout(() => onAuth(res?.user), 1000);
        })
        .catch((err) => {
          setVerifyStatus('error');
          setError(err.message || 'Verification failed');
        })
        .finally(() => setLoading(false));
    }
  }, []);

  const GOOGLE_CLIENT_ID = '217664802574-sk6blcmddomtucjia25le32mq2r7iod4.apps.googleusercontent.com';

  useEffect(() => {
    setGoogleLoaded(false);
    let mounted = true;

    const renderGoogleButtons = () => {
      if (typeof (window as any).google?.accounts?.id !== 'undefined') {
        const google = (window as any).google;
        try {
          google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: async (response: any) => {
              if (!response.credential) return;
              setLoading(true);
              setError(null);
              try {
                const res = await apiFetch('/api/auth/google', {
                  method: 'POST',
                  body: JSON.stringify({
                    credential: response.credential,
                    rememberMe: rememberMeRef.current,
                  }),
                });
                if (res?.token) {
                  setAuthToken(res.token, rememberMeRef.current);
                }
                onAuth(res?.user);
              } catch (err: any) {
                setError(err.message || 'Google sign-in failed');
              } finally {
                if (mounted) setLoading(false);
              }
            },
          });

          const targets = ['google-btn-signup', 'google-btn-signin'];
          for (const tid of targets) {
            const el = document.getElementById(tid);
            if (el && !el.getAttribute('data-rendered')) {
              el.innerHTML = '';
              google.accounts.id.renderButton(el, {
                theme: 'filled_black',
                size: 'large',
                width: 340,
                text: 'continue_with',
                shape: 'rectangular',
              });
              el.setAttribute('data-rendered', 'true');
              if (mounted) setGoogleLoaded(true);
            }
          }
        } catch (err) {
          console.error('[Google GIS Error]', err);
        }
      }
    };

    renderGoogleButtons();
    const interval = setInterval(renderGoogleButtons, 300);
    const blockTimer = setTimeout(() => {
      if (mounted && typeof (window as any).google?.accounts?.id === 'undefined') {
        setGoogleBlocked(true);
      }
    }, 4000);

    return () => {
      mounted = false;
      clearInterval(interval);
      clearTimeout(blockTimer);
    };
  }, [mode, isGuestMode]);

  const inputCls =
    'w-full bg-zinc-900 border border-zinc-800 text-zinc-100 text-sm rounded px-3 py-2.5 outline-none focus:border-accent placeholder:text-zinc-600 transition-colors';
  const btnCls =
    'w-full bg-accent text-white text-sm font-medium py-2.5 rounded hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50';
  const linkCls = 'text-accent text-sm hover:underline cursor-pointer';

  const renderLegalModal = () => (
    <LegalModal
      isOpen={legalOpen}
      onClose={() => setLegalOpen(false)}
      defaultTab={legalTab}
      onAccept={() => {
        setAgreedToTerms(true);
        setGuestAgreed(true);
        setLegalOpen(false);
      }}
    />
  );

  const handleRegister = async () => {
    setError(null);
    if (!username.trim()) return setError('Please enter a username');
    if (!email.trim()) return setError('Please enter your email');
    if (password.length < 8) return setError('Password must be at least 8 characters');
    if (password !== confirmPassword) {
      return setError('Passwords do not match. Please re-enter your password.');
    }
    if (!agreedToTerms) {
      return setError('You must review and agree to the Terms of Service and DPDP Act 2023 Privacy Policy to create an account.');
    }

    setLoading(true);
    try {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          username,
          email,
          password,
          agreedToTerms: true,
          website_hp: honeypot,
          formTimestamp: formLoadTimestamp.current,
        }),
      });
      if (res.requiresVerification) {
        setEmailSentTo(email);
      } else {
        if (res?.token) {
          setAuthToken(res.token, rememberMe);
        }
        onAuth(res?.user);
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ emailOrUsername: email, password, rememberMe }),
      });
      if (res?.token) {
        setAuthToken(res.token, rememberMe);
      }
      onAuth(res?.user);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  if (verifyStatus === 'success') {
    return (
      <AuthShell>
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-4 text-xl">&#10003;</div>
          <h2 className="text-lg font-semibold text-zinc-100 mb-2">Email Verified!</h2>
          <p className="text-zinc-400 text-sm mb-6">Logging you into EchoWire...</p>
          <button
            onClick={() => onAuth(verifiedUser)}
            className={btnCls}
          >
            Enter EchoWire Now &rarr;
          </button>
        </div>
      </AuthShell>
    );
  }

  if (verifyStatus === 'error') {
    return (
      <AuthShell>
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto mb-4 text-xl">&times;</div>
          <h2 className="text-lg font-semibold text-zinc-100 mb-2">Verification Link Expired or Used</h2>
          <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
            {error || 'This link may have already been used or expired. If your account is verified, you can sign in directly.'}
          </p>
          <button
            onClick={() => {
              setVerifyStatus(null);
              setError(null);
              onModeChange('signin');
            }}
            className={btnCls}
          >
            Sign In with Email &rarr;
          </button>
        </div>
      </AuthShell>
    );
  }

  if (emailSentTo) {
    return (
      <AuthShell>
        <div className="text-center py-6">
          <div className="w-12 h-12 rounded-full bg-accent/10 text-accent flex items-center justify-center mx-auto mb-4 text-xl">&#9993;</div>
          <h2 className="text-xl font-semibold text-zinc-100 mb-2">Check your email</h2>
          <p className="text-zinc-400 text-sm leading-relaxed mb-6">
            We sent a verification link to <span className="text-zinc-200 font-medium">{emailSentTo}</span>.<br />
            Click the link in your email to activate your account.
          </p>
          <button onClick={() => { setEmailSentTo(null); onModeChange('signin'); }} className={btnCls}>
            Back to Sign in
          </button>
        </div>
      </AuthShell>
    );
  }

  if (mode === 'landing') {
    return (
      <div className="h-full flex flex-col bg-zinc-950">
        <header className="flex items-center justify-between px-8 py-5 border-b border-zinc-900">
          <span className="text-zinc-100 font-semibold tracking-tight text-lg">EchoWire</span>
          <div className="flex items-center gap-3">
            <button onClick={() => onModeChange('signin')} className="text-zinc-400 text-sm hover:text-zinc-100 transition-colors cursor-pointer">
              Sign in
            </button>
            <button onClick={() => onModeChange('signup')} className="bg-accent text-white text-sm font-medium px-4 py-1.5 rounded hover:bg-accent/90 transition-colors cursor-pointer">
              Get started
            </button>
          </div>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="max-w-lg">
            <p className="text-zinc-500 text-sm font-medium tracking-wide uppercase mb-6">Voice chat for people who play</p>
            <h1 className="text-5xl font-semibold text-zinc-100 leading-tight mb-6 tracking-tight">
              Clear voice.<br />No distractions.
            </h1>
            <p className="text-zinc-400 text-lg leading-relaxed mb-10">
              EchoWire gives you high-quality voice rooms, text chat, and synchronized music — built for the way you actually play.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button onClick={() => onModeChange('signup')} className="bg-accent text-white font-medium px-6 py-2.5 rounded hover:bg-accent/90 transition-colors cursor-pointer">
                Create an account
              </button>
              <button onClick={() => onModeChange('signin')} className="text-zinc-300 font-medium px-6 py-2.5 rounded border border-zinc-800 hover:border-zinc-700 hover:text-zinc-100 transition-colors cursor-pointer">
                Sign in
              </button>
            </div>
          </div>
        </div>

        <footer className="px-8 py-4 border-t border-zinc-900 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-500 gap-2">
          <span>&copy; {new Date().getFullYear()} EchoWire. Built for seamless audio.</span>
          <div className="flex items-center gap-4">
            <button
              onClick={() => { setLegalTab('privacy'); setLegalOpen(true); }}
              className="hover:text-zinc-300 transition-colors cursor-pointer"
            >
              Privacy Policy (DPDP Act 2023)
            </button>
            <button
              onClick={() => { setLegalTab('terms'); setLegalOpen(true); }}
              className="hover:text-zinc-300 transition-colors cursor-pointer"
            >
              Terms of Service
            </button>
          </div>
        </footer>

        {renderLegalModal()}
      </div>
    );
  }

  if (mode === 'signup') {
    return (
      <AuthShell>
        <h2 className="text-xl font-semibold text-zinc-100 mb-1">Create account</h2>
        <p className="text-zinc-500 text-sm mb-5">Join EchoWire.</p>

        {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded">{error}</div>}

        {/* Google Sign-Up Button */}
        <div className="w-full mb-4">
          <div
            id="google-btn-signup"
            className="w-full flex justify-center items-center min-h-[44px]"
          >
            {!googleBlocked ? (
              <div className="w-full flex items-center justify-center gap-2.5 bg-zinc-900 border border-zinc-800 text-zinc-400 text-sm font-medium py-2.5 rounded min-h-[44px]">
                <svg className="animate-spin h-4 w-4 text-zinc-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Loading Google Sign-In...</span>
              </div>
            ) : (
              <div className="w-full p-2.5 bg-amber-500/10 border border-amber-500/20 rounded text-amber-300 text-xs text-center leading-relaxed">
                Google Sign-In blocked by browser shield. Please sign up with email or disable shields for this site.
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-zinc-800" />
          <span className="text-zinc-600 text-xs uppercase tracking-wider">or with email</span>
          <div className="flex-1 h-px bg-zinc-800" />
        </div>

        <div className="space-y-3">
          {/* Bot protection honeypot - invisible to legitimate users */}
          <input
            type="text"
            name="website_hp"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            style={{ display: 'none', position: 'absolute', opacity: 0, pointerEvents: 'none' }}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
          />

          <input className={inputCls} placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
          <input className={inputCls} placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          
          {/* Password with View Toggle */}
          <div className="relative">
            <input
              className={`${inputCls} pr-10`}
              placeholder="Password (min 8 characters)"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
              title={showPassword ? 'Hide password' : 'View password'}
            >
              {showPassword ? <IconEyeOff size={15} /> : <IconEye size={15} />}
            </button>
          </div>

          {/* Re-enter Password with View Toggle */}
          <div className="relative">
            <input
              className={`${inputCls} pr-10`}
              placeholder="Re-enter your password"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
              title={showConfirmPassword ? 'Hide password' : 'View password'}
            >
              {showConfirmPassword ? <IconEyeOff size={15} /> : <IconEye size={15} />}
            </button>
          </div>

          {/* Affirmative Consent under Section 5 & 6 of DPDP Act 2023 */}
          <div className="flex items-start gap-2.5 pt-1 pb-1">
            <input
              id="agree-terms"
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded bg-zinc-900 border border-zinc-700 text-accent focus:ring-0 focus:ring-offset-0 cursor-pointer accent-accent shrink-0"
            />
            <label htmlFor="agree-terms" className="text-xs text-zinc-400 leading-relaxed cursor-pointer select-none">
              I agree to the{' '}
              <button
                type="button"
                onClick={() => { setLegalTab('terms'); setLegalOpen(true); }}
                className="text-accent underline hover:text-accent/80 font-medium cursor-pointer"
              >
                Terms of Service
              </button>{' '}
              and{' '}
              <button
                type="button"
                onClick={() => { setLegalTab('privacy'); setLegalOpen(true); }}
                className="text-accent underline hover:text-accent/80 font-medium cursor-pointer"
              >
                Privacy Policy (DPDP Act 2023)
              </button>.
            </label>
          </div>

          <button className={btnCls} onClick={handleRegister} disabled={loading}>
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </div>

        <p className="mt-5 text-center text-zinc-500 text-sm">
          Already have an account? <span className={linkCls} onClick={() => onModeChange('signin')}>Sign in</span>
        </p>
        {renderLegalModal()}
      </AuthShell>
    );
  }

  if (mode === 'forgot') {
    if (resetToken) {
      return (
        <AuthShell>
          <h2 className="text-xl font-semibold text-zinc-100 mb-1">Set New Password</h2>
          <p className="text-zinc-500 text-sm mb-5">Enter your new password below.</p>

          {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded">{error}</div>}

          <div className="space-y-3">
            <div className="relative">
              <input
                className={inputCls}
                placeholder="New password (min 8 characters)"
                type={showPassword ? 'text' : 'password'}
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
              </button>
            </div>
            <div className="relative">
              <input
                className={inputCls}
                placeholder="Confirm new password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={resetConfirmPassword}
                onChange={(e) => setResetConfirmPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                {showConfirmPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
              </button>
            </div>
            <button
              className={btnCls}
              disabled={loading}
              onClick={async () => {
                setError(null);
                if (resetPassword.length < 8) return setError('Password must be at least 8 characters');
                if (resetPassword !== resetConfirmPassword) return setError('Passwords do not match');
                setLoading(true);
                try {
                  const res = await apiFetch('/api/auth/reset-password', {
                    method: 'POST',
                    body: JSON.stringify({ token: resetToken, newPassword: resetPassword }),
                  });
                  setResetToken(null);
                  setResetPassword('');
                  setResetConfirmPassword('');
                  window.history.replaceState({}, '', '/');
                  onAuth(res?.user);
                } catch (err: any) {
                  setError(err.message || 'Password reset failed');
                } finally {
                  setLoading(false);
                }
              }}
            >
              {loading ? 'Updating password...' : 'Update Password & Enter EchoWire'}
            </button>
          </div>

          <p className="mt-5 text-center text-zinc-500 text-sm">
            <button
              type="button"
              className={linkCls}
              onClick={() => {
                setResetToken(null);
                setResetPassword('');
                setResetConfirmPassword('');
                setError(null);
                window.history.replaceState({}, '', '/');
                onModeChange('signin');
              }}
            >
              &larr; Cancel & return to sign in
            </button>
          </p>
        </AuthShell>
      );
    }

    if (forgotSent) {
      return (
        <AuthShell>
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full bg-accent/10 text-accent flex items-center justify-center mx-auto mb-4 text-xl">&#9993;</div>
            <h2 className="text-xl font-semibold text-zinc-100 mb-2">Reset link sent</h2>
            <p className="text-zinc-400 text-sm leading-relaxed mb-6">
              If an account exists for <span className="text-zinc-200 font-medium">{email}</span>, we have sent a password reset link to your inbox.
            </p>
            <button onClick={() => { setForgotSent(false); onModeChange('signin'); }} className={btnCls}>
              Back to Sign in
            </button>
          </div>
        </AuthShell>
      );
    }

    return (
      <AuthShell>
        <h2 className="text-xl font-semibold text-zinc-100 mb-1">Reset Password</h2>
        <p className="text-zinc-500 text-sm mb-5">Enter your email and we'll send you a password reset link.</p>

        {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded">{error}</div>}

        <div className="space-y-3">
          <input
            className={inputCls}
            placeholder="Your account email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button
            className={btnCls}
            disabled={loading}
            onClick={async () => {
              setError(null);
              if (!email.trim()) return setError('Please enter your email address');
              setLoading(true);
              try {
                await apiFetch('/api/auth/forgot-password', {
                  method: 'POST',
                  body: JSON.stringify({ email: email.trim() }),
                });
                setForgotSent(true);
              } catch (err: any) {
                setError(err.message || 'Failed to send reset email');
              } finally {
                setLoading(false);
              }
            }}
          >
            {loading ? 'Sending link...' : 'Send Reset Link'}
          </button>
        </div>

        <p className="mt-5 text-center text-zinc-500 text-sm">
          Remember your password? <span className={linkCls} onClick={() => onModeChange('signin')}>Sign in</span>
        </p>
      </AuthShell>
    );
  }

  if (isGuestMode) {
    return (
      <AuthShell>
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-zinc-100 mb-1">Join as Guest</h2>
          <p className="text-zinc-500 text-sm">
            {pendingJoinRoom ? 'Enter a temporary display name to join this room directly.' : 'Fast, temporary access without an account (Zoom-style).'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-zinc-400 text-xs font-medium mb-1.5">Temporary Display Name</label>
            <input
              className={inputCls}
              placeholder="e.g. Alex, Sarah, Guest"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGuestLogin()}
              autoFocus
            />
          </div>

          {/* Affirmative Consent for Guest access */}
          <div className="flex items-start gap-2.5 pt-1 pb-1">
            <input
              id="guest-agree-terms"
              type="checkbox"
              checked={guestAgreed}
              onChange={(e) => setGuestAgreed(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded bg-zinc-900 border border-zinc-700 text-accent focus:ring-0 focus:ring-offset-0 cursor-pointer accent-accent shrink-0"
            />
            <label htmlFor="guest-agree-terms" className="text-xs text-zinc-400 leading-relaxed cursor-pointer select-none">
              I agree to the{' '}
              <button
                type="button"
                onClick={() => { setLegalTab('terms'); setLegalOpen(true); }}
                className="text-accent underline hover:text-accent/80 font-medium cursor-pointer"
              >
                Terms
              </button>{' '}
              &{' '}
              <button
                type="button"
                onClick={() => { setLegalTab('privacy'); setLegalOpen(true); }}
                className="text-accent underline hover:text-accent/80 font-medium cursor-pointer"
              >
                Privacy Policy (DPDP Act 2023)
              </button>.
            </label>
          </div>

          <button className={btnCls} onClick={handleGuestLogin} disabled={loading}>
            {loading ? 'Entering...' : 'Continue as Guest'}
          </button>
        </div>

        <div className="mt-5 text-center">
          <button
            onClick={() => setIsGuestMode(false)}
            className="text-zinc-400 hover:text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
          >
            Have an account? Sign in instead
          </button>
        </div>
        {renderLegalModal()}
      </AuthShell>
    );
  }

  // Sign In Mode
  return (
    <AuthShell>
      <h2 className="text-xl font-semibold text-zinc-100 mb-1">Sign in</h2>
      <p className="text-zinc-500 text-sm mb-5">Welcome back.</p>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded">
          <p>{error}</p>
        </div>
      )}

      {/* Google Sign-In Button */}
      <div className="w-full mb-4">
        <div
          id="google-btn-signin"
          className="w-full flex justify-center items-center min-h-[44px]"
        >
          {!googleBlocked ? (
            <div className="w-full flex items-center justify-center gap-2.5 bg-zinc-900 border border-zinc-800 text-zinc-400 text-sm font-medium py-2.5 rounded min-h-[44px]">
              <svg className="animate-spin h-4 w-4 text-zinc-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Loading Google Sign-In...</span>
            </div>
          ) : (
            <div className="w-full p-2.5 bg-amber-500/10 border border-amber-500/20 rounded text-amber-300 text-xs text-center leading-relaxed">
              Google Sign-In blocked by browser shield. Please sign in with email or disable shields for this site.
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-zinc-800" />
        <span className="text-zinc-600 text-xs uppercase tracking-wider">or with email</span>
        <div className="flex-1 h-px bg-zinc-800" />
      </div>

      <div className="space-y-3">
        <input className={inputCls} placeholder="Email or Username" value={email} onChange={(e) => setEmail(e.target.value)} />
        
        {/* Password with View Toggle */}
        <div className="relative">
          <input
            className={`${inputCls} pr-10`}
            placeholder="Password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
            title={showPassword ? 'Hide password' : 'View password'}
          >
            {showPassword ? <IconEyeOff size={15} /> : <IconEye size={15} />}
          </button>
        </div>

        {/* Keep Me Signed In & Forgot Password */}
        <div className="flex items-center justify-between py-0.5">
          <label className="flex items-center gap-2 cursor-pointer select-none group">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded bg-zinc-900 border border-zinc-700 text-accent focus:ring-0 focus:ring-offset-0 cursor-pointer accent-accent"
            />
            <span className="text-xs text-zinc-400 group-hover:text-zinc-200 transition-colors">
              Keep me signed in
            </span>
          </label>
          <button
            type="button"
            className={linkCls}
            onClick={() => onModeChange('forgot')}
          >
            Forgot password?
          </button>
        </div>

        <button className={btnCls} onClick={handleLogin} disabled={loading}>
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </div>

      <button
        type="button"
        onClick={() => setIsGuestMode(true)}
        className="w-full mt-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white text-xs font-medium transition-all cursor-pointer"
      >
        Continue as Guest (No account needed)
      </button>

      <div className="mt-4 text-center">
        <span className="text-zinc-500 text-xs">Don't have an account? </span>
        <button
          type="button"
          className={`${linkCls} text-xs`}
          onClick={() => onModeChange('signup')}
        >
          Create account
        </button>
      </div>

      <div className="mt-4 pt-3 border-t border-zinc-900 text-center text-[11px] text-zinc-500 leading-relaxed">
        By signing in, you agree to EchoWire's{' '}
        <button
          type="button"
          onClick={() => { setLegalTab('terms'); setLegalOpen(true); }}
          className="text-zinc-400 hover:text-zinc-200 underline cursor-pointer font-medium"
        >
          Terms of Service
        </button>{' '}
        and{' '}
        <button
          type="button"
          onClick={() => { setLegalTab('privacy'); setLegalOpen(true); }}
          className="text-zinc-400 hover:text-zinc-200 underline cursor-pointer font-medium"
        >
          Privacy Policy (DPDP Act 2023)
        </button>.
      </div>
      {renderLegalModal()}
    </AuthShell>
  );
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full flex flex-col items-center justify-center bg-zinc-950 px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <span className="text-zinc-100 font-semibold tracking-tight text-lg">EchoWire</span>
        </div>
        {children}
      </div>
    </div>
  );
}
