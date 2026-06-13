import { useEffect, useRef } from 'react';
import { ArrowDownUp, HardDrive, Play, Square, RefreshCw, Terminal } from 'lucide-react';
import type { Container } from '../types';
import { parseSize } from '../utils';
import { Sparkline, HighlightedText } from './Sparkline';

interface ContainerCardProps {
  container: Container;
  history?: { cpu: number[]; ram: number[] };
  onOp: (id: string, op: 'start' | 'stop' | 'restart', name: string) => Promise<void>;
  onLogs: (id: string, name: string) => void;
  searchQuery: string;
}

export function ContainerCard({ container, history, onOp, onLogs, searchQuery }: ContainerCardProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const isUp = container.status && !container.status.toLowerCase().includes('exit');

  // Mouse 3D hover-tilt effect
  useEffect(() => {
    const wrapper = wrapperRef.current;
    const card = cardRef.current;
    if (!wrapper || !card) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = wrapper.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      card.style.setProperty('--mouse-x', `${x}px`);
      card.style.setProperty('--mouse-y', `${y}px`);
      
      const rotX = -((y / rect.height) - 0.5) * 8;
      const rotY = ((x / rect.width) - 0.5) * 8;
      
      card.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(-2px)`;
      const glowColor = isUp ? 'rgba(0, 255, 170, 0.06)' : 'rgba(255, 0, 85, 0.06)';
      card.style.boxShadow = `0 15px 35px rgba(0,0,0,0.5), 0 0 15px ${glowColor}`;
    };

    const handleMouseLeave = () => {
      card.style.transform = 'rotateX(0deg) rotateY(0deg) translateY(0)';
      card.style.boxShadow = '0 10px 30px rgba(0,0,0,0.3)';
    };

    wrapper.addEventListener('mousemove', handleMouseMove);
    wrapper.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      wrapper.removeEventListener('mousemove', handleMouseMove);
      wrapper.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [isUp]);

  // Clean values
  const cpuPercent = parseFloat(container.cpu) || 0;
  // Estimate RAM percent load assuming 1GB base
  const ramPercent = Math.min((parseSize(container.memory) / (1024 * 1024 * 1024)) * 100, 100) || 0;

  // Choose fill color based on usage percent
  const getBarColorClass = (val: number, isRam = false) => {
    if (val > 80) return 'bg-danger';
    if (val > 50) return 'bg-warning';
    return isRam ? 'bg-accent-pink' : 'bg-accent-cyan';
  };

  return (
    <div ref={wrapperRef} className="card-wrapper">
      <div 
        ref={cardRef} 
        className="tilt-card glass-card rounded-[24px] p-7 shadow-lg flex flex-col justify-start"
      >
        {/* Header */}
        <div className="flex justify-between items-start gap-4 mb-6 z-10 relative">
          <div className="text-left">
            <h3 className="text-lg font-bold text-white break-all">
              <HighlightedText text={container.name} query={searchQuery} />
            </h3>
            <div className="text-[11px] text-text-dim font-mono mt-1">
              <HighlightedText text={container.id} query={searchQuery} />
            </div>
          </div>
          <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-md border text-center uppercase tracking-wider ${
            isUp 
              ? 'bg-success/5 text-success border-success/15' 
              : 'bg-danger/5 text-danger border-danger/15'
          }`}>
            {isUp ? 'Running' : 'Stopped'}
          </span>
        </div>

        {/* Metrics Area */}
        <div className="flex flex-col gap-4 mb-6 z-10 relative">
          {/* CPU Row */}
          <div className="flex items-center gap-4">
            <div className="flex flex-col w-[72px] shrink-0 text-left">
              <span className="text-[9px] font-bold text-text-dim tracking-wider uppercase">CPU LOAD</span>
              <span className="text-[13px] font-extrabold mt-0.5 tabular-nums">{container.cpu}</span>
            </div>
            <div className="flex items-center grow gap-3.5">
              <div className="h-[5px] bg-white/4 rounded-full grow overflow-hidden relative">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${getBarColorClass(cpuPercent)}`}
                  style={{ width: `${cpuPercent}%` }}
                />
              </div>
              <div className="w-[90px] h-[18px] shrink-0 opacity-85">
                <Sparkline data={history?.cpu || [0,0]} color="#00f2ff" />
              </div>
            </div>
          </div>

          {/* Memory Row */}
          <div className="flex items-center gap-4">
            <div className="flex flex-col w-[72px] shrink-0 text-left">
              <span className="text-[9px] font-bold text-text-dim tracking-wider uppercase">RAM USAGE</span>
              <span className="text-[13px] font-extrabold mt-0.5 tabular-nums">{container.memory}</span>
            </div>
            <div className="flex items-center grow gap-3.5">
              <div className="h-[5px] bg-white/4 rounded-full grow overflow-hidden relative">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${getBarColorClass(ramPercent, true)}`}
                  style={{ width: `${ramPercent}%` }}
                />
              </div>
              <div className="w-[90px] h-[18px] shrink-0 opacity-85">
                <Sparkline data={history?.ram || [0,0]} color="#d500f9" />
              </div>
            </div>
          </div>
        </div>

        {/* Footer Metrics */}
        <div className="flex justify-between pt-4 border-t border-white/3 text-[11px] text-text-dim z-10 relative">
          <span className="flex items-center gap-1">
            <ArrowDownUp className="w-3 h-3 text-text-dim" />
            <span>{container.network || '0 B / 0 B'}</span>
          </span>
          <span className="flex items-center gap-1">
            <HardDrive className="w-3 h-3 text-text-dim" />
            <span>{container.blkio || '0 B / 0 B'}</span>
          </span>
        </div>

        {/* Action Controls */}
        <div className="card-actions">
          {isUp ? (
            <>
              <button 
                onClick={() => onOp(container.fullid, 'stop', container.name)}
                className="action-btn btn-stop"
              >
                <Square className="w-3 h-3" />
                Stop
              </button>
              <button 
                onClick={() => onOp(container.fullid, 'restart', container.name)}
                className="action-btn btn-restart"
              >
                <RefreshCw className="w-3 h-3" />
                Restart
              </button>
            </>
          ) : (
            <button 
              onClick={() => onOp(container.fullid, 'start', container.name)}
              className="action-btn btn-start mr-auto"
            >
              <Play className="w-3 h-3" />
              Start
            </button>
          )}
          <button 
            onClick={() => onLogs(container.fullid, container.name)}
            className="action-btn btn-logs ml-auto"
          >
            <Terminal className="w-3 h-3" />
            Logs
          </button>
        </div>
      </div>
    </div>
  );
}
