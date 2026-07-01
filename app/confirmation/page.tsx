'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function formatIsoDate(dateStr: string) {
  if (!dateStr) return 'TBD';
  try {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const date = new Date(year, month, day);
    
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  } catch (e) {
    return dateStr;
  }
}

function format24hTime(timeStr: string) {
  if (!timeStr) return 'TBD';
  try {
    const parts = timeStr.split(':');
    if (parts.length !== 2) return timeStr;
    const hour = parseInt(parts[0], 10);
    const minute = parseInt(parts[1], 10);
    
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    const displayMinute = String(minute).padStart(2, '0');
    return `${displayHour}:${displayMinute} ${ampm} IST`;
  } catch (e) {
    return timeStr;
  }
}

function ConfirmationTicket() {
  const [showToast, setShowToast] = useState(false);
  const searchParams = useSearchParams();

  const code = searchParams.get('code') || 'TABLE-R07';
  const occasion = searchParams.get('occasion') || 'Standard Dining';
  const rawDate = searchParams.get('date') || '2026-06-14';
  const rawTime = searchParams.get('time') || '19:00';
  const table = searchParams.get('table') || '';

  const formattedDate = formatIsoDate(rawDate);
  const formattedTime = format24hTime(rawTime);

  const copyCode = () => {
    navigator.clipboard.writeText(code).then(() => {
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    });
  };

  return (
    <div className="max-w-[500px] w-full flex flex-col items-center">
      {/* Branding Anchor (Top of Ticket) */}
      <div className="mb-8 text-center">
        <h1 className="font-headline-md text-headline-md font-bold text-primary tracking-widest uppercase mb-2">AETHER</h1>
        <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest">Exclusive Reservations</p>
      </div>

      {/* Ticket Component */}
      <div className="glass-card w-full rounded-xl overflow-visible p-8 md:p-10 flex flex-col items-center relative">
        {/* Ticket Notches Helper */}
        <div className="ticket-divider"></div>
        
        {/* Success Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-full border border-brushed-gold flex items-center justify-center amber-glow mb-4">
            <span className="material-symbols-outlined text-primary text-4xl">check_circle</span>
          </div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface mb-1">Your Table is Held</h2>
          <p className="font-body-md text-body-md text-on-surface-variant text-center">Confirmation secured for your arrival</p>
        </div>

        {/* Reservation Code Section */}
        <div 
          onClick={copyCode}
          className="w-full bg-black/40 border border-primary/20 rounded-lg p-6 mb-8 flex flex-col items-center group cursor-pointer active:scale-[0.98] transition-transform"
        >
          <span className="font-label-sm text-label-sm text-primary uppercase tracking-tighter mb-2">Reservation Code</span>
          <div className="flex items-center gap-3">
            <span className="font-mono text-3xl font-bold text-primary tracking-[0.2em]" id="res-code">{code}</span>
            <span className="material-symbols-outlined text-primary/60 group-hover:text-primary transition-colors">content_copy</span>
          </div>
        </div>

        {/* Reservation Grid Details */}
        <div className="w-full grid grid-cols-2 gap-y-8 gap-x-4 mb-20">
          <div>
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase block mb-1">Occasion</span>
            <span className="font-label-lg text-label-lg text-on-surface">{occasion}</span>
          </div>
          <div className="text-right">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase block mb-1">Table</span>
            <span className="font-label-lg text-label-lg text-on-surface font-mono">{table || 'Main Dining Room'}</span>
          </div>
          <div>
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase block mb-1">Date</span>
            <span className="font-label-lg text-label-lg text-on-surface">{formattedDate}</span>
          </div>
          <div className="text-right">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase block mb-1">Time</span>
            <span className="font-label-lg text-label-lg text-on-surface">{formattedTime}</span>
          </div>
        </div>

        {/* Lower Ticket Section (Below the Notch/Divider) */}
        <div className="w-full pt-4">
          <p className="font-body-sm text-body-sm text-on-surface-variant italic text-center mb-0 opacity-80">
            Show this code to the host upon arrival at the grand entrance.
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="w-full flex flex-col gap-4 mt-10">
        <button className="w-full py-4 rounded-xl border border-brushed-gold text-primary font-label-lg text-label-lg uppercase tracking-widest hover:bg-primary/10 transition-all active:scale-95 amber-glow flex items-center justify-center gap-2 cursor-pointer">
          <span className="material-symbols-outlined text-xl">calendar_add_on</span>
          Add to Google Calendar
        </button>
        <Link 
          href="/"
          className="w-full py-4 rounded-xl text-on-surface-variant font-label-lg text-label-lg uppercase tracking-widest hover:text-on-surface transition-colors flex items-center justify-center gap-2 text-center"
        >
          <span className="material-symbols-outlined text-xl">arrow_back</span>
          Return to Website
        </Link>
      </div>

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-10 bg-surface-container-high border border-brushed-gold text-primary px-6 py-3 rounded-full font-label-lg shadow-2xl animate-bounce z-50">
          Code copied to clipboard
        </div>
      )}
    </div>
  );
}

export default function Confirmation() {
  return (
    <div className="bg-obsidian text-soft-ivory selection:bg-brushed-gold/30 antialiased min-h-screen flex flex-col items-center justify-center relative overflow-hidden w-full">
      {/* Subtle Ambient Background Light */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-warm-amber/10 blur-[150px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-brushed-gold/5 blur-[120px] rounded-full pointer-events-none"></div>

      <main className="w-full flex-grow flex items-center justify-center px-margin-mobile py-section-gap relative z-10">
        <Suspense fallback={<div className="text-primary font-label-lg text-label-lg uppercase tracking-widest">Loading Booking...</div>}>
          <ConfirmationTicket />
        </Suspense>
      </main>

      {/* Footer Component */}
      <footer className="w-full py-section-gap border-t border-primary/10 flex flex-col items-center gap-gutter max-w-container-max mx-auto px-margin-desktop mt-auto relative z-10">
        <h2 className="font-headline-lg text-headline-lg text-primary tracking-widest">AETHER</h2>
        <div className="flex flex-wrap justify-center gap-8">
          <a className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors opacity-80 hover:opacity-100" href="#">Privacy Policy</a>
          <a className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors opacity-80 hover:opacity-100" href="#">Terms of Service</a>
          <a className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors opacity-80 hover:opacity-100" href="#">Press Kit</a>
          <a className="font-body-sm text-body-sm text-on-surface-variant hover:text-primary transition-colors opacity-80 hover:opacity-100" href="#">Contact</a>
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant tracking-widest opacity-60">© 2024 AETHER HOSPITALITY GROUP. ALL RIGHTS RESERVED.</p>
      </footer>

      {/* Background Atmospheric Effect */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-30">
        <img 
          className="w-full h-full object-cover grayscale brightness-[0.2]" 
          alt="An ultra-luxury cocktail lounge with dimly lit obsidian walls." 
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuATzrvwSLTwzUy0_6Lcvwt7JMSo3tYFeOs5tqMS-SJdjbg8QZfnJClnoyKiPTPrMrBi_iAMJ2EyxMqb6dCSNCwnNjXQ1SXjIbGN4VYeHXRwXctz5XZg7CavQ6-h8aCYheqoCrZcGKGFu0l9ecNFq-0T-O-HaeSI03OvIZoNRLGjLRIz5TmRQvGoPPVocAYtmOtXK8N3z4Y28Wt2WgfdrYJg3V7qvuvnePSAu3vgtN7HY3e7MgcDNnq6Qn-6miOubJx8OEtSBXy0Og"
        />
      </div>
    </div>
  );
}
