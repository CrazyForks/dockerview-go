import { useState, useEffect, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Play, Copy, Check, Terminal, Cpu } from 'lucide-react';
import { basePath } from '../utils';
import { useTranslation } from '../i18n';

interface ExecProps {
  containerId: string;
  containerName: string;
  serverToken: string;
  onClose: () => void;
  onAuthRequired: (containerId: string, containerName: string) => void;
}

interface ExecResult {
  exit_code: number;
  stdout: string;
  stderr: string;
}

export function ExecModal({ containerId, containerName, serverToken, onClose, onAuthRequired }: ExecProps) {
  const { t } = useTranslation();
  const [cmdInput, setCmdInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<ExecResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const outputEndRef = useRef<HTMLDivElement>(null);

  // Quick templates
  const templates = [
    { label: t('exec.tmplDirList'), cmd: 'ls -la' },
    { label: t('exec.tmplEnvVars'), cmd: 'env' },
    { label: t('exec.tmplDiskUsage'), cmd: 'df -h' },
    { label: t('exec.tmplCurrentUser'), cmd: 'whoami' },
    { label: t('exec.tmplNetworkConfig'), cmd: 'ip a || ifconfig' },
    { label: t('exec.tmplProcessList'), cmd: 'ps aux || ps' }
  ];

  // Auto-scroll on result update
  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [result, isRunning]);

  const handleRun = async (commandToRun?: string) => {
    const activeCmd = commandToRun ?? cmdInput;
    if (!activeCmd.trim()) return;

    setIsRunning(true);
    setResult(null);
    setErrorMsg('');

    try {
      const response = await fetch(`${basePath}api/container/exec?id=${containerId}&token=${serverToken}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ cmd: activeCmd })
      });

      if (response.ok) {
        const data = await response.json();
        setResult(data);
      } else if (response.status === 401) {
        onAuthRequired(containerId, containerName);
      } else {
        const text = await response.text();
        setErrorMsg(text || 'Failed to execute command');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Connection error');
    } finally {
      setIsRunning(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    const textToCopy = `Command: ${cmdInput}\nExit Code: ${result.exit_code}\n\nStdout:\n${result.stdout}\n\nStderr:\n${result.stderr}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog.Root open onOpenChange={() => onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-md z-[1000] transition-opacity duration-300" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-[850px] h-[80vh] bg-modal-bg border border-surface-5 rounded-[24px] shadow-2xl z-[1001] flex flex-col focus:outline-none overflow-hidden animate-modal-in">
          {/* Header */}
          <div className="flex justify-between items-start p-6 border-b border-border-subtle shrink-0">
            <div className="text-left">
              <Dialog.Title className="text-base font-extrabold tracking-wide text-text flex items-center gap-2">
                <Terminal className="w-4 h-4 text-accent-cyan" />
                {t('exec.title', { name: containerName })}
              </Dialog.Title>
              <Dialog.Description className="text-[11px] text-text-dim mt-1 font-semibold">
                {t('exec.subtitle', { id: containerId.substring(0, 12) })}
              </Dialog.Description>
            </div>
            <Dialog.Close className="p-1.5 rounded-lg bg-surface-1 hover:bg-surface-3 border border-border-subtle text-text-dim hover:text-text transition-all cursor-pointer">
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>

          {/* Form Area */}
          <div className="p-6 pb-4 border-b border-border-subtle shrink-0 bg-surface-1/30">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleRun();
              }}
              className="flex gap-2.5"
            >
              <input
                type="text"
                placeholder={t('exec.placeholder')}
                value={cmdInput}
                onChange={(e) => setCmdInput(e.target.value)}
                disabled={isRunning}
                className="w-full bg-surface-2 hover:bg-surface-4 disabled:opacity-50 border border-border-light hover:border-border-default rounded-xl py-2.5 px-4 text-text text-[13px] font-semibold font-mono transition-all focus:outline-none focus:border-accent-cyan/40 focus:bg-surface-4"
              />
              <button
                type="submit"
                disabled={isRunning || !cmdInput.trim()}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-accent-cyan hover:bg-accent-cyan/90 disabled:opacity-40 disabled:hover:bg-accent-cyan text-black font-extrabold text-[12px] tracking-wide rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0"
              >
                {isRunning ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current" />
                )}
                {t('exec.btnRun')}
              </button>
            </form>

            {/* Quick Templates */}
            <div className="flex flex-wrap gap-1.5 mt-3 items-center text-left">
              <span className="text-[9px] font-bold text-text-dim tracking-wide mr-1">
                {t('exec.quickTemplates')}:
              </span>
              {templates.map((tmpl, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={isRunning}
                  onClick={() => {
                    setCmdInput(tmpl.cmd);
                    handleRun(tmpl.cmd);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-surface-1 hover:bg-surface-3 border border-border-subtle hover:border-border-default text-text-dim hover:text-text font-mono font-bold text-[9px] transition-all cursor-pointer disabled:opacity-50"
                >
                  {tmpl.label}
                </button>
              ))}
            </div>
          </div>

          {/* Results Area */}
          <div className="grow overflow-y-auto p-6 bg-surface-1/10 flex flex-col font-mono text-[12px]">
            {isRunning && (
              <div className="flex flex-col items-center justify-center grow text-text-dim py-12 gap-3">
                <RefreshCw className="w-6 h-6 animate-spin text-accent-cyan" />
                <span className="font-bold text-[11px] tracking-wide animate-pulse">
                  {t('exec.running')}
                </span>
              </div>
            )}

            {errorMsg && (
              <div className="p-4 bg-danger/10 border border-danger/30 rounded-xl text-danger font-semibold text-left mb-4 break-all">
                {errorMsg}
              </div>
            )}

            {result && (
              <div className="flex flex-col grow justify-between text-left">
                {/* Meta details */}
                <div className="flex justify-between items-center mb-4 shrink-0">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border font-extrabold text-[10px] tracking-wide ${
                    result.exit_code === 0
                      ? 'bg-success/10 text-success border-success/20'
                      : 'bg-danger/10 text-danger border-danger/20'
                  }`}>
                    <Cpu className="w-3.5 h-3.5" />
                    {t('exec.exitCode', { code: result.exit_code })}
                  </span>

                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 border border-border-light hover:border-border-default text-text-dim hover:text-text font-bold text-[10px] tracking-wide transition-all cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-success" />
                        <span className="text-success">{t('exec.outputCopied')}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>{t('exec.copyOutput')}</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Pre block */}
                <div className="grow bg-surface-2 border border-border-light rounded-2xl p-5 overflow-auto max-h-[350px] relative font-mono text-[12px] leading-relaxed shadow-inner">
                  {result.stdout && (
                    <pre className="text-text whitespace-pre-wrap select-text break-all">{result.stdout}</pre>
                  )}
                  {result.stderr && (
                    <pre className="text-danger whitespace-pre-wrap select-text break-all mt-2">{result.stderr}</pre>
                  )}
                  {!result.stdout && !result.stderr && (
                    <div className="text-text-dim italic font-semibold">{t('exec.noOutput')}</div>
                  )}
                  <div ref={outputEndRef} />
                </div>
              </div>
            )}

            {!isRunning && !result && !errorMsg && (
              <div className="flex flex-col items-center justify-center grow text-text-dim py-12 gap-2">
                <Terminal className="w-8 h-8 opacity-40" />
                <span className="font-semibold text-text-dim italic">
                  {t('exec.emptyHint')}
                </span>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// Helper spinner definition
function RefreshCw(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}
