'use client';

import { useState, useEffect, useRef, MouseEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useVoiceSession } from '@/components/VoiceWidget/useVoiceSession';

export default function Reserve() {
  const [timeLeft, setTimeLeft] = useState(15 * 60);
  const [orbOffset, setOrbOffset] = useState({ x: 0, y: 0 });

  const router = useRouter();

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const {
    isConnected,
    isListening,
    isSpeaking,
    messages,
    error,
    inputVolume,
    outputVolume,
    micPermissionDenied,
    sessionState,
    startSession,
    stopSession,
    sendMessage,
    interrupt,
  } = useVoiceSession({
    // Fires after confirmation TTS finishes — redirect so user hears the code spoken
    onConfirmed: ({ code, occasion, date, time, table }) => {
      stopSession();
      const query = new URLSearchParams({ code, occasion, date, time, table }).toString();
      router.push(`/confirmation?${query}`);
    },
  });

  // Start the voice session automatically on mount
  useEffect(() => {
    startSession();
    return () => {
      stopSession();
    };
  }, []);

  // Countdown Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Scroll to bottom of transcripts
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Simulated Mouse Move Parallax on Orb
  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const orbContainer = e.currentTarget.getBoundingClientRect();
    const centerX = orbContainer.left + orbContainer.width / 2;
    const centerY = orbContainer.top + orbContainer.height / 2;
    
    const deltaX = (e.clientX - centerX) / 30;
    const deltaY = (e.clientY - centerY) / 30;
    
    setOrbOffset({ x: deltaX, y: deltaY });
  };

  const handleMouseLeave = () => {
    setOrbOffset({ x: 0, y: 0 });
  };

  const toggleSession = () => {
    if (isConnected) {
      stopSession();
    } else {
      startSession();
    }
  };

  // Dynamic Heading Text based on latest assistant prompt
  const lastAgentMsg = [...messages].reverse().find(m => m.role === 'assistant')?.content;
  const headingText = lastAgentMsg || "Welcome to Aether Dining! I'm here to help you reserve a table.";

  // Dynamic Orb scale based on microphone input or speaker output volume
  const volume = isListening ? inputVolume : (isSpeaking ? outputVolume : 0);
  const orbScale = 1.0 + volume * 1.5;

  return (
    <div 
      className="bg-obsidian text-on-surface min-h-screen overflow-y-auto font-body-md text-body-md flex w-full"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <main className="flex flex-col md:flex-row min-h-screen w-full">
        {/* Left Panel: Voice Interface (2/3) */}
        <section className="w-full md:w-2/3 min-h-screen relative flex flex-col items-center justify-between p-6 md:p-margin-desktop bg-surface-container-lowest">
          {/* Header Controls */}
          <div className="w-full flex justify-between items-center z-10">
            <Link className="flex items-center gap-2 group transition-all" href="/">
              <span className="material-symbols-outlined text-primary group-hover:-translate-x-1 transition-transform">arrow_back</span>
              <span className="font-label-lg text-label-lg text-primary tracking-widest">EXIT EXPERIENCE</span>
            </Link>
            <div className="flex items-center gap-gutter">

              <button 
                onClick={toggleSession}
                className={`p-3 rounded-full border transition-colors flex items-center justify-center cursor-pointer ${
                  !isConnected 
                    ? 'bg-error/10 border-error/50 text-error' 
                    : 'border-primary/20 hover:bg-primary/10 text-primary'
                }`}
                id="muteBtn"
              >
                <span className={`material-symbols-outlined ${!isConnected ? 'text-error' : 'text-primary'}`}>
                  {!isConnected ? 'mic_off' : 'mic'}
                </span>
              </button>
            </div>
          </div>

          {/* Central Content: Morphing Orb */}
          <div className="flex flex-col items-center gap-12 flex-1 justify-center z-0 relative w-full">
            {/* Decorative background radial */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.1),transparent_70%)] pointer-events-none"></div>
            
            <div className="relative w-64 h-64 md:w-80 md:h-80">
              <div className="pulse-ring" style={{ animationDelay: '0s', transform: `scale(${orbScale})` }}></div>
              <div className="pulse-ring" style={{ animationDelay: '1s', transform: `scale(${orbScale * 1.2})` }}></div>
              <div 
                className="morphing-orb w-full h-full transition-transform duration-100 ease-out"
                style={{ 
                  transform: `scale(${orbScale}) translate(${orbOffset.x}px, ${orbOffset.y}px)` 
                }}
              ></div>
            </div>
            
            <div className="text-center space-y-6 max-w-xl px-4">
              <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg text-on-surface leading-tight transition-all duration-300">
                {headingText}
              </h1>
              {error && <p className="text-error font-body-sm text-body-sm">Error: {error}</p>}
            </div>
          </div>

          {/* Chat Transcript bubbles */}
          <div className="w-full max-w-2xl space-y-4 pb-8 z-10 overflow-y-auto max-h-[200px] scrollbar-thin px-4">
            <div className="flex flex-col gap-4">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`self-${msg.role === 'assistant' ? 'start' : 'end'} max-w-[85%] ${
                    msg.role === 'assistant' 
                      ? 'bg-charcoal p-5 rounded-xl rounded-bl-none shadow-lg border border-white/5' 
                      : 'border border-primary/40 bg-primary/5 p-5 rounded-xl rounded-br-none'
                  }`}
                >
                  <p className={`font-body-md text-body-md ${msg.role === 'assistant' ? 'text-on-surface' : 'text-primary'}`}>
                    {msg.content}
                  </p>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </section>

        {/* Right Panel: Hold Summary (1/3) */}
        <aside className="hidden md:flex md:w-1/3 min-h-screen bg-surface-container-low border-l border-primary/20 p-6 md:p-margin-desktop flex-col justify-center">
          <div className="glass-panel p-10 rounded-xl space-y-8 shadow-[0px_10px_30px_rgba(212,175,55,0.05)] relative overflow-hidden">
            {/* Subtle gold highlight in corner */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 blur-3xl rounded-full -mr-12 -mt-12"></div>
            
            <header className="space-y-2">
              <p className="font-label-lg text-label-lg text-primary tracking-[0.2em]">RESERVATION SUMMARY</p>
              <h2 className="font-headline-xl text-headline-xl text-on-surface">Confirming Details</h2>
            </header>
            
            <div className="space-y-6">
              <div className="border-b border-primary/10 pb-4">
                <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">OCCASION</label>
                <p className="font-headline-md text-headline-md text-on-surface">{sessionState?.occasion || 'Standard Dining'}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-gutter">
                <div className="border-b border-primary/10 pb-4">
                  <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">DATE</label>
                  <p className="font-body-lg text-body-lg text-on-surface font-semibold">{sessionState?.date || 'TBD'}</p>
                </div>
                <div className="border-b border-primary/10 pb-4">
                  <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">TIME</label>
                  <p className="font-body-lg text-body-lg text-on-surface font-semibold">
                    {sessionState?.time ? `${sessionState.time} IST` : 'TBD IST'}
                  </p>
                </div>
              </div>
              
              <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg flex items-center justify-between">
                <div>
                  <label className="font-label-sm text-label-sm text-primary block mb-1">STATUS</label>
                  <p className="font-body-md text-body-md text-on-surface font-bold">
                    {sessionState?.reservationCode 
                      ? `Confirmed: ${sessionState.reservationCode}` 
                      : sessionState?.awaitingConfirmation 
                      ? 'Awaiting confirmation...' 
                      : sessionState?.intent === 'book_new'
                      ? 'Filling details...'
                      : 'Waiting for details...'}
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-label-lg text-label-lg text-primary" id="timer">
                    {formatTime(timeLeft)}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="pt-8 space-y-6">
              {sessionState?.awaitingConfirmation ? (
                <button 
                  onClick={() => sendMessage('Yes')}
                  className="w-full bg-gradient-to-tr from-brushed-gold to-warm-amber text-obsidian font-bold py-4 rounded-lg block text-center cursor-pointer hover:scale-102 active:scale-98 transition-all shadow-[0px_0px_15px_rgba(212,175,55,0.3)]"
                >
                  CONFIRM TABLE
                </button>
              ) : (
                <button disabled className="w-full bg-primary/20 text-on-surface/40 font-bold py-4 rounded-lg block text-center cursor-not-allowed">
                  CONFIRM TABLE
                </button>
              )}
              <p className="font-body-sm text-body-sm text-on-surface-variant text-center opacity-60">
                By proceeding, you agree to AETHER's luxury service terms. Your data is encrypted and handled with the utmost discretion.
              </p>
            </div>
          </div>
          
          {/* Branding Logo at bottom right */}
          <div className="mt-auto pt-12 flex justify-end">
            <span className="font-display-lg text-headline-md text-primary tracking-[0.4em] opacity-30">AETHER</span>
          </div>
        </aside>
      </main>



      {/* Overlay HUD */}
      {isConnected && (isListening || isSpeaking) && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 md:-translate-x-[60%] flex flex-col items-center gap-3 z-20">
          <div className="bg-charcoal/80 backdrop-blur-md px-6 py-2 rounded-full border border-primary/10 flex items-center gap-4 text-primary animate-pulse pointer-events-none">
            <span className={`w-2 h-2 rounded-full ${isListening ? 'bg-success' : 'bg-primary'}`}></span>
            <span className="font-label-sm text-label-sm tracking-widest">
              {isListening ? 'LISTENING...' : 'AETHER IS SPEAKING...'}
            </span>
          </div>
          {/* Tap-to-Interrupt button — appears only while agent is speaking */}
          {isSpeaking && (
            <button
              onClick={interrupt}
              className="bg-charcoal/70 backdrop-blur-md px-5 py-2 rounded-full border border-brushed-gold/40 text-brushed-gold text-[11px] font-bold uppercase tracking-widest hover:bg-brushed-gold/10 active:scale-95 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">stop_circle</span>
              Tap to Interrupt
            </button>
          )}
        </div>
      )}
    </div>
  );
}

