'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase';

interface AuthFormProps {
  onPreview: () => void;
}

export default function AuthForm({ onPreview }: AuthFormProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const supabase = createClient();

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);

    if (!email || !password) {
      setError('Please enter email and password');
      setLoading(false);
      return;
    }

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    } else {
      const siteUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const { error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          emailRedirectTo: `${siteUrl}/`
        }
      });
      if (error) setError(error.message);
      else setMessage('Check your email to confirm your account!');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">💰</div>
          <h1 className="text-2xl font-bold text-white">CashFlow</h1>
          <p className="text-gray-500 mt-1">Track your daily cash flow</p>
        </div>

        {/* Preview Mode Button */}
        <button 
          onClick={onPreview}
          className="w-full mb-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-all"
        >
          <span className="text-lg">🎮</span>
          <span>Try Preview Mode</span>
        </button>
        
        <div className="text-center text-xs text-gray-500 mb-4 px-4">
          <p>Preview mode is a fully functional sandbox. Your data stays in your browser and is cleared when you leave.</p>
        </div>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-800"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-gray-950 px-2 text-gray-600">or sign in to save</span>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">{isLogin ? 'Sign In' : 'Create Account'}</h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-500 uppercase block mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white" placeholder="you@example.com" />
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase block mb-1">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white" placeholder="••••••••" onKeyDown={(e) => e.key === 'Enter' && handleSubmit()} />
            </div>
            {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>}
            {message && <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm">{message}</div>}
            <button onClick={handleSubmit} disabled={loading} className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg">{loading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}</button>
          </div>
          <div className="mt-4 text-center">
            <button onClick={() => { setIsLogin(!isLogin); setError(null); setMessage(null); }} className="text-sm text-gray-400 hover:text-white">{isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}</button>
          </div>
        </div>
        <div className="mt-6 text-center text-xs text-gray-600"><p>Tip: Add to Home Screen for the best experience</p></div>
      </div>
    </div>
  );
}
