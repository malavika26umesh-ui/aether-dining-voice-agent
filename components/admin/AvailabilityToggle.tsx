'use client';

interface AvailabilityToggleProps {
  occasion: string;
  isOpen: boolean;
  onChange: (occasion: string, value: boolean) => void;
}

export default function AvailabilityToggle({ occasion, isOpen, onChange }: AvailabilityToggleProps) {
  return (
    <div className={`flex items-center justify-between group transition-opacity ${isOpen ? 'opacity-100' : 'opacity-50'}`}>
      <div>
        <p className="text-[14px] leading-none tracking-[0.05em] font-[600] text-[#121212]">
          {occasion}
        </p>
        <p
          className={`text-[10px] font-bold uppercase tracking-wider mt-1 ${
            isOpen ? 'text-[#34C759]' : 'text-[#FF3B30]'
          }`}
        >
          {isOpen ? 'Open' : 'Closed'}
        </p>
      </div>

      <button
        role="switch"
        aria-checked={isOpen}
        aria-label={`Toggle ${occasion}`}
        onClick={() => onChange(occasion, !isOpen)}
        className={`w-12 h-6 relative transition-all rounded-full p-1 ${
          isOpen ? 'bg-[#D4AF37]' : 'bg-[#121212]/10'
        }`}
      >
        <span
          className={`block w-4 h-4 bg-white rounded-full transition-all duration-200 ${
            isOpen ? 'ml-auto' : 'mr-auto'
          }`}
        />
      </button>
    </div>
  );
}
