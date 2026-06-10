import { useState } from 'react';
import { motion } from 'motion/react';
import { Plus, Minus } from 'lucide-react';
import type { GameProps } from '@/lib/loomii-types';
import { playLoomii } from '@/lib/loomii-engine';
import { isRejectedTransaction } from '@/lib/errors';

export function CoinFlipGame({ account, addHistory, setTxStatus, setCurrentTxHash, setError, refreshStats }: GameProps) {
  const [bet, setBet] = useState(10);
  const [isFlipping, setIsFlipping] = useState(false);
  const [side, setSide] = useState<'heads' | 'tails' | null>(null);

  const flip = async (choice: 'heads' | 'tails') => {
    if (!account || !account.startsWith('0x')) {
      setError("Connect your wallet first");
      return;
    }

    setIsFlipping(true);
    setSide(null);
    setTxStatus('staking');

    try {
      const gameData = { choice, bet };
      const gameDataStr = JSON.stringify(gameData);
      const txResult = await playLoomii(2, gameDataStr, account, bet, (hash) => {
        setCurrentTxHash(hash);
        setTxStatus('processing');
      });

      if (!txResult.success) {
        setError(txResult.error || "Transaction failed");
        setIsFlipping(false);
        setTxStatus('idle');
        return;
      }

      const txHash = txResult.hash!;
      const result = txResult.result;
      const isWin = result?.status === 'WIN';
      const resultVibe = result?.vibe || "The coin has landed.";

      setCurrentTxHash(txHash);
      setTxStatus('confirmed');
      setSide(choice);

      addHistory({
        type: 'coin', 
        outcome: isWin ? 'win' : 'loss', 
        amount: bet,
        message: `${isWin ? 'WON' : 'LOST'} calling ${choice.toUpperCase()}`,
        vibe: resultVibe,
        timestamp: Date.now(), 
        txHash, 
        isPending: false
      });

      refreshStats();
      setTimeout(() => setIsFlipping(false), 1000);
    } catch (e: unknown) {
      if (isRejectedTransaction(e)) {
        setError("Transaction cancelled by user.");
      } else {
        setError("An unexpected error occurred during the flip.");
      }
      setTxStatus('idle');
      setIsFlipping(false);
    }
  };

  return (
    <div className="p-12 text-center">
      <div className="mb-12 relative h-48 flex items-center justify-center">
        <motion.div
          animate={isFlipping ? { rotateY: 1800 } : { rotateY: 0 }}
          transition={{ duration: 1, ease: "easeInOut" }}
          className="w-32 h-32 bg-amber-500 rounded-full border-4 border-amber-600 flex items-center justify-center shadow-[0_0_40px_rgba(245,158,11,0.3)]"
        >
          <div className="text-4xl font-black text-amber-900">
            {side === 'heads' ? 'H' : side === 'tails' ? 'T' : '?'}
          </div>
        </motion.div>
      </div>

      <div className="max-w-xs mx-auto space-y-8">
        <div className="flex gap-4">
          <button
            onClick={() => flip('heads')}
            disabled={isFlipping}
            className="flex-1 py-4 bg-secondary border border-border rounded-xl font-bold uppercase tracking-widest text-xs hover:border-amber-500 transition-all disabled:opacity-50"
          >
            Heads
          </button>
          <button
            onClick={() => flip('tails')}
            disabled={isFlipping}
            className="flex-1 py-4 bg-secondary border border-border rounded-xl font-bold uppercase tracking-widest text-xs hover:border-amber-500 transition-all disabled:opacity-50"
          >
            Tails
          </button>
        </div>
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => setBet(Math.max(1, bet - 1))} className="w-9 h-9 rounded-lg border border-border hover:border-amber-500/40 flex items-center justify-center">
            <Minus className="w-4 h-4" />
          </button>
          <input
            type="number" min={1} value={bet}
            onChange={(e) => setBet(Math.max(1, parseInt(e.target.value) || 1))}
            className="bg-transparent border-b border-border font-mono text-center w-20 focus:border-amber-500 outline-none text-foreground"
          />
          <button onClick={() => setBet(bet + 1)} className="w-9 h-9 rounded-lg border border-border hover:border-amber-500/40 flex items-center justify-center">
            <Plus className="w-4 h-4" />
          </button>
          <div className="text-xs uppercase tracking-widest text-amber-500">GEN</div>
        </div>
      </div>
    </div>
  );
}
