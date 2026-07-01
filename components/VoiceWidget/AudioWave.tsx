'use client';

import React from 'react';

interface AudioWaveProps {
  isActive: boolean;
  volume?: number;
}

export default function AudioWave({ isActive, volume = 0 }: AudioWaveProps) {
  const barCount = 7;
  const baseDelays = [0.1, 0.2, 0.3, 0.4, 0.5, 0.1, 0.2];

  return (
    <div className="audio-wave flex items-end justify-center h-12" id="audio-wave-visualizer">
      {Array.from({ length: barCount }).map((_, i) => {
        const delay = baseDelays[i];
        
        // Define default styling and overrides when active/inactive
        const style: React.CSSProperties = {
          animationDelay: `${delay}s`,
          transition: 'transform 0.1s ease-out',
        };

        if (!isActive) {
          // Disable CSS keyframe animation and set a small static height
          style.animation = 'none';
          style.height = '8px';
        } else if (volume > 0) {
          // Dynamically scale the wave height based on real-time microphone or speaker volume
          const scale = 0.6 + volume * 3.0 * (1 + Math.sin(i * 0.8) * 0.3);
          style.transform = `scaleY(${Math.min(scale, 3.0)})`;
        }

        return (
          <span
            key={i}
            className={`wave-${(i % 5) + 1}`}
            style={style}
          />
        );
      })}
    </div>
  );
}
