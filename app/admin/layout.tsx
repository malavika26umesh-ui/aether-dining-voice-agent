'use client';

import Link from 'next/link';
import { signOut } from 'next-auth/react';

const NAV_LINKS = [
  { href: '/admin/dashboard', icon: 'dashboard',     label: 'Dashboard',          fill: true },
  { href: '#',               icon: 'calendar_today', label: 'Calendar',           fill: false },
  { href: '#',               icon: 'description',    label: 'Sheet Log',          fill: false },
  { href: '#',               icon: 'rule',           label: 'Availability Rules', fill: false },
  { href: '#',               icon: 'settings',       label: 'Settings',           fill: false },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-screen font-['Inter']"
      style={{ backgroundColor: '#FDFBF7', color: '#121212' }}
    >
      {/* LEFT SIDEBAR */}
      <aside className="h-screen w-64 fixed left-0 top-0 bg-white border-r border-[rgba(212,175,55,0.2)] flex flex-col py-8 px-0 z-50">
        {/* Brand */}
        <div className="mb-12 px-6">
          <h1 className="font-['Playfair_Display'] text-2xl text-[#D4AF37] tracking-widest font-bold">
            AETHER
          </h1>
          <p className="text-[10px] text-[#121212]/40 uppercase tracking-[0.2em] mt-1 font-bold">
            Management Portal
          </p>
        </div>

        {/* Nav */}
        <nav className="flex-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className={
                link.label === 'Dashboard'
                  ? 'flex items-center gap-3 px-6 py-4 transition-all duration-200 border-r-2 border-[#D4AF37] bg-[rgba(212,175,55,0.08)] font-semibold text-[#121212]'
                  : 'flex items-center gap-3 px-6 py-4 text-[#121212]/50 hover:bg-black/5 hover:text-[#121212] transition-all'
              }
            >
              <span
                className="material-symbols-outlined text-[20px]"
                style={link.fill ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                {link.icon}
              </span>
              <span className="text-[14px] leading-none tracking-[0.05em] font-[600]">
                {link.label}
              </span>
            </Link>
          ))}
        </nav>

        {/* User footer */}
        <div className="mt-auto px-6 pt-8 border-t border-[rgba(212,175,55,0.2)]">
          <div className="flex items-center gap-3 py-4">
            <div className="w-8 h-8 rounded-full bg-[#D4AF37]/10 flex items-center justify-center text-[#D4AF37] font-bold text-xs">
              A
            </div>
            <div className="overflow-hidden">
              <p className="text-[14px] leading-none font-[600] text-[#121212] truncate">
                Admin User
              </p>
              <button
                onClick={() => signOut({ callbackUrl: '/admin/login' })}
                className="text-[10px] text-[#121212]/40 hover:text-[#D4AF37] transition-colors mt-0.5"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN — offset by sidebar width */}
      <div className="ml-64 flex-1 flex flex-row min-h-screen">
        {children}
      </div>
    </div>
  );
}
