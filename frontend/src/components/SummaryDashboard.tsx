interface SummaryProps {
  total: number;
  active: number;
  avgCpu: string;
  peakMemory: string;
}

export function SummaryDashboard({ total, active, avgCpu, peakMemory }: SummaryProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-[50px]">
      <div className="glass-card p-5 rounded-3xl text-center shadow">
        <div className="text-[10px] font-bold text-text-dim uppercase tracking-[1.5px] mb-1.5">Total Nodes</div>
        <div className="text-2xl md:text-3xl font-extrabold">{total}</div>
      </div>
      <div className="glass-card p-5 rounded-3xl text-center shadow">
        <div className="text-[10px] font-bold text-text-dim uppercase tracking-[1.5px] mb-1.5">Active</div>
        <div className="text-2xl md:text-3xl font-extrabold text-success">{active}</div>
      </div>
      <div className="glass-card p-5 rounded-3xl text-center shadow">
        <div className="text-[10px] font-bold text-text-dim uppercase tracking-[1.5px] mb-1.5">Avg Load</div>
        <div className="text-2xl md:text-3xl font-extrabold">{avgCpu}%</div>
      </div>
      <div className="glass-card p-5 rounded-3xl text-center shadow">
        <div className="text-[10px] font-bold text-text-dim uppercase tracking-[1.5px] mb-1.5">Peak Memory</div>
        <div className="text-2xl md:text-3xl font-extrabold">{peakMemory}</div>
      </div>
    </div>
  );
}
