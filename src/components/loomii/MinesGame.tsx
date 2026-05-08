import { useState } from 'react';
import { Bomb, RefreshCw, ShieldCheck, Plus, Minus } from 'lucide-react';
import type { GameProps } from '@/lib/loomii-types';
import { playLoomii } from '@/lib/loomii-engine';

export function MinesGame({ account, addHistory, ai, setTxStatus, setCurrentTxHash, setError, refreshStats }: GameProps) {
  const [bet, setBet] = useState(10);
  const [numMines, setNumMines] = useState(5);
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const submit = async () => {
    if (!account || !account.startsWith('0x')) {
      setError("Connect your wallet first");
      return;
    }
    if (selectedCell === null) {
      setError("Pick a cell to bet on first");
      return;
    }

    setIsPlaying(true);
    setSubmitted(false);
    setHint(null);
    setTxStatus('staking');

    try {
      const gameData = { numMines, guess: selectedCell, bet };
      const gameDataStr = JSON.stringify(gameData);
      const txResult = await playLoomii(3, gameDataStr, account, bet, (hash) => {
        setCurrentTxHash(hash);
        setTxStatus('processing');
      });

      if (!txResult.success) {
        setError(txResult.error || "Transaction failed");
        setIsPlaying(false);
        setTxStatus('idle');
        return;
      }

      const txHash = txResult.hash!;
      const result = txResult.result;
      const isWin = result?.status === 'WIN';
      const resultVibe = result?.vibe || "The grid is revealed.";

      setCurrentTxHash(txHash);
      setTxStatus('confirmed');
      setSubmitted(true);
      setHint(resultVibe);

      addHistory({
        type: 'mines', 
        outcome: isWin ? 'win' : 'loss', 
        amount: bet,
        message: `${isWin ? 'CLEARED' : 'BOOMED'} cell ${selectedCell}`,
        vibe: resultVibe, 
        timestamp: Date.now(), 
        txHash, 
        isPending: false
      });

      refreshStats();
    } catch (e: any) {
      if (e.code === 'ACTION_REJECTED' || e.message?.includes('user rejected action')) {
        setError("Transaction cancelled by user.");
      } else {
        setError("An unexpected error occurred while submitting.");
      }
      setTxStatus('idle');
    } finally {
      setIsPlaying(false);
    }
  };

  return (
    <div className="p-12">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="space-y-8">
          <div>
            <label className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-4 block">Bet Amount</label>
            <div className="flex items-center gap-3">
              <button onClick={() => setBet(Math.max(1, bet - 1))} className="w-9 h-9 rounded-lg border border-border flex items-center justify-center">
                <Minus className="w-4 h-4" />
              </button>
              <input
                type="number" min={1} value={bet}
                onChange={(e) => setBet(Math.max(1, parseInt(e.target.value) || 1))}
                className="flex-1 bg-secondary border border-border p-3 rounded-lg font-mono text-center focus:border-red-500 outline-none text-foreground"
              />
              <button onClick={() => setBet(bet + 1)} className="w-9 h-9 rounded-lg border border-border flex items-center justify-center">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-4 block">Mines: {numMines}</label>
            <input
              type="range" min="1" max="20" value={numMines}
              onChange={(e) => setNumMines(parseInt(e.target.value))}
              className="w-full accent-red-500 bg-secondary h-2 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <button
            onClick={submit}
            disabled={isPlaying || selectedCell === null}
            className={`w-full py-6 bg-red-500 text-white rounded-xl font-bold uppercase tracking-[0.2em] shadow-[0_0_30px_rgba(239,68,68,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 ${!account ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {isPlaying ? <RefreshCw className="w-6 h-6 animate-spin mx-auto" /> :
              !account ? 'Connect Wallet' :
              selectedCell === null ? 'Pick a Cell' : `Bet on Cell ${selectedCell}`}
          </button>

          {hint && submitted && (
            <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-red-400 mb-2">
                <ShieldCheck className="w-3 h-3" />
                Oracle Vibe
              </div>
              <p className="text-sm italic text-foreground/80 leading-relaxed">"{hint}"</p>
              <p className="text-[10px] text-muted-foreground/60 mt-2">GenVM is resolving outcome on-chain.</p>
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          <div className="grid grid-cols-5 gap-3 aspect-square">
            {Array.from({ length: 25 }).map((_, i) => {
              const isSelected = selectedCell === i;
              return (
                <button
                  key={i}
                  onClick={() => !isPlaying && setSelectedCell(i)}
                  disabled={isPlaying}
                  className={`w-full h-full rounded-xl border-2 transition-all flex items-center justify-center text-xs font-mono ${
                    isSelected
                      ? 'bg-red-500/30 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)]'
                      : 'bg-secondary border-border hover:border-red-500/40 hover:bg-muted shadow-inner'
                  }`}
                >
                  {isSelected ? <Bomb className="w-6 h-6 text-red-400" /> : <span className="text-muted-foreground/30">{i}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
