import { useState, useEffect, useRef } from 'react';
import { Wallet, ChevronDown, ShieldCheck, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { NETWORK_CONFIG } from '@/lib/loomii-engine';

interface AccountDropdownProps {
  account: string;
  balance: number;
  onDisconnect: () => void;
}

export function AccountDropdown({ account, balance, onDisconnect }: AccountDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button onClick={() => setIsOpen(!isOpen)} className="group cursor-pointer">
        <div className="flex items-center gap-2 bg-secondary px-4 py-1.5 rounded-full border border-border group-hover:border-primary/50 transition-all">
          <div className="relative">
            <Wallet className="w-3.5 h-3.5 text-primary" />
            <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-500 rounded-full border border-secondary" />
          </div>
          <span className="font-mono text-sm font-medium flex items-center gap-1">
            <span className="text-lg leading-none">♾️</span>
            <span className="text-primary">GEN</span>
          </span>
          <ChevronDown className={`w-3 h-3 text-muted-foreground group-hover:text-foreground transition-all ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 mt-3 w-56 bg-card border border-border rounded-xl shadow-2xl overflow-hidden z-[60]"
          >
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-[10px] uppercase tracking-widest font-bold text-emerald-500">Connected</span>
                </div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Session Active</div>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Wallet Address</div>
                  <div className="text-xs font-mono truncate bg-secondary p-2 rounded border border-border">{account}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Network</div>
                  <div className="flex items-center gap-2 text-xs font-medium">
                    <ShieldCheck className="w-3 h-3 text-primary" />
                    {NETWORK_CONFIG.chainName}
                  </div>
                </div>
              </div>
            </div>
            <div className="p-2 space-y-1">
              <button
                onClick={() => { onDisconnect(); setIsOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="font-bold uppercase tracking-widest text-[10px]">Disconnect Wallet</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
