import { useState } from 'react';
import { Dice5, RefreshCw, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { GameProps, PendingWager } from '@/lib/loomii-types';
import { playLoomii } from '@/lib/loomii-engine';

export function DiceGame({ balance, setBalance, account, addHistory, addPendingWager, resolveWager, ai, setTxStatus, currentTxHash, setCurrentTxHash, setPayoutTxHash, setError, isOwner }: GameProps) {
  const [bet, setBet] = useState(10);
  const [target, setTarget] = useState(50);
  const [isOver, setIsOver] = useState(true);
  const [isRolling, setIsRolling] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [vibe, setVibe] = useState<string | null>(null);

  const play = async () => {
    if (!account || typeof account !== 'string' || !account.startsWith('0x')) {
      setError("Connect your wallet first");
      setTimeout(() => setError(null), 3000);
      return;
    }

    setIsRolling(true);
    setResult(null);
    setVibe(null);
    setTxStatus('staking');

    try {
      const gameData = { target, isOver, prediction: isOver ? 'Over' : 'Under', bet };
      const gameDataStr = JSON.stringify(gameData);
      const txResult = await playLoomii(0, gameDataStr, account);

      if (!txResult.success) {
        setError(txResult.error || "Transaction failed");
        setIsRolling(false);
        setTxStatus('idle');
        return;
      }

      const txHash = txResult.hash;
      setCurrentTxHash(txHash);
      setTxStatus('confirmed');

      const roll = Math.floor(Math.random() * 100) + 1;
      const win = isOver ? roll > target : roll < target;

      const wager: PendingWager = {
        player: account, gameType: 0, betAmount: bet, data: gameDataStr,
        timestamp: Date.now(), txHash: txHash!, gameName: 'Dice',
        simulatedOutcome: win ? 'win' : 'loss'
      };
      addPendingWager(wager);

      let vibeCheck = "The block spirits are silent.";
      try {
        const response = await ai?.models?.generateContent({
          model: "gemini-3-flash-preview",
          contents: `The transaction hash is ${txHash}. The user bet ${bet} credits on ${target} ${isOver ? 'Over' : 'Under'}. The result was ${roll}. Give a witty, short 'vibe check' on the luck of this block. Max 15 words.`,
          config: { maxOutputTokens: 100 }
        });
        vibeCheck = response?.text || vibeCheck;
      } catch (e: any) {
        if (e.message?.includes('RESOURCE_EXHAUSTED')) {
          vibeCheck = "Intelligent vibe check unavailable (Quota Exceeded).";
        }
      }

      setResult(roll);
      setVibe(vibeCheck);

      addHistory({
        type: 'dice', outcome: win ? 'win' : 'loss', amount: bet,
        message: `Rolled ${roll} (${win ? 'WIN' : 'LOSS'}) - Pending Resolution`,
        vibe: vibeCheck, timestamp: Date.now(), txHash: txHash!, isPending: true
      });

      if (isOwner) {
        await resolveWager(wager);
      } else {
        setTxStatus('confirmed');
      }
    } catch (e: any) {
      if (e.code === 'ACTION_REJECTED' || e.message?.includes('user rejected action')) {
        setError("Transaction cancelled by user.");
        setTimeout(() => setError(null), 3000);
      } else {
        setError("An unexpected error occurred during the dice roll.");
        setTimeout(() => setError(null), 5000);
      }
      setTxStatus('idle');
    } finally {
      setIsRolling(false);
    }
  };

  return (
    <div className="p-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div className="space-y-8">
          <div>
            <label className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-4 block">Bet Amount</label>
            <div className="flex gap-2">
              {[10, 50, 100, 500].map(amt => (
                <button
                  key={amt}
                  onClick={() => setBet(amt)}
                  className={`px-4 py-2 rounded border transition-all font-mono ${bet === amt ? 'bg-primary border-primary text-primary-foreground' : 'border-border hover:border-muted-foreground/30'}`}
                >
                  {amt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-4 block">Prediction: {isOver ? 'Over' : 'Under'} {target}</label>
            <input
              type="range" min="1" max="100" value={target}
              onChange={(e) => setTarget(parseInt(e.target.value))}
              className="w-full accent-primary bg-secondary h-2 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between mt-4">
              <button
                onClick={() => setIsOver(false)}
                className={`flex-1 py-3 rounded-l-lg border transition-all uppercase tracking-widest text-xs font-bold ${!isOver ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'border-border text-muted-foreground'}`}
              >
                Under
              </button>
              <button
                onClick={() => setIsOver(true)}
                className={`flex-1 py-3 rounded-r-lg border transition-all uppercase tracking-widest text-xs font-bold ${isOver ? 'bg-primary/20 border-primary text-primary' : 'border-border text-muted-foreground'}`}
              >
                Over
              </button>
            </div>
          </div>

          <button
            onClick={play}
            disabled={isRolling}
            className={`w-full py-6 bg-primary text-primary-foreground rounded-xl font-bold uppercase tracking-[0.2em] loomii-glow hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed ${!account ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {isRolling ? <RefreshCw className="w-6 h-6 animate-spin mx-auto" /> : account ? 'Roll Dice' : 'Connect Wallet'}
          </button>
        </div>

        <div className="flex flex-col items-center justify-center bg-background rounded-2xl border border-border p-12 relative overflow-hidden">
          <div className="absolute top-4 left-4 flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground/50">
            <ShieldCheck className="w-3 h-3" />
            Equivalence Principle Active
          </div>

          <AnimatePresence mode="wait">
            {isRolling ? (
              <motion.div key="rolling" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.2 }} className="text-center">
                <motion.div
                  animate={{ rotate: [0, 90, 180, 270, 360], scale: [1, 1.1, 1] }}
                  transition={{ rotate: { repeat: Infinity, duration: 0.6, ease: "linear" }, scale: { repeat: Infinity, duration: 1, ease: "easeInOut" } }}
                >
                  <Dice5 className="w-24 h-24 mb-6 mx-auto text-primary drop-shadow-[0_0_15px_hsla(25,89%,55%,0.4)]" />
                </motion.div>
                <div className="text-xs uppercase tracking-[0.3em] font-bold text-primary animate-pulse">
                  Consulting Oracle...
                </div>
              </motion.div>
            ) : result !== null ? (
              <motion.div key="result" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
                <div className="text-8xl font-black italic tracking-tighter mb-4 text-primary">{result}</div>
                <div className="max-w-[250px] mx-auto">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Block Vibe</div>
                  <p className="text-sm italic text-foreground/80 leading-relaxed">"{vibe}"</p>
                </div>
              </motion.div>
            ) : (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 0.2 }} className="text-center">
                <Dice5 className="w-24 h-24 mb-4 mx-auto" />
                <div className="text-xs uppercase tracking-widest">Waiting for roll...</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
