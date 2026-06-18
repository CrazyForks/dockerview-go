import { useState } from 'react';
import { RefreshCcw } from 'lucide-react';
import type { ToastMessage } from './types';
import { formatBytes, basePath } from './utils';
import { useTelemetry } from './hooks/useTelemetry';
import { Header } from './components/Header';
import { SummaryDashboard } from './components/SummaryDashboard';
import { ContainerCard } from './components/ContainerCard';
import { AuthModal } from './components/AuthModal';
import { LogsModal } from './components/LogsModal';

export default function App() {
  // Auth state
  const [serverToken, setServerToken] = useState<string>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    if (tokenFromUrl) {
      localStorage.setItem('dockerview_token', tokenFromUrl);
      // Clean query string
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
      return tokenFromUrl;
    }
    return localStorage.getItem('dockerview_token') || '';
  });
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authError, setAuthError] = useState<boolean>(false);

  // Pending action stored as data (not a function closure) to avoid stale closure bugs.
  // The function-closure approach captured an old performOp/handleOpenLogs with an empty
  // serverToken, causing a second auth dialog to appear after the first token input.
  type PendingActionType =
    | { kind: 'op'; containerId: string; op: 'start' | 'stop' | 'restart'; containerName: string }
    | { kind: 'logs'; containerId: string; containerName: string };
  const [pendingAction, setPendingAction] = useState<PendingActionType | null>(null);

  // Modals & Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [logsContainer, setLogsContainer] = useState<{ id: string; name: string } | null>(null);
  const [showAllOffline, setShowAllOffline] = useState<boolean>(false);

  // Custom hook for telemetry
  const {
    containers,
    filteredContainers,
    runningCount,
    stoppedCount,
    healthyCount,
    warningCount,
    dangerousCount,
    avgCpu,
    peakMemory,
    lastUpdate,
    searchQuery,
    setSearchQuery,
    sortKey,
    setSortKey,
    filterKey,
    setFilterKey,
    historyData,
    isRunning
  } = useTelemetry(serverToken);

  const showToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  // Handle operation action (Start/Stop/Restart)
  // Accepts an optional `token` param so callers can pass the latest token
  // without relying on closure state (avoids stale-closure double-auth bug).
  const performOp = async (containerId: string, op: 'start' | 'stop' | 'restart', name: string, token?: string) => {
    const authToken = token ?? serverToken;
    if (!containerId) {
      showToast('Container ID is missing', 'error');
      return;
    }
    if (!authToken) {
      setPendingAction({ kind: 'op', containerId, op, containerName: name });
      setAuthError(false);
      setShowAuthModal(true);
      return;
    }

    showToast(`${op.charAt(0).toUpperCase() + op.slice(1)}ing container ${name}...`, 'info');

    try {
      const response = await fetch(`${basePath}api/container/op?id=${containerId}&op=${op}&token=${authToken}`, {
        method: 'POST'
      });

      if (response.ok) {
        showToast(`Container ${name} ${op}ed successfully`, 'success');
      } else if (response.status === 401) {
        showToast('Authentication failed: Invalid security token', 'error');
        localStorage.removeItem('dockerview_token');
        setServerToken('');
        setPendingAction({ kind: 'op', containerId, op, containerName: name });
        setAuthError(true);
        setShowAuthModal(true);
      } else {
        const errMsg = await response.text();
        showToast(`Error: ${errMsg}`, 'error');
      }
    } catch (err: any) {
      showToast(`Failed to connect to server: ${err.message}`, 'error');
    }
  };

  // Open Log Modal helper
  // Accepts an optional `token` param to avoid stale-closure issues.
  const handleOpenLogs = (id: string, name: string, token?: string) => {
    const authToken = token ?? serverToken;
    if (!authToken) {
      setPendingAction({ kind: 'logs', containerId: id, containerName: name });
      setAuthError(false);
      setShowAuthModal(true);
      return;
    }
    setLogsContainer({ id, name });
  };

  const handleVerifyToken = (token: string) => {
    setServerToken(token);
    localStorage.setItem('dockerview_token', token);
    setShowAuthModal(false);
    showToast('Token verified and saved', 'success');
    if (pendingAction) {
      // Execute the pending action using the new token directly.
      // We pass the token explicitly instead of relying on state / closure,
      // which ensures the action uses the correct token on the first try.
      const action = pendingAction;
      setPendingAction(null);
      if (action.kind === 'op') {
        performOp(action.containerId, action.op, action.containerName, token);
      } else {
        handleOpenLogs(action.containerId, action.containerName, token);
      }
    }
  };

  return (
    <div className="relative min-h-screen">
      <div className="mesh" />
      <div className="max-w-[1600px] mx-auto px-[30px] py-[50px]">
        
        {/* Floating Controller Panel */}
        <Header 
          totalCount={containers.length}
          runningCount={runningCount}
          stoppedCount={stoppedCount}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          sortKey={sortKey}
          setSortKey={setSortKey}
          filterKey={filterKey}
          setFilterKey={setFilterKey}
        />

        {/* Aggregate Stats Dashboard */}
        <SummaryDashboard 
          total={containers.length}
          active={runningCount}
          avgCpu={avgCpu}
          peakMemory={formatBytes(peakMemory)}
          healthyCount={healthyCount}
          warningCount={warningCount}
          dangerousCount={dangerousCount}
        />

        {/* Container Lists */}
        {filteredContainers.length > 0 ? (
          <div className="space-y-[50px]">
            {/* Active grid */}
            {filteredContainers.some(isRunning) && (
              <div>
                <div className="text-[12px] font-extrabold uppercase tracking-[2px] text-text-dim mb-6 flex items-center gap-3 after:content-[''] after:grow after:h-[1px] after:bg-white/4">
                  Active Deployments
                </div>
                <div className="grid-container">
                  {filteredContainers.filter(isRunning).map(c => (
                    <ContainerCard 
                      key={c.id} 
                      container={c}
                      history={historyData[c.id]}
                      onOp={performOp}
                      onLogs={handleOpenLogs}
                      searchQuery={searchQuery}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Offline grid */}
            {filteredContainers.some(c => !isRunning(c)) && (
              <div>
                <div className="text-[12px] font-extrabold uppercase tracking-[2px] text-text-dim mb-6 flex items-center gap-3 after:content-[''] after:grow after:h-[1px] after:bg-white/4">
                  Offline Instances ({filteredContainers.filter(c => !isRunning(c)).length})
                </div>
                <div className="grid-container">
                  {filteredContainers
                    .filter(c => !isRunning(c))
                    .slice(0, showAllOffline ? undefined : 6)
                    .map(c => (
                      <ContainerCard 
                        key={c.id} 
                        container={c}
                        history={historyData[c.id]}
                        onOp={performOp}
                        onLogs={handleOpenLogs}
                        searchQuery={searchQuery}
                      />
                    ))}
                </div>
                {filteredContainers.filter(c => !isRunning(c)).length > 6 && (
                  <div className="flex justify-center mt-8">
                    <button
                      onClick={() => setShowAllOffline(!showAllOffline)}
                      className="px-5 py-2.5 rounded-xl bg-white/2 hover:bg-white/5 border border-white/5 hover:border-white/10 text-text-dim hover:text-white font-bold text-[11px] tracking-wider uppercase transition-all cursor-pointer"
                    >
                      {showAllOffline ? 'Show Less' : `Show All Offline (${filteredContainers.filter(c => !isRunning(c)).length})`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-[60px] text-text-dim font-semibold text-[14px]">
            No containers found matching current filters.
          </div>
        )}

        {/* Footer */}
        <footer className="mt-[100px] pt-10 border-t border-card-border text-[11px] text-text-dim">
          <div className="flex flex-wrap justify-between items-center gap-5">
            <div className="flex items-center gap-3.5">
              <span>© 2026 DockerView</span>
              <span className="bg-white/3 border border-white/5 px-1.5 py-0.5 rounded font-mono font-bold text-accent-cyan">v0.1.13</span>
            </div>
            <div className="flex items-center gap-6 font-semibold">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-success live-pulse" />
                <span>SSE STREAM RUNNING</span>
              </div>
              <div className="flex items-center gap-1.5">
                <RefreshCcw className="w-2.5 h-2.5 opacity-70 animate-spin" style={{ animationDuration: '6s' }} />
                <span>LAST UPDATED: <span>{lastUpdate}</span></span>
              </div>
            </div>
            <div>
              <a 
                href="https://github.com/zsuroy/dockerview-go" 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center gap-1.5 text-text-dim hover:text-white bg-white/2 hover:bg-white/5 border border-white/3 hover:border-white/10 px-3.5 py-1.5 rounded-lg transition-all font-semibold text-[11px]"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                  <path d="M9 18c-4.51 2-5-2-7-2" />
                </svg>
                <span>GitHub</span>
              </a>
            </div>
          </div>
        </footer>
      </div>

      {/* Auth Token Prompt Modal */}
      {showAuthModal && (
        <AuthModal 
          onVerify={handleVerifyToken}
          onClose={() => {
            setShowAuthModal(false);
            setPendingAction(null);
          }}
          hasError={authError}
        />
      )}

      {/* Logs Viewing Modal */}
      {logsContainer && (
        <LogsModal 
          containerId={logsContainer.id}
          containerName={logsContainer.name}
          serverToken={serverToken}
          onClose={() => setLogsContainer(null)}
          onAuthRequired={(containerId, containerName) => {
            setLogsContainer(null);
            localStorage.removeItem('dockerview_token');
            setServerToken('');
            setPendingAction({ kind: 'logs', containerId, containerName });
            setAuthError(true);
            setShowAuthModal(true);
          }}
        />
      )}

      {/* Dynamic Toast Messages */}
      <div className="fixed bottom-[30px] right-[30px] flex flex-col gap-2.5 z-[2000]">
        {toasts.map(t => (
          <div 
            key={t.id} 
            className={`flex items-center gap-2.5 px-4.5 py-3 rounded-xl bg-[#101117]/85 border border-white/8 text-white font-semibold text-[13px] shadow-lg backdrop-blur-md animate-modal-in min-w-[260px] ${
              t.type === 'success' ? 'border-l-4 border-l-success' : 
              t.type === 'error' ? 'border-l-4 border-l-danger' : 
              'border-l-4 border-l-accent-cyan'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
