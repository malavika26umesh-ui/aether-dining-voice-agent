'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useVoiceSession } from './useVoiceSession';
import AudioWave from './AudioWave';

export default function VoiceWidget() {
  const [isOpen, setIsOpen] = useState(false);
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
    // Fires after the confirmation TTS finishes — redirect then so user hears the code
    onConfirmed: ({ code, occasion, date, time, table }) => {
      setIsOpen(false);
      stopSession();
      const query = new URLSearchParams({ code, occasion, date, time, table }).toString();
      router.push(`/confirmation?${query}`);
    },
  });

  // Scroll to bottom of chat history when messages update
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const toggleWidget = () => {
    if (isOpen) {
      stopSession();
      setIsOpen(false);
    } else {
      setIsOpen(true);
      startSession();
    }
  };



  // Determine the display status text
  let statusText = 'Initializing...';
  if (isConnected) {
    if (isListening) {
      statusText = 'Listening... Speak now';
    } else if (isSpeaking) {
      statusText = 'Aether is speaking...';
    } else {
      statusText = 'Thinking...';
    }
  } else if (error) {
    statusText = 'Connection failed';
  } else if (micPermissionDenied) {
    statusText = 'Microphone blocked';
  }

  return (
    <div className="fixed bottom-8 right-8 z-[100] flex flex-col items-end gap-4" id="voice-widget-container">
      {/* Chat Card */}
      <div
        className={`${
          isOpen ? 'scale-100 opacity-100 flex' : 'scale-95 opacity-0 hidden'
        } w-[360px] h-[600px] glass-panel rounded-xl flex-col overflow-hidden shadow-2xl transition-all duration-500 origin-bottom-right`}
        id="voice-card"
      >
        {/* Header */}
        <div className="p-6 border-b border-primary/20 flex justify-between items-center bg-charcoal/50">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success animate-pulse' : 'bg-danger'}`}></div>
            <span className="font-label-lg text-label-lg text-brushed-gold uppercase">TableVoice Assistant</span>
          </div>
          <button
            className="text-on-surface-variant hover:text-soft-ivory transition-colors cursor-pointer"
            onClick={toggleWidget}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Chat Content */}
        <div className="flex-1 p-6 flex flex-col justify-between overflow-y-auto space-y-4">
          
          {/* Visualizer Area */}
          <div className="flex flex-col items-center text-center space-y-4 py-4 shrink-0">
            <AudioWave
              isActive={isConnected && (isListening || isSpeaking)}
              volume={isListening ? inputVolume : (isSpeaking ? outputVolume : 0)}
            />

            <div className="space-y-2">
              <p className="font-body-md text-body-md text-brushed-gold">{statusText}</p>
              {isListening && (
                <p className="font-label-sm text-label-sm text-on-surface-variant opacity-60">Speak now — I'm listening</p>
              )}
              {micPermissionDenied && (
                <p className="font-label-sm text-label-sm text-error opacity-80">Microphone blocked. Please allow access in your browser.</p>
              )}
              {/* Tap-to-Interrupt button — visible while agent is speaking */}
              {isSpeaking && (
                <button
                  onClick={interrupt}
                  className="mt-1 px-4 py-1.5 rounded-full border border-brushed-gold/40 text-brushed-gold text-[11px] font-bold uppercase tracking-widest hover:bg-brushed-gold/10 active:scale-95 transition-all flex items-center gap-1.5 mx-auto"
                >
                  <span className="material-symbols-outlined text-sm">stop_circle</span>
                  Tap to Interrupt
                </button>
              )}
            </div>
          </div>

          {/* Transcript / Messages */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin" id="chat-messages-scroll-area">
            {messages.length === 0 ? (
              <div className="text-center py-8 text-on-surface-variant/40 font-body-sm text-body-sm">
                Voice session started. How can we help you today?
              </div>
            ) : (
              messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end pl-8' : 'items-start pr-8'}`}
                >
                  <div
                    className={`p-4 rounded-lg text-left ${
                      msg.role === 'user'
                        ? 'bg-primary/10 border border-primary/10 text-soft-ivory'
                        : 'bg-charcoal border border-white/5 text-soft-ivory'
                    }`}
                  >
                    <p className={`font-label-sm text-label-sm mb-1 ${msg.role === 'user' ? 'text-primary' : 'text-on-surface-variant'}`}>
                      {msg.role === 'user' ? 'User' : 'Aether'}
                    </p>
                    <p className="font-body-md text-body-md break-words">{msg.content}</p>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>


      </div>

      {/* Floating Button */}
      <div className="relative group">
        {/* Tooltip */}
        <div className="absolute right-full mr-4 top-1/2 -translate-y-1/2 glass-panel px-4 py-2 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <span className="font-label-sm text-label-sm text-brushed-gold">Reserve with Voice (No Forms)</span>
        </div>
        <button
          className={`w-16 h-16 rounded-full bg-gradient-to-tr from-brushed-gold to-warm-amber flex items-center justify-center text-obsidian shadow-2xl hover:scale-110 active:scale-95 transition-all duration-300 amber-glow cursor-pointer ${
            isOpen ? 'rotate-90' : ''
          }`}
          id="voice-fab"
          onClick={toggleWidget}
        >
          <span className="material-symbols-outlined text-3xl" id="voice-icon">
            {isOpen ? 'close' : 'mic'}
          </span>
        </button>
      </div>
    </div>
  );
}

