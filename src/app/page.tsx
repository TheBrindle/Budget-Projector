'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import AuthForm from '@/components/AuthForm';
import CashFlowApp from '@/components/CashFlowApp';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewMode, setPreviewMode] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      // Exit preview mode if user logs in
      if (session?.user) setPreviewMode(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  // Preview mode - sandboxed, no database saves
  if (previewMode) {
    return <CashFlowApp user={null} onExitPreview={() => setPreviewMode(false)} />;
  }

  if (!user) return <AuthForm onPreview={() => setPreviewMode(true)} />;
  return <CashFlowApp user={user} />;
}
