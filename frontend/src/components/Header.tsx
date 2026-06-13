import { Search } from 'lucide-react';
import { basePath } from '../utils';

interface HeaderProps {
  totalCount: number;
  runningCount: number;
  stoppedCount: number;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  sortKey: 'name' | 'cpu' | 'ram';
  setSortKey: (k: 'name' | 'cpu' | 'ram') => void;
  filterKey: 'all' | 'running' | 'stopped';
  setFilterKey: (f: 'all' | 'running' | 'stopped') => void;
}

export function Header({
  totalCount, runningCount, stoppedCount,
  searchQuery, setSearchQuery,
  sortKey, setSortKey,
  filterKey, setFilterKey
}: HeaderProps) {
  return (
    <div className="sticky top-[25px] z-50 flex flex-wrap justify-between items-center gap-5 p-3.5 px-7 rounded-3xl glass-panel shadow-lg mb-[50px]">
      <div className="flex items-center gap-3">
        <img src={`${basePath}logo.svg`} className="w-7 h-7 rounded-lg object-contain shadow-md" alt="DockerView Logo" />
        <div className="flex flex-col justify-start">
          <h1 className="text-[13px] font-extrabold m-0 leading-tight tracking-[1.5px] uppercase">
            DockerView <span className="text-accent-cyan">Go</span>
          </h1>
          <div className="flex items-center gap-1 mt-0.5 text-[9px] font-bold text-accent-cyan tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan live-pulse" />
            <span>LIVE TELEMETRY</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1.5 bg-white/2 border border-white/3 p-0.5 rounded-xl">
        <button 
          onClick={() => setFilterKey('all')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold tracking-wider rounded-lg transition-all ${
            filterKey === 'all' ? 'bg-white/5 border border-white/8 text-white' : 'text-text-dim border border-transparent hover:text-white'
          }`}
        >
          ALL <span className="bg-white/4 border border-white/5 text-[9px] px-1 py-0.2 rounded font-mono">{totalCount}</span>
        </button>
        <button 
          onClick={() => setFilterKey('running')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold tracking-wider rounded-lg transition-all ${
            filterKey === 'running' ? 'bg-white/5 border border-white/8 text-white' : 'text-text-dim border border-transparent hover:text-white'
          }`}
        >
          RUNNING <span className="bg-white/4 border border-white/5 text-[9px] px-1 py-0.2 rounded font-mono">{runningCount}</span>
        </button>
        <button 
          onClick={() => setFilterKey('stopped')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold tracking-wider rounded-lg transition-all ${
            filterKey === 'stopped' ? 'bg-white/5 border border-white/8 text-white' : 'text-text-dim border border-transparent hover:text-white'
          }`}
        >
          STOPPED <span className="bg-white/4 border border-white/5 text-[9px] px-1 py-0.2 rounded font-mono">{stoppedCount}</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="relative flex items-center grow md:max-w-[340px]">
        <Search className="absolute left-3 w-3.5 h-3.5 text-text-dim pointer-events-none" />
        <input 
          type="text" 
          placeholder="Search infrastructure nodes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white/3 hover:bg-white/5 border border-white/5 hover:border-white/10 rounded-xl py-2 pl-9 pr-4 text-white text-[12px] font-semibold transition-all focus:outline-none focus:border-accent-cyan/40 focus:bg-white/5"
        />
      </div>

      {/* Sorting selectors */}
      <div className="flex items-center gap-3 text-[10px] font-bold tracking-wider text-text-dim">
        SORT BY
        <div className="flex bg-white/2 border border-white/3 p-0.5 rounded-lg">
          <button 
            onClick={() => setSortKey('name')}
            className={`px-2.5 py-1 rounded text-[9px] font-bold ${sortKey === 'name' ? 'bg-white/4 text-white' : 'hover:text-white'}`}
          >
            NAME
          </button>
          <button 
            onClick={() => setSortKey('cpu')}
            className={`px-2.5 py-1 rounded text-[9px] font-bold ${sortKey === 'cpu' ? 'bg-white/4 text-white' : 'hover:text-white'}`}
          >
            CPU
          </button>
          <button 
            onClick={() => setSortKey('ram')}
            className={`px-2.5 py-1 rounded text-[9px] font-bold ${sortKey === 'ram' ? 'bg-white/4 text-white' : 'hover:text-white'}`}
          >
            RAM
          </button>
        </div>
      </div>
    </div>
  );
}
