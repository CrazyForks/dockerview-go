interface SummaryProps {
  total: number;
  active: number;
  avgCpu: string;
  peakMemory: string;
  healthyCount: number;
  warningCount: number;
  dangerousCount: number;
}

export function SummaryDashboard({ total, active, avgCpu, peakMemory, healthyCount, warningCount, dangerousCount }: SummaryProps) {
  return (
    <div className="glass-card rounded-[24px] p-6 mb-[50px] shadow-2xl flex flex-col md:flex-row gap-6 md:items-center divide-y md:divide-y-0 md:divide-x divide-white/5">
      {/* 1. Node overview */}
      <div className="flex-1 pb-4 md:pb-0 md:pr-6 flex items-center justify-around gap-4">
        <div className="text-left">
          <div className="text-[10px] font-bold text-text-dim uppercase tracking-[1.5px] mb-1">TOTAL NODES</div>
          <div className="text-3xl font-extrabold text-white">{total}</div>
        </div>
        <div className="h-10 w-[1px] bg-white/5 hidden sm:block" />
        <div className="text-left">
          <div className="text-[10px] font-bold text-text-dim uppercase tracking-[1.5px] mb-1">ACTIVE</div>
          <div className="text-3xl font-extrabold text-success">{active}</div>
        </div>
      </div>

      {/* 2. Health overview */}
      <div className="flex-[1.5] py-4 md:py-0 md:px-6 flex flex-col justify-center">
        <div className="text-[10px] font-bold text-text-dim uppercase tracking-[1.5px] mb-3 text-left">CONTAINER HEALTH</div>
        <div className="flex items-center gap-6 justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-success shadow-[0_0_8px_rgba(0,255,170,0.4)]" />
            <div className="text-left">
              <div className="text-[9px] font-extrabold text-text-dim uppercase tracking-[1px]">HEALTHY</div>
              <div className="text-lg font-extrabold text-success leading-none mt-0.5">{healthyCount}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-warning shadow-[0_0_8px_rgba(255,170,0,0.4)]" />
            <div className="text-left">
              <div className="text-[9px] font-extrabold text-text-dim uppercase tracking-[1px]">WARNING</div>
              <div className="text-lg font-extrabold text-warning leading-none mt-0.5">{warningCount}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-danger shadow-[0_0_8px_rgba(255,0,85,0.4)]" />
            <div className="text-left">
              <div className="text-[9px] font-extrabold text-text-dim uppercase tracking-[1px]">DANGER</div>
              <div className="text-lg font-extrabold text-danger leading-none mt-0.5">{dangerousCount}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Performance summary */}
      <div className="flex-[1.2] pt-4 md:pt-0 md:pl-6 flex items-center justify-around gap-4">
        <div className="text-left">
          <div className="text-[10px] font-bold text-text-dim uppercase tracking-[1.5px] mb-1">AVG LOAD</div>
          <div className="text-2xl font-extrabold text-white flex items-baseline gap-0.5">
            {avgCpu}
            <span className="text-xs font-bold text-text-dim">%</span>
          </div>
        </div>
        <div className="h-10 w-[1px] bg-white/5 hidden sm:block" />
        <div className="text-left">
          <div className="text-[10px] font-bold text-text-dim uppercase tracking-[1.5px] mb-1">PEAK MEMORY</div>
          <div className="text-2xl font-extrabold text-white">{peakMemory}</div>
        </div>
      </div>
    </div>
  );
}
