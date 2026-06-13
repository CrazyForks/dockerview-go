import { useState, useEffect, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { RefreshCw, X } from 'lucide-react';
import { basePath } from '../utils';

interface LogsProps {
  containerId: string;
  containerName: string;
  serverToken: string;
  onClose: () => void;
  onAuthRequired: () => void;
}

export function LogsModal({ containerId, containerName, serverToken, onClose, onAuthRequired }: LogsProps) {
  const [logsText, setLogsText] = useState<string>('Loading logs...');
  const viewerRef = useRef<HTMLPreElement>(null);

  const fetchLogs = async () => {
    if (!containerId) return;
    try {
      const response = await fetch(`${basePath}api/container/logs?id=${containerId}&tail=100&token=${serverToken}`);
      if (response.ok) {
        const text = await response.text();
        const viewer = viewerRef.current;
        const wasAtBottom = viewer ? (viewer.scrollHeight - viewer.scrollTop <= viewer.clientHeight + 40) : true;
        
        setLogsText(text || 'No log output');
        
        // Auto scroll to bottom
        if (wasAtBottom && viewer) {
          setTimeout(() => {
            viewer.scrollTop = viewer.scrollHeight;
          }, 50);
        }
      } else if (response.status === 401) {
        onAuthRequired();
      } else {
        const err = await response.text();
        setLogsText(`Error loading logs: ${err}`);
      }
    } catch (err: any) {
      setLogsText(`Failed to connect to server: ${err.message}`);
    }
  };

  // Poll logs every 3 seconds while open
  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, [containerId, serverToken]);

  return (
    <Dialog.Root open={true} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[1000] transition-all" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#101117]/85 border border-white/8 rounded-3xl w-[90%] max-w-[850px] h-[75%] max-h-[600px] flex flex-col shadow-2xl backdrop-blur-3xl z-[1001] animate-modal-in focus:outline-none">
          <div className="p-5 px-7 border-b border-white/6 flex justify-between items-center">
            <div className="text-left">
              <Dialog.Title className="text-lg font-bold text-white m-0">
                Logs: {containerName}
              </Dialog.Title>
              <span className="text-[11px] font-mono text-text-dim mt-1 block">
                {containerId}
              </span>
            </div>
            
            <div className="flex gap-2.5">
              <button 
                onClick={fetchLogs} 
                className="w-8 h-8 rounded-lg bg-white/3 hover:bg-white/8 border border-white/6 hover:border-white/15 text-text-dim hover:text-white flex items-center justify-center transition-all cursor-pointer"
                title="Refresh Logs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <Dialog.Close 
                className="w-8 h-8 rounded-lg bg-white/3 hover:bg-white/8 border border-white/6 hover:border-white/15 text-text-dim hover:text-white flex items-center justify-center transition-all cursor-pointer"
                title="Close"
              >
                <X className="w-3.5 h-3.5" />
              </Dialog.Close>
            </div>
          </div>

          <div className="grow p-6 md:p-7 overflow-y-auto min-h-0 bg-black/20 rounded-b-3xl">
            <pre 
              ref={viewerRef}
              className="m-0 font-mono text-[12px] leading-relaxed text-white/85 text-left h-full overflow-y-auto whitespace-pre-wrap break-all"
            >
              {logsText}
            </pre>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
