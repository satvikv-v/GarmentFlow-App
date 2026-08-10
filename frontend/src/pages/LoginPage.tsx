import { useState, useMemo, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';
import { cn } from '../lib/utils';
import { Loader2, AlertCircle, Lock } from 'lucide-react';

export function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        setError('Invalid username or password. Please try again.');
      } else {
        setError('Could not connect to the server. Make sure the backend is running.');
      }
    } finally {
      setLoading(false);
    }
  }

  // Rotate login background on mount
  const bgImage = useMemo(() => {
    const bgs = [
      '/login-bg.png',
      '/watermark_shirts.png',
      '/watermark_pants.png',
      '/watermark_mixed.png'
    ];
    return bgs[Math.floor(Math.random() * bgs.length)];
  }, []);

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      {/* Left Column: Login Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 relative z-10">
        <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <div
            className="inline-flex w-12 h-12 items-center justify-center rounded-2xl font-bold text-white text-lg mb-4"
            style={{ backgroundColor: 'var(--color-accent)' }}
          >
            GF
          </div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: 'var(--color-text-primary)' }}
          >
            GarmentFlow
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            Sign in to your workspace
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl border p-6"
          style={{
            backgroundColor: 'var(--color-bg-surface)',
            borderColor: 'var(--color-border)',
          }}
        >
          {/* Error banner */}
          {error && (
            <div
              className="flex items-start gap-2.5 rounded-lg px-3.5 py-3 mb-5 text-sm border"
              style={{
                backgroundColor: 'var(--color-danger-subtle)',
                borderColor: 'var(--color-danger-border)',
                color: 'var(--color-danger)',
              }}
            >
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label
                htmlFor="login-username"
                className="block text-xs font-medium mb-1.5"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Username
              </label>
              <input
                id="login-username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="owner"
                className={cn(
                  'w-full rounded-lg px-3.5 py-2.5 text-sm outline-none transition-all',
                  'border focus:ring-2',
                )}
                style={{
                  backgroundColor: 'var(--color-bg-elevated)',
                  borderColor: error ? 'rgba(239,68,68,0.5)' : 'var(--color-border)',
                  color: 'var(--color-text-primary)',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--color-accent)';
                  e.target.style.boxShadow = '0 0 0 2px var(--color-accent-subtle)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = error ? 'rgba(239,68,68,0.5)' : 'var(--color-border)';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-medium mb-1.5"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••••••"
                  className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none transition-all border pr-10"
                  style={{
                    backgroundColor: 'var(--color-bg-elevated)',
                    borderColor: error ? 'rgba(239,68,68,0.5)' : 'var(--color-border)',
                    color: 'var(--color-text-primary)',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--color-accent)';
                    e.target.style.boxShadow = '0 0 0 2px var(--color-accent-subtle)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = error ? 'rgba(239,68,68,0.5)' : 'var(--color-border)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                <Lock
                  size={14}
                  className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: 'var(--color-text-muted)' }}
                />
              </div>
            </div>

            {/* Submit */}
            <button
              id="login-submit"
              type="submit"
              disabled={loading || !username || !password}
              className="btn btn-primary w-full mt-2"
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-4" style={{ color: 'var(--color-text-muted)' }}>
          GarmentFlow Factory Management &mdash; Internal Tool
        </p>
        </div>
      </div>
      
      {/* Right Column: Textile Image */}
      <div className="hidden lg:block lg:flex-1 relative">
        <img 
          src={bgImage} 
          alt="Premium woven textile texture" 
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Subtle overlay to blend the edge into the solid background */}
        <div 
          className="absolute inset-0" 
          style={{ background: 'linear-gradient(to right, var(--color-bg-base) 0%, transparent 15%)' }}
        />
      </div>
    </div>
  );
}
