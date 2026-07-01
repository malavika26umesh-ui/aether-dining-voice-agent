'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';

export default function AdminLoginPage() {
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // No credentials provider configured; Google OAuth is the auth method.
    handleGoogleSignIn();
  }

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    await signIn('google', { callbackUrl: '/admin/dashboard' });
    // signIn redirects — setGoogleLoading(false) only reached on error
    setGoogleLoading(false);
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 md:p-16 overflow-x-hidden"
      style={{
        backgroundColor: '#FDFBF7',
        backgroundImage:
          'radial-gradient(at 0% 0%, hsla(45,65%,95%,1) 0, transparent 50%), radial-gradient(at 100% 0%, hsla(45,65%,90%,1) 0, transparent 50%)',
      }}
    >
      {/* Ambient blobs */}
      <div className="fixed top-0 left-0 w-64 h-64 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none"
           style={{ background: 'rgba(212,175,55,0.05)', filter: 'blur(120px)' }} />
      <div className="fixed bottom-0 right-0 w-96 h-96 rounded-full translate-x-1/2 translate-y-1/2 pointer-events-none"
           style={{ background: 'rgba(229,169,59,0.05)', filter: 'blur(150px)' }} />

      <main className="w-full max-w-md animate-[fadeIn_0.8s_cubic-bezier(0.4,0,0.2,1)_forwards]">
        {/* Brand header */}
        <div className="text-center mb-10">
          <h1 className="font-['Playfair_Display'] text-5xl text-[#121212] tracking-widest uppercase font-bold">
            AETHER
          </h1>
          <p className="text-[12px] text-[#121212]/60 mt-2 tracking-widest uppercase font-[500]">
            Management Portal
          </p>
        </div>

        {/* Login card */}
        <div
          className="p-10 rounded-lg"
          style={{
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(212,175,55,0.2)',
            boxShadow: '0px 10px 30px rgba(212,175,55,0.1)',
          }}
        >
          <div className="mb-8 text-center">
            <span
              className="material-symbols-outlined text-[#D4AF37] text-4xl mb-4 block"
              style={{ fontVariationSettings: "'wght' 200" }}
            >
              lock_open
            </span>
            <h2 className="font-['Playfair_Display'] text-2xl text-[#121212] font-[500]">
              Secure Authentication
            </h2>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Manager ID */}
            <div className="relative group">
              <label
                htmlFor="manager_id"
                className="block text-[12px] text-[#121212]/70 mb-2 uppercase tracking-tighter font-[500]"
              >
                Manager ID
              </label>
              <div className="relative">
                <input
                  id="manager_id"
                  name="manager_id"
                  type="text"
                  placeholder="Enter your unique ID"
                  className="w-full bg-[#FDFBF7]/50 border-0 border-b-2 border-[rgba(212,175,55,0.2)] focus:border-[#D4AF37] outline-none px-0 py-3 text-[#121212] text-sm transition-all duration-300 placeholder:text-[#121212]/40"
                />
                <span className="material-symbols-outlined absolute right-0 top-3 text-[#121212]/20 group-focus-within:text-[#D4AF37] transition-colors">
                  badge
                </span>
              </div>
            </div>

            {/* Access Code */}
            <div className="relative group">
              <label
                htmlFor="access_code"
                className="block text-[12px] text-[#121212]/70 mb-2 uppercase tracking-tighter font-[500]"
              >
                Access Code
              </label>
              <div className="relative">
                <input
                  id="access_code"
                  name="access_code"
                  type="password"
                  placeholder="••••••••"
                  className="w-full bg-[#FDFBF7]/50 border-0 border-b-2 border-[rgba(212,175,55,0.2)] focus:border-[#D4AF37] outline-none px-0 py-3 text-[#121212] text-sm transition-all duration-300 placeholder:text-[#121212]/40"
                />
                <span className="material-symbols-outlined absolute right-0 top-3 text-[#121212]/20 group-focus-within:text-[#D4AF37] transition-colors">
                  key
                </span>
              </div>
            </div>

            {/* Primary CTA */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 text-[#121212] font-[600] text-[14px] tracking-widest uppercase font-bold transition-all duration-300 active:scale-[0.98] disabled:opacity-70"
                style={{
                  background: 'linear-gradient(to right, #D4AF37, #E5A93B)',
                  boxShadow: '0px 10px 30px rgba(212,175,55,0.1)',
                }}
              >
                {loading ? 'Authenticating...' : 'Sign In to Portal'}
              </button>
            </div>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-[rgba(212,175,55,0.2)]" />
            <span className="text-[11px] text-[#121212]/30 uppercase tracking-widest">or</span>
            <div className="flex-1 h-px bg-[rgba(212,175,55,0.2)]" />
          </div>

          {/* Google OAuth */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="w-full py-3 border border-[rgba(212,175,55,0.3)] flex items-center justify-center gap-3 text-[14px] text-[#121212]/70 hover:border-[#D4AF37] hover:text-[#121212] transition-all duration-300 disabled:opacity-60"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.64 9.2045C17.64 8.5663 17.5827 7.9527 17.4764 7.3636H9V10.845H13.8436C13.635 11.97 13.0009 12.9232 12.0477 13.5614V15.8196H14.9564C16.6582 14.2527 17.64 11.9455 17.64 9.2045Z" fill="#4285F4"/>
              <path d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8196L12.0477 13.5614C11.2418 14.1014 10.2109 14.4205 9 14.4205C6.65591 14.4205 4.67182 12.8373 3.96409 10.71H0.957275V13.0418C2.43818 15.9832 5.48182 18 9 18Z" fill="#34A853"/>
              <path d="M3.96409 10.71C3.78409 10.17 3.68182 9.5932 3.68182 9C3.68182 8.4068 3.78409 7.83 3.96409 7.29V4.9582H0.957275C0.347727 6.1732 0 7.5477 0 9C0 10.4523 0.347727 11.8268 0.957275 13.0418L3.96409 10.71Z" fill="#FBBC05"/>
              <path d="M9 3.5795C10.3214 3.5795 11.5077 4.0336 12.4405 4.9255L15.0218 2.3441C13.4632 0.8918 11.4259 0 9 0C5.48182 0 2.43818 2.0168 0.957275 4.9582L3.96409 7.29C4.67182 5.1627 6.65591 3.5795 9 3.5795Z" fill="#EA4335"/>
            </svg>
            {googleLoading ? 'Redirecting...' : 'Sign in with Google'}
          </button>

          {/* Secondary links */}
          <div className="mt-8 flex flex-col items-center gap-4">
            <a
              href="#"
              className="text-[12px] text-[#121212]/60 hover:text-[#D4AF37] transition-colors duration-300 border-b border-transparent hover:border-[#D4AF37] pb-0.5"
            >
              Forgot Password?
            </a>
            <div className="h-px w-8 bg-[rgba(212,175,55,0.2)]" />
            <a
              href="#"
              className="text-[12px] text-[#121212]/40 hover:text-[#121212] transition-colors duration-300 flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">support_agent</span>
              Need Support?
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-[12px] text-[#121212]/30 tracking-widest uppercase">
            © 2026 AETHER HOSPITALITY GROUP.{' '}
            <br className="md:hidden" />
            ALL RIGHTS RESERVED.
          </p>
        </div>
      </main>
    </div>
  );
}
