import { useState } from 'react';
import { motion } from 'motion/react';
import type { GameProps, PendingWager } from '@/lib/loomii-types';
import { playLoomii } from '@/lib/loomii-engine';

export function CoinFlipGame({ balance, setBalance, account, addHistory, addPendingWager, resolveWager, setTxStatus, currentTxHash, setCurrentTxHash, setPayoutTxHash, setError, isOwner }: GameProps) {
  const [bet, setBet] = useState(10);
  const [isFlipping, setIsFlipping] = useState(false);
  const [side, setSide] = useState<'heads' | 'tails' | null>(null);

  const flip = async (choice: 'heads' | 'tails') => {
    if (!account || !account.startsWith('0x')) {
      setError("Connect your wallet first");
      setTimeout(() => setError(null), 3000);
      return;
    }

    setIsFlipping(true);
    setSide(null);
    setTxStatus('staking');

    try {
      const gameData = { choice, bet };
      const gameDataStr = JSON.stringify(gameData);
      const choiceStr = choice.charAt(0).toUpperCase() + choice.slice(1);
      const txResult = await playLoomii(2, choiceStr, account);

      if (!txResult.success) {
        setError(txResult.error || "Transaction failed");
        setIsFlipping(false);
        setTxStatus('idle');
        return;
      }

      const txHash = txResult.hash;
      setCurrentTxHash(txHash);
      setTxStatus('confirmed');

      const result = Math.random() > 0.5 ? 'heads' : 'tails';
      setSide(result);
      const win = choice === result;

      const wager: PendingWager = {
        player: account, gameType: 2, betAmount: bet, data: gameDataStr,
        timestamp: Date.now(), txHash: txHash!, gameName: 'Coin Flip',
        simulatedOutcome: win ? 'win' : 'loss'
      };
      addPendingWager(wager);

      addHistory({
        type: 'coin', outcome: win ? 'win' : 'loss', amount: bet,
        message: `Flipped ${result.toUpperCase()} (${win ? 'WIN' : 'LOSS'}) - Pending Resolution`,
        timestamp: Date.now(), txHash: txHash!, isPending: true
      });

      if (isOwner) await resolveWager(wager);
      else setTxStatus('confirmed');

      setTimeout(() => setIsFlipping(false), 1000);
    } catch (e: any) {
      if (e.code === 'ACTION_REJECTED' || e.message?.includes('user rejected action')) {
        setError("Transaction cancelled by user.");
        setTimeout(() => setError(null), 3000);
      } else {
        setError("An unexpected error occurred during the flip.");
        setTimeout(() => setError(null), 5000);
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
        <div className="flex items-center justify-center gap-4">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Bet:</div>
          <input
            type="number" value={bet} onChange={(e) => setBet(parseInt(e.target.value))}
            className="bg-transparent border-b border-border font-mono text-center w-20 focus:border-amber-500 outline-none text-foreground"
          />
          <div className="text-xs uppercase tracking-widest text-amber-500">GEN</div>
        </div>
      </div>
    </div>
  );
}
