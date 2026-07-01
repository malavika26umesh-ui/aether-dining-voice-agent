'use client';

export type ReservationStatus = 'CONFIRMED' | 'CANCELLED' | 'RESCHEDULED' | 'NO_SHOW';

export interface ReservationRow {
  timestamp: string;
  code: string;
  date: string;
  time: string;
  occasion: string;
  partySize: number;
  status: ReservationStatus;
  notes?: string;
}

interface BookingsTableProps {
  rows: ReservationRow[];
}

const STATUS_STYLES: Record<ReservationStatus, { dot: string; text: string; label: string }> = {
  CONFIRMED:   { dot: 'bg-[#34C759]', text: 'text-[#34C759]', label: 'CONFIRMED' },
  CANCELLED:   { dot: 'bg-[#FF3B30]', text: 'text-[#FF3B30]', label: 'CANCELLED' },
  RESCHEDULED: { dot: 'bg-[#FF9500]', text: 'text-[#FF9500]', label: 'RESCHEDULED' },
  NO_SHOW:     { dot: 'bg-[#121212]/30', text: 'text-[#121212]/40', label: 'NO SHOW' },
};

const OCCASION_FILLED = ['Special Occasion/Anniversary', 'Large Group (6+)'];

function OccasionChip({ occasion }: { occasion: string }) {
  const isFilled = OCCASION_FILLED.includes(occasion);
  const short = occasion.replace('/Anniversary', '').replace(' (6+)', ' 6+');
  return isFilled ? (
    <span className="text-[10px] font-bold uppercase tracking-widest bg-[#121212] text-white px-3 py-1 whitespace-nowrap">
      {short}
    </span>
  ) : (
    <span className="text-[10px] font-bold uppercase tracking-widest border border-[#121212]/20 px-3 py-1 whitespace-nowrap">
      {short}
    </span>
  );
}

function formatTimestamp(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return iso;
  }
}

export default function BookingsTable({ rows }: BookingsTableProps) {
  return (
    <section className="bg-white border border-[rgba(212,175,55,0.2)] overflow-hidden flex flex-col">
      {/* Table header bar */}
      <div className="px-10 py-8 flex items-center justify-between border-b border-[rgba(212,175,55,0.3)]">
        <h3 className="font-['Playfair_Display'] text-2xl text-[#121212]">Active Bookings</h3>
        <div className="flex gap-4">
          <button className="px-6 py-2 border border-[#121212]/10 text-[14px] leading-none tracking-[0.05em] font-[600] text-[#121212]/60 hover:border-[#D4AF37] hover:text-[#D4AF37] transition-colors">
            Filter
          </button>
          <button className="bg-[#D4AF37] text-white px-8 py-2 text-[14px] leading-none tracking-[0.05em] font-bold hover:bg-[#121212] transition-colors">
            New Reservation
          </button>
        </div>
      </div>

      {/* Scrollable table */}
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#FDFBF7]/50 border-b border-[rgba(212,175,55,0.3)]">
              {['Timestamp', 'Code', 'Date', 'Time (IST)', 'Occasion', 'Party', 'Status', 'Actions'].map(
                (col, i) => (
                  <th
                    key={col}
                    className={`px-10 py-5 text-[12px] leading-none font-[500] text-[#121212]/40 uppercase tracking-widest font-bold${
                      i === 7 ? ' text-right' : ''
                    }`}
                  >
                    {col}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgba(212,175,55,0.1)]">
            {rows.map((row) => {
              const s = STATUS_STYLES[row.status];
              return (
                <tr key={row.code} className="hover:bg-[#FDFBF7]/30 transition-colors">
                  <td className="px-10 py-8 text-[14px] leading-[1.5] text-[#121212]/60">
                    {formatTimestamp(row.timestamp)}
                  </td>
                  <td className="px-10 py-8 font-bold text-[#D4AF37] tracking-wider">
                    {row.code}
                  </td>
                  <td className="px-10 py-8 text-[14px] leading-[1.5] text-[#121212]">
                    {row.date}
                  </td>
                  <td className="px-10 py-8 text-[14px] leading-[1.5] text-[#121212]">
                    {row.time}
                  </td>
                  <td className="px-10 py-8">
                    <OccasionChip occasion={row.occasion} />
                  </td>
                  <td className="px-10 py-8 text-[14px] leading-[1.5] text-[#121212]">
                    {row.partySize}
                  </td>
                  <td className="px-10 py-8">
                    <span className={`flex items-center gap-2 ${s.text} text-[11px] font-bold uppercase tracking-widest`}>
                      <span className={`w-1.5 h-1.5 ${s.dot} rounded-full`} />
                      {s.label}
                    </span>
                  </td>
                  <td className="px-10 py-8 text-right space-x-4">
                    <button className="material-symbols-outlined text-[18px] text-[#121212]/20 hover:text-[#D4AF37] transition-colors">
                      edit
                    </button>
                    <button className="material-symbols-outlined text-[18px] text-[#121212]/20 hover:text-[#FF3B30] transition-colors">
                      delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination footer */}
      <div className="px-10 py-6 flex items-center justify-between bg-[#FDFBF7]/20">
        <p className="text-[14px] leading-[1.5] text-[#121212]/30 italic">
          Displaying {rows.length} active session {rows.length === 1 ? 'entry' : 'entries'}
        </p>
        <div className="flex gap-2">
          <button className="w-10 h-10 border border-[rgba(212,175,55,0.3)] flex items-center justify-center text-[#121212]/40 hover:bg-[#D4AF37] hover:text-white transition-colors">
            <span className="material-symbols-outlined text-sm">chevron_left</span>
          </button>
          <button className="w-10 h-10 bg-[#D4AF37] text-white flex items-center justify-center font-bold text-sm">
            1
          </button>
          <button className="w-10 h-10 border border-[rgba(212,175,55,0.3)] flex items-center justify-center text-[#121212]/60 hover:bg-[#D4AF37] hover:text-white transition-colors">
            2
          </button>
          <button className="w-10 h-10 border border-[rgba(212,175,55,0.3)] flex items-center justify-center text-[#121212]/40 hover:bg-[#D4AF37] hover:text-white transition-colors">
            <span className="material-symbols-outlined text-sm">chevron_right</span>
          </button>
        </div>
      </div>
    </section>
  );
}
