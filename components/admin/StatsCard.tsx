'use client';

interface StatsCardProps {
  label: string;
  value: string | number;
  delta?: string;
  deltaColor?: 'success' | 'warning' | 'muted';
  subtitle?: string;
  progressPercent?: number;
  valueUnit?: string;
}

export default function StatsCard({
  label,
  value,
  delta,
  deltaColor = 'success',
  subtitle,
  progressPercent,
  valueUnit,
}: StatsCardProps) {
  const deltaClass =
    deltaColor === 'success'
      ? 'text-[#34C759]'
      : deltaColor === 'warning'
      ? 'text-[#FF9500]'
      : 'text-[#121212]/40';

  return (
    <div className="bg-white border border-[rgba(212,175,55,0.2)] p-10">
      <div className="flex items-center justify-between mb-8">
        <p className="text-[12px] leading-none font-[500] text-[#121212]/40 uppercase tracking-widest font-bold">
          {label}
        </p>
        {delta && (
          <span className={`text-xs font-bold flex items-center gap-1 ${deltaClass}`}>
            {delta}
          </span>
        )}
        {!delta && subtitle && (
          <span className="text-[#121212]/40 text-xs font-bold uppercase">{subtitle}</span>
        )}
      </div>

      <h3 className="font-['Playfair_Display'] text-5xl text-[#121212]">
        {value}
        {valueUnit && (
          <span className="text-2xl font-['Inter'] font-normal text-[#121212]/40 ml-1">
            {valueUnit}
          </span>
        )}
      </h3>

      {progressPercent !== undefined && (
        <div className="w-full bg-black/5 h-[2px] mt-6">
          <div
            className="bg-[#D4AF37] h-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}
    </div>
  );
}
