import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ShieldAlert } from 'lucide-react';
import { useTranslation } from '../i18n';

interface AuthProps {
  onVerify: (token: string) => void;
  onClose: () => void;
  hasError: boolean;
}

export function AuthModal({ onVerify, onClose, hasError }: AuthProps) {
  const { t } = useTranslation();
  const [inputVal, setInputVal] = useState<string>('');

  return (
    <Dialog.Root open={true} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[2000] transition-all" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#101117]/85 border border-white/8 rounded-3xl p-6 sm:p-9 w-[92%] sm:w-[90%] max-w-[420px] shadow-2xl backdrop-blur-3xl z-[2001] text-center animate-modal-in focus:outline-none">
          <div className="flex justify-center items-center mb-6 text-accent-cyan">
            <ShieldAlert className="w-9 h-9" />
          </div>
          <Dialog.Title className="text-xl font-bold text-white mb-2">
            {t('auth.title')}
          </Dialog.Title>
          <Dialog.Description className="text-[13px] text-text-dim leading-relaxed mb-7">
            {t('auth.description')}
          </Dialog.Description>

          <div className="mb-5">
            <input
              type="password"
              placeholder={t('auth.placeholder')}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onVerify(inputVal.trim())}
              className="w-full bg-white/3 focus:bg-white/5 border border-white/8 focus:border-accent-cyan/40 rounded-xl py-3.5 px-4 text-white text-center font-mono text-[16px] sm:text-sm outline-none transition-all"
              autoFocus
            />
          </div>

          <button
            onClick={() => onVerify(inputVal.trim())}
            className="w-full bg-accent-cyan hover:bg-[#00dd95] border border-accent-cyan/20 text-[#0b0c10] font-bold py-3.5 rounded-xl text-sm transition-all hover:-translate-y-0.5"
          >
            {t('auth.verifyBtn')}
          </button>

          {hasError && (
            <div className="text-danger font-semibold text-[12px] mt-3.5">
              {t('auth.invalidToken')}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
