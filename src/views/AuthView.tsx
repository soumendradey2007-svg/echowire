import React, { useState, useEffect } from 'react';
import type { AuthMode } from '../types';
import { apiFetch } from '../lib/api';
import { IconEye, IconEyeOff } from '../components/Icons';

interface Props {
  mode: AuthMode;
  onModeChange: (m: AuthMode) => void;
  onAuth: (user?: any) => void;
}

export default function AuthView({ mode, onModeChange, onAuth }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailSentTo, setEmailSentTo] = useState<string | null>(null);
  const [verifyStatus, setVerifyStatus] = useState<string | null>(null);
  const [verifiedUser, setVerifiedUser] = useState<any>(null);

  const [guestName, setGuestName] = useState('');
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [pendingJoinRoom, setPendingJoinRoom] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinId = params.get('joinRoom');
    if (joinId) {
      setPendingJoinRoom(joinId);
      setIsGuestMode(true);
    }
  }, []);

  const handleGuestLogin = async () => {
    setError(null);
    if (!guestName.trim()) {
      setError('Please enter a display name to continue');
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

  const inputCls =
    'w-full bg-zinc-900 border border-zinc-800 text-zinc-100 text-sm rounded px-3 py-2.5 outline-none focus:border-accent placeholder:text-zinc-600 transition-colors';
  const btnCls =
    'w-full bg-accent text-white text-sm font-medium py-2.5 rounded hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50';
  const linkCls = 'text-accent text-sm hover:underline cursor-pointer';

  const handleRegister = async () => {
    setError(null);
    if (!username.trim()) return setError('Please enter a username');
    if (!email.trim()) return setError('Please enter your email');
    if (password.length < 8) return setError('Password must be at least 8 characters');
    if (password !== confirmPassword) {
      return setError('Passwords do not match. Please re-enter your password.');
    }

    setLoading(true);
    try {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, email, password }),
      });
      if (res.requiresVerification) {
        setEmailSentTo(email);
      } else {
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
        body: JSON.stringify({ emailOrUsername: email, password }),
      });
      onAuth(res?.user);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const GOOGLE_CLIENT_ID = '217664802574-sk6blcmddomtucjia25le32mq2r7iod4.apps.googleusercontent.com';

  const handleGoogleClick = () => {
    if (typeof (window as any).google === 'undefined') {
      setError('Google Sign-In is initializing. Please try again in 2 seconds.');
      return;
    }
    const google = (window as any).google;
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (response: any) => {
        if (!response.credential) return;
        setLoading(true);
        setError(null);
        try {
          const res = await apiFetch('/api/auth/google', {
            method: 'POST',
            body: JSON.stringify({ credential: response.credential }),
          });
          onAuth(res?.user);
        } catch (err: any) {
          setError(err.message || 'Google sign-in failed');
        } finally {
          setLoading(false);
        }
      },
    });
    google.accounts.id.prompt();
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
        <button
          type="button"
          onClick={handleGoogleClick}
          className="w-full mb-4 flex items-center justify-center gap-2.5 bg-zinc-900 border border-zinc-800 text-zinc-200 text-sm font-medium py-2.5 rounded hover:bg-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer"
        >
          <svg width="16" height="16" viewBox="0 0 24 24">
            <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"/>
            <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"/>
            <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3 0-.8.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12 0 14.5s.7 4.8 1.9 7.2l3.7-2.9z"/>
            <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 17C3.7 20.7 7.5 24 12 24z"/>
          </svg>
          Continue with Google
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-zinc-800" />
          <span className="text-zinc-600 text-xs uppercase tracking-wider">or with email</span>
          <div className="flex-1 h-px bg-zinc-800" />
        </div>

        <div className="space-y-3">
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

          <button className={btnCls} onClick={handleRegister} disabled={loading}>
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </div>

        <p className="mt-5 text-center text-zinc-500 text-sm">
          Already have an account? <span className={linkCls} onClick={() => onModeChange('signin')}>Sign in</span>
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
      <button
        type="button"
        onClick={handleGoogleClick}
        className="w-full mb-4 flex items-center justify-center gap-2.5 bg-zinc-900 border border-zinc-800 text-zinc-200 text-sm font-medium py-2.5 rounded hover:bg-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer"
      >
        <svg width="16" height="16" viewBox="0 0 24 24">
          <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"/>
          <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"/>
          <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3 0-.8.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12 0 14.5s.7 4.8 1.9 7.2l3.7-2.9z"/>
          <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 17C3.7 20.7 7.5 24 12 24z"/>
        </svg>
        Continue with Google
      </button>

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
      <div className="mt-4 flex items-center justify-between">
        <span className={linkCls} onClick={() => onModeChange('forgot')}>Forgot password?</span>
        <span className={`${linkCls} text-zinc-500`} onClick={() => onModeChange('signup')}>
          Create account
        </span>
      </div>
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
