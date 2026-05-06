import { useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import { motion } from 'motion/react';
import type { GameProps } from '@/lib/loomii-types';
import { playLoomii } from '@/lib/loomii-engine';

function MoveIcon({ move, className }: { move: string; className?: string }) {
  if (move === 'rock') return <div className={`text-2xl ${className}`}>🪨</div>;
  if (move === 'paper') return <div className={`text-2xl ${className}`}>📄</div>;
  if (move === 'scissors') return <div className={`text-2xl ${className}`}>✂️</div>;
  return null;
}

export function RPSGame({ account, addHistory, setTxStatus, setCurrentTxHash, setError, refreshStats }: GameProps) {
  const [bet, setBet] = useState(10);
  const [isFighting, setIsFighting] = useState(false);
  const [userMove, setUserMove] = useState<string | null>(null);

  const play = async (move: string) => {
    if (!account || !account.startsWith('0x')) {
      setError("Connect your wallet first");
      return;
    }

    setIsFighting(true);
    setUserMove(null);
    setTxStatus('staking');

    try {
      const gameData = { userMove: move, bet };
      const gameDataStr = JSON.stringify(gameData);
      const txResult = await playLoomii(1, gameDataStr, account, bet);

      if (!txResult.success) {
        setError(txResult.error || "Transaction failed");
        setIsFighting(false);
        setTxStatus('idle');
        return;
      }

      const txHash = txResult.hash!;
      setCurrentTxHash(txHash);
      setTxStatus('confirmed');
      setUserMove(move);

      addHistory({
        type: 'rps', outcome: 'pending', amount: bet,
        message: `Played ${move.toUpperCase()} — Resolved on-chain by GenVM`,
        timestamp: Date.now(), txHash, isPending: true
      });

      refreshStats();
    } catch (e: any) {
      if (e.code === 'ACTION_REJECTED' || e.message?.includes('user rejected action')) {
        setError("Transaction cancelled by user.");
      } else {
        setError("An unexpected error occurred during the duel.");
      }
      setTxStatus('idle');
    } finally {
      setIsFighting(false);
    }
  };

  return (
    <div className="p-12">
      <div className="flex flex-col items-center gap-12">
        <div className="flex items-center gap-12">
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-4">You</div>
            <div className="w-32 h-32 bg-secondary rounded-2xl flex items-center justify-center border border-border">
              {userMove ? <MoveIcon move={userMove} /> : <div className="w-8 h-8 bg-muted rounded-full animate-pulse" />}
            </div>
          </div>
          <div className="text-4xl font-black italic text-muted-foreground/30">VS</div>
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-4">GenVM Oracle</div>
            <div className="w-32 h-32 bg-secondary rounded-2xl flex items-center justify-center border border-border">
              <div className="text-xs text-muted-foreground italic">on-chain</div>
            </div>
          </div>
        </div>

        <div className="w-full max-w-md space-y-8">
          <div className="flex justify-center gap-4">
            {['rock', 'paper', 'scissors'].map(move => (
              <button
                key={move}
                onClick={() => play(move)}
                disabled={isFighting}
                className="flex-1 p-6 bg-card border border-border rounded-xl hover:border-primary transition-all group disabled:opacity-50"
              >
                <MoveIcon move={move} className="w-8 h-8 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                <div className="text-[10px] uppercase tracking-widest font-bold">{move}</div>
              </button>
            ))}
          </div>
          <div className="flex items-center justify-center gap-3">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Bet:</div>
            <button onClick={() => setBet(Math.max(1, bet - 1))} className="w-9 h-9 rounded-lg border border-border hover:border-primary/40 flex items-center justify-center">
              <Minus className="w-4 h-4" />
            </button>
            <input
              type="number" min={1} value={bet}
              onChange={(e) => setBet(Math.max(1, parseInt(e.target.value) || 1))}
              className="bg-transparent border-b border-border font-mono text-center w-20 focus:border-primary outline-none text-foreground"
            />
            <button onClick={() => setBet(bet + 1)} className="w-9 h-9 rounded-lg border border-border hover:border-primary/40 flex items-center justify-center">
              <Plus className="w-4 h-4" />
            </button>
            <div className="text-xs uppercase tracking-widest text-primary">GEN</div>
          </div>
        </div>

        {userMove && !isFighting && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="text-sm text-muted-foreground italic text-center max-w-sm"
          >
            Wager submitted. The GenVM oracle is choosing the AI's move and resolving the round on-chain. Check the explorer for the consensus result.
          </motion.div>
        )}
      </div>
    </div>
  );
}
