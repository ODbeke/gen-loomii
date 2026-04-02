import { useState, useCallback } from 'react';
import { Bomb, RefreshCw, ShieldCheck, Info } from 'lucide-react';
import type { GameProps, PendingWager } from '@/lib/loomii-types';
import { playLoomii } from '@/lib/loomii-engine';

export function MinesGame({ balance, setBalance, account, addHistory, addPendingWager, resolveWager, ai, setTxStatus, currentTxHash, setCurrentTxHash, setPayoutTxHash, setError, isOwner }: GameProps) {
  const [bet, setBet] = useState(10);
  const [numMines, setNumMines] = useState(5);
  const [gameActive, setGameActive] = useState(false);
  const [mines, setMines] = useState<number[]>([]);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const getMultiplier = useCallback((safeCount: number) => {
    if (safeCount === 0) return 1;
    let mult = 1;
    const total = 25;
    for (let i = 0; i < safeCount; i++) {
      mult *= (total - i) / (total - numMines - i);
    }
    return mult * 0.98;
  }, [numMines]);

  const startGame = async () => {
    if (!account || !account.startsWith('0x')) {
      setError("Connect your wallet first");
      return;
    }

    setIsStarting(true);
    setGameActive(false);
    setRevealed([]);
    setIsGameOver(false);
    setHint(null);
    setTxStatus('staking');

    const newMines: number[] = [];
    while (newMines.length < numMines) {
      const idx = Math.floor(Math.random() * 25);
      if (!newMines.includes(idx)) newMines.push(idx);
    }
    setMines(newMines);

    try {
      const gameData = { numMines, mines: newMines, bet };
      const gameDataStr = JSON.stringify(gameData);
      const txResult = await playLoomii(3, gameDataStr, account);

      if (!txResult.success) {
        setError(txResult.error || "Transaction failed");
        setIsStarting(false);
        setTxStatus('idle');
        return;
      }

      const txHash = txResult.hash;
      setCurrentTxHash(txHash);
      setTxStatus('confirmed');
      setGameActive(true);

      let oracleHint = "The AI is silent.";
      try {
        const response = await ai?.models?.generateContent({
          model: "gemini-3-flash-preview",
          contents: `The transaction hash is ${txHash}. The mines are at indices ${newMines} on a 5x5 grid (0-24). Give a cryptic but helpful hint for the first move without revealing a direct mine location. Max 20 words.`,
          config: { maxOutputTokens: 100 }
        });
        oracleHint = response?.text || oracleHint;
      } catch (e: any) {
        if (e.message?.includes('RESOURCE_EXHAUSTED')) {
          oracleHint = "Oracle offline (Quota Exceeded). Trust your instincts.";
        }
      }
      setHint(oracleHint);
    } catch (e: any) {
      if (e.code === 'ACTION_REJECTED' || e.message?.includes('user rejected action')) {
        setError("Transaction cancelled by user.");
      } else {
        setError("An unexpected error occurred while starting the game.");
      }
      setTxStatus('idle');
    } finally {
      setIsStarting(false);
    }
  };

  const reveal = (idx: number) => {
    if (!gameActive || revealed.includes(idx) || isGameOver) return;
    const newRevealed = [...revealed, idx];
    setRevealed(newRevealed);

    if (mines.includes(idx)) {
      setIsGameOver(true);
      setGameActive(false);
      const gameDataStr = JSON.stringify({ mines, numMines, revealed: newRevealed });
      const wager: PendingWager = {
        player: account!, gameType: 3, betAmount: bet, data: gameDataStr,
        timestamp: Date.now(), txHash: currentTxHash!, gameName: 'Mines',
        simulatedOutcome: 'loss'
      };
      addPendingWager(wager);
      addHistory({
        type: 'mines', outcome: 'loss', amount: bet,
        message: `Hit a mine at cell ${idx} - Pending Resolution`,
        timestamp: Date.now(), txHash: currentTxHash!, isPending: true
      });
      if (isOwner) resolveWager(wager);
    }
  };

  const cashOut = async () => {
    if (!gameActive || isGameOver || revealed.length === 0) return;
    setGameActive(false);
    setIsGameOver(true);

    const gameDataStr = JSON.stringify({ mines, numMines, revealed });
    const wager: PendingWager = {
      player: account!, gameType: 3, betAmount: bet, data: gameDataStr,
      timestamp: Date.now(), txHash: currentTxHash!, gameName: 'Mines',
      simulatedOutcome: 'win'
    };
    addPendingWager(wager);
    addHistory({
      type: 'mines', outcome: 'win', amount: bet,
      message: `Cashed out at ${getMultiplier(revealed.length).toFixed(2)}x - Pending Resolution`,
      timestamp: Date.now(), txHash: currentTxHash!, isPending: true
    });
    if (isOwner) await resolveWager(wager);
    else setTxStatus('confirmed');
  };

  return (
    <div className="p-12">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="space-y-8">
          <div>
            <label className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-4 block">Bet Amount</label>
            <input
              type="number" value={bet} onChange={(e) => setBet(parseInt(e.target.value))}
              disabled={gameActive && !isGameOver}
              className="w-full bg-secondary border border-border p-4 rounded-xl font-mono focus:border-red-500 outline-none text-foreground"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-4 block">Mines: {numMines}</label>
            <input
              type="range" min="1" max="20" value={numMines}
              onChange={(e) => setNumMines(parseInt(e.target.value))}
              disabled={gameActive && !isGameOver}
              className="w-full accent-red-500 bg-secondary h-2 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {!gameActive || isGameOver ? (
            <button
              onClick={startGame}
              disabled={isStarting}
              className={`w-full py-6 bg-red-500 text-white rounded-xl font-bold uppercase tracking-[0.2em] shadow-[0_0_30px_rgba(239,68,68,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 ${!account ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {isStarting ? <RefreshCw className="w-6 h-6 animate-spin mx-auto" /> : account ? 'Start Game' : 'Connect Wallet'}
            </button>
          ) : (
            <button
              onClick={cashOut}
              disabled={revealed.length === 0}
              className="w-full py-6 bg-green-500 text-white rounded-xl font-bold uppercase tracking-[0.2em] shadow-[0_0_30px_rgba(34,197,94,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
            >
              Cash Out ({getMultiplier(revealed.length).toFixed(2)}x)
            </button>
          )}

          {hint && (
            <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-red-400 mb-2">
                <Info className="w-3 h-3" />
                AI Oracle Hint
              </div>
              <p className="text-sm italic text-foreground/80 leading-relaxed">"{hint}"</p>
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          <div className="grid grid-cols-5 gap-3 aspect-square">
            {Array.from({ length: 25 }).map((_, i) => {
              const isRevealed = revealed.includes(i);
              const isMine = mines.includes(i);
              const showContent = isRevealed || isGameOver;

              return (
                <button
                  key={i}
                  onClick={() => reveal(i)}
                  disabled={!gameActive || isGameOver || isRevealed}
                  className={`w-full h-full rounded-xl border-2 transition-all flex items-center justify-center ${
                    isRevealed
                      ? (isMine ? 'bg-red-500 border-red-600 shadow-[0_0_20px_rgba(239,68,68,0.6)]' : 'bg-secondary border-border')
                      : (isGameOver
                          ? (isMine ? 'bg-red-500/30 border-red-500/40' : 'bg-secondary/40 border-border/20')
                          : 'bg-secondary border-border hover:border-primary hover:bg-muted shadow-inner')
                  }`}
                >
                  {showContent && (
                    isMine
                      ? <Bomb className={`w-8 h-8 ${isRevealed ? 'text-white' : 'text-white/40'}`} />
                      : <ShieldCheck className={`w-8 h-8 ${isRevealed ? 'text-green-500' : 'text-green-500/20'}`} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
