import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { Briefcase, Lock, Mail, UserPlus, Eye, EyeOff } from 'lucide-react';

type Mode = 'login' | 'register' | 'forgot';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const role = 'Executive';
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const params = new URLSearchParams();
        params.append('username', email);
        params.append('password', password);

        const response = await fetch('/api/v1/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params,
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.detail || 'Invalid email or password');
        }

        const data = await response.json();
        
        // Fetch current user details
        const userResponse = await fetch('/api/v1/auth/me', {
          headers: {
            'Authorization': `Bearer ${data.access_token}`,
          },
        });

        if (!userResponse.ok) {
          throw new Error('Failed to retrieve user profile');
        }

        const userData = await userResponse.json();
        login(data.access_token, userData);
        navigate('/dashboard');
      } else if (mode === 'register') {
        const response = await fetch('/api/v1/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            password,
            full_name: fullName,
            role,
          }),
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.detail || 'Registration failed');
        }

        setMessage('Registration successful! Please log in.');
        setMode('login');
        setPassword('');
      } else if (mode === 'forgot') {
        const response = await fetch(`/api/v1/auth/forgot-password?email=${encodeURIComponent(email)}`, {
          method: 'POST',
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.detail || 'Failed to trigger reset');
        }

        setMessage('Mock reset link has been dispatched to your email.');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-background to-background p-4">
      <div className="w-full max-w-md glass-panel p-8 rounded-2xl shadow-2xl relative overflow-hidden">
        {/* Decorative lights */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col items-center mb-8 relative z-10">
          <div className="p-3 rounded-xl bg-primary/10 text-primary border border-primary/20 mb-3">
            <Briefcase className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">
            {mode === 'login' && 'Welcome Back'}
            {mode === 'register' && 'Create Account'}
            {mode === 'forgot' && 'Reset Password'}
          </h2>
          <p className="text-sm text-muted-foreground mt-1.5 text-center">
            {mode === 'login' && 'Sign in to access your AI CRM Dashboard'}
            {mode === 'register' && 'Join the team and streamline sales'}
            {mode === 'forgot' && 'Enter your email to receive recovery instructions'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-medium">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-medium mb-1.5 text-muted-foreground">Full Name</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="Charlie Executive"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-secondary/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                />
                <UserPlus className="absolute left-3 top-2.5 w-4.5 h-4.5 text-muted-foreground" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium mb-1.5 text-muted-foreground">Email Address</label>
            <div className="relative">
              <input
                type="email"
                required
                placeholder="charlie@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-secondary/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
              />
              <Mail className="absolute left-3 top-2.5 w-4.5 h-4.5 text-muted-foreground" />
            </div>
          </div>

          {mode !== 'forgot' && (
            <div>
              <label className="block text-xs font-medium mb-1.5 text-muted-foreground">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 bg-secondary/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                />
                <Lock className="absolute left-3 top-2.5 w-4.5 h-4.5 text-muted-foreground" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {mode === 'register' && (
            <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
              New self-service accounts are created with Executive access.
            </div>
          )}

          {mode === 'login' && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setMode('forgot')}
                className="text-xs text-primary hover:underline transition-all"
              >
                Forgot password?
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-primary hover:bg-primary/95 text-primary-foreground font-semibold text-sm transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
            ) : null}
            {mode === 'login' && 'Sign In'}
            {mode === 'register' && 'Register'}
            {mode === 'forgot' && 'Send Recovery Email'}
          </button>
        </form>

        <div className="mt-6 border-t border-border pt-4 text-center">
          {mode === 'login' && (
            <p className="text-xs text-muted-foreground">
              Don't have an account?{' '}
              <button onClick={() => setMode('register')} className="text-primary hover:underline font-semibold">
                Create one
              </button>
            </p>
          )}
          {mode === 'register' && (
            <p className="text-xs text-muted-foreground">
              Already have an account?{' '}
              <button onClick={() => setMode('login')} className="text-primary hover:underline font-semibold">
                Sign in
              </button>
            </p>
          )}
          {mode === 'forgot' && (
            <button onClick={() => setMode('login')} className="text-xs text-primary hover:underline font-semibold">
              Return to login
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
