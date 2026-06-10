import { useState, useEffect, useRef } from 'react';
import { ArrowRightLeft, ChevronDown, Construction } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BridgeDropdownProps {
  balance: number;
  setBalance: (b: number) => void;
}

export function BridgeDropdown({ balance, setBalance }: BridgeDropdownProps) {
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
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-widest border border-border rounded-full hover:border-primary hover:text-primary transition-all bg-transparent text-muted-foreground"
      >
        <ArrowRightLeft className="w-3 h-3" />
        Bridge
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 mt-3 w-80 bg-card border border-border rounded-2xl shadow-2xl p-8 z-50"
          >
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                <Construction className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-bold uppercase italic tracking-tight mb-1">Under Construction</h3>
                <p className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground">Coming Soon 🛠️</p>
              </div>
              <div className="w-full h-px bg-gradient-to-r from-transparent via-border to-transparent my-4" />
              <p className="text-[10px] text-muted-foreground leading-relaxed max-w-[200px]">
                The Loomii Bridge is currently being upgraded for GenLayer StudioNet.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
