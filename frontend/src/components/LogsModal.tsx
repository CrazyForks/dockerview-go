import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { RefreshCw, X, Search, Download, Filter } from 'lucide-react';
import { basePath } from '../utils';
import { useTranslation } from '../i18n';

interface LogsProps {
  containerId: string;
  containerName: string;
  serverToken: string;
  onClose: () => void;
  onAuthRequired: (containerId: string, containerName: string) => void;
}

const TAIL_OPTIONS = ['100', '500', '1000', '5000'];
const LEVEL_OPTIONS = ['ALL', 'ERROR', 'WARN', 'INFO', 'DEBUG'];

export function LogsModal({ containerId, containerName, serverToken, onClose, onAuthRequired }: LogsProps) {
  const { t } = useTranslation();
  const [logsText, setLogsText] = useState<string>(t('logs.loading'));
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [logLevel, setLogLevel] = useState<string>('ALL');
  const [tailLines, setTailLines] = useState<string>('100');
  const viewerRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input to avoid too many server requests
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 200);
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const fetchLogs = useCallback(async () => {
    if (!containerId) return;
    try {
      const params = new URLSearchParams();
      params.set('id', containerId);
      params.set('tail', tailLines);
      params.set('token', serverToken);
      if (debouncedSearch.trim()) {
        params.set('grep', debouncedSearch.trim());
      }
      if (logLevel !== 'ALL') {
        params.set('level', logLevel);
      }

      const response = await fetch(`${basePath}api/container/logs?${params.toString()}`);
      if (response.ok) {
        const text = await response.text();
        const viewer = viewerRef.current;
        const wasAtBottom = viewer ? (viewer.scrollHeight - viewer.scrollTop <= viewer.clientHeight + 40) : true;

        setLogsText(text || t('logs.noOutput'));

        // Auto scroll to bottom
        if (wasAtBottom && viewer) {
          setTimeout(() => {
            viewer.scrollTop = viewer.scrollHeight;
          }, 50);
        }
      } else if (response.status === 401) {
        onAuthRequired(containerId, containerName);
      } else {
        const err = await response.text();
        setLogsText(t('logs.errorLoading', { error: err }));
      }
    } catch (err: any) {
      setLogsText(t('logs.connectionError', { error: err.message }));
    }
  }, [containerId, serverToken, tailLines, debouncedSearch, logLevel, onAuthRequired]);

  // Poll logs every 3 seconds while open
  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  // Highlight search matches in log text
  const highlightedLogs = useMemo(() => {
    if (!debouncedSearch.trim()) {
      return logsText;
    }

    const searchTerm = debouncedSearch.trim();
    const lines = logsText.split('\n');
    return lines.map((line, lineIndex) => {
      const parts: (string | { match: boolean; text: string })[] = [];
      let lastIndex = 0;
      const lowerLine = line.toLowerCase();
      const lowerSearch = searchTerm.toLowerCase();

      let idx = lowerLine.indexOf(lowerSearch, lastIndex);
      while (idx !== -1) {
        if (idx > lastIndex) {
          parts.push(line.substring(lastIndex, idx));
        }
        parts.push({ match: true, text: line.substring(idx, idx + searchTerm.length) });
        lastIndex = idx + searchTerm.length;
        idx = lowerLine.indexOf(lowerSearch, lastIndex);
      }
      if (lastIndex < line.length) {
        parts.push(line.substring(lastIndex));
      }

      return (
        <div key={lineIndex} className="log-line">
          {parts.length === 0 ? '\u00A0' : parts.map((part, i) =>
            typeof part === 'string' ? (
              <span key={i}>{part}</span>
            ) : (
              <mark key={i} className="bg-yellow-500/40 text-yellow-200 px-0.5 rounded-sm">
                {part.text}
              </mark>
            )
          )}
        </div>
      );
    });
  }, [logsText, debouncedSearch]);

  const handleDownload = () => {
    const blob = new Blob([logsText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${containerName || containerId}-logs.log`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const selectClass = "bg-white/3 hover:bg-white/5 border border-white/8 focus:border-accent-cyan/40 rounded-lg py-1.5 px-3 text-white text-[16px] sm:text-[12px] outline-none transition-all cursor-pointer appearance-none";

  return (
    <Dialog.Root open={true} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[1000] transition-all" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#101117]/85 border border-white/8 rounded-3xl w-[95%] sm:w-[90%] max-w-[900px] h-[85%] sm:h-[80%] max-h-[90vh] sm:max-h-[650px] flex flex-col shadow-2xl backdrop-blur-3xl z-[1001] animate-modal-in focus:outline-none">
          <div className="p-4 px-5 sm:p-5 sm:px-7 border-b border-white/6 flex justify-between items-center gap-4">
            <div className="text-left min-w-0 flex-1">
              <Dialog.Title className="text-sm sm:text-lg font-bold text-white m-0 truncate" title={t('logs.title', { name: containerName })}>
                {t('logs.title', { name: containerName })}
              </Dialog.Title>
              <Dialog.Description className="sr-only">
                Viewer for container stream logs.
              </Dialog.Description>
              <span className="text-[10px] sm:text-[11px] font-mono text-text-dim mt-1 block truncate" title={containerId}>
                {containerId}
              </span>
            </div>

            <div className="flex gap-2.5 shrink-0">
              <button
                onClick={fetchLogs}
                className="w-8 h-8 rounded-lg bg-white/3 hover:bg-white/8 border border-white/6 hover:border-white/15 text-text-dim hover:text-white flex items-center justify-center transition-all cursor-pointer"
                title={t('logs.refreshTooltip')}
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleDownload}
                className="w-8 h-8 rounded-lg bg-white/3 hover:bg-white/8 border border-white/6 hover:border-white/15 text-text-dim hover:text-white flex items-center justify-center transition-all cursor-pointer"
                title={t('logs.downloadTooltip')}
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              <Dialog.Close
                className="w-8 h-8 rounded-lg bg-white/3 hover:bg-white/8 border border-white/6 hover:border-white/15 text-text-dim hover:text-white flex items-center justify-center transition-all cursor-pointer"
                title={t('logs.closeTooltip')}
              >
                <X className="w-3.5 h-3.5" />
              </Dialog.Close>
            </div>
          </div>

          {/* Toolbar */}
          <div className="px-4 py-2.5 sm:px-6 sm:py-3 border-b border-white/6 flex flex-wrap gap-2.5 sm:gap-3 items-center bg-black/10">
            {/* Search */}
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-dim" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('logs.searchPlaceholder')}
                className="w-full bg-white/3 hover:bg-white/5 focus:bg-white/5 border border-white/8 focus:border-accent-cyan/40 rounded-lg py-1.5 pl-8 pr-3 text-white text-[16px] sm:text-[12px] outline-none transition-all placeholder:text-text-dim"
              />
            </div>

            {/* Level filter */}
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-text-dim" />
              <select
                value={logLevel}
                onChange={(e) => setLogLevel(e.target.value)}
                className={selectClass}
                title={t('logs.levelTitle')}
              >
                {LEVEL_OPTIONS.map((level) => (
                  <option key={level} value={level} className="bg-[#1a1b23]">
                    {level}
                  </option>
                ))}
              </select>
            </div>

            {/* Tail lines */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-text-dim whitespace-nowrap">{t('logs.linesLabel')}</span>
              <select
                value={tailLines}
                onChange={(e) => setTailLines(e.target.value)}
                className={selectClass}
                title={t('logs.linesTitle')}
              >
                {TAIL_OPTIONS.map((n) => (
                  <option key={n} value={n} className="bg-[#1a1b23]">
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div
            ref={viewerRef}
            className="grow p-4 sm:p-6 md:p-7 overflow-y-auto min-h-0 bg-black/20 rounded-b-3xl"
          >
            {debouncedSearch.trim() ? (
              <div className="m-0 font-mono text-[12px] leading-relaxed text-white/85 text-left whitespace-pre-wrap break-all">
                {highlightedLogs}
              </div>
            ) : (
              <pre className="m-0 font-mono text-[12px] leading-relaxed text-white/85 text-left whitespace-pre-wrap break-all">
                {logsText}
              </pre>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
