import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import type { GameProps, PendingWager } from '@/lib/loomii-types';
import { playLoomii } from '@/lib/loomii-engine';
import { ThinkingLevel } from '@google/genai';

function MoveIcon({ move, className }: { move: string; className?: string }) {
  if (move === 'rock') return <div className={`text-2xl ${className}`}>🪨</div>;
  if (move === 'paper') return <div className={`text-2xl ${className}`}>📄</div>;
  if (move === 'scissors') return <div className={`text-2xl ${className}`}>✂️</div>;
  return null;
}

export function RPSGame({ balance, setBalance, account, addHistory, addPendingWager, resolveWager, ai, setTxStatus, currentTxHash, setCurrentTxHash, setPayoutTxHash, setError, isOwner }: GameProps) {
  const [bet, setBet] = useState(10);
  const [isFighting, setIsFighting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [vibe, setVibe] = useState<string | null>(null);
  const moves = ['rock', 'paper', 'scissors'];

  const play = async (userMove: string) => {
    if (!account || !account.startsWith('0x')) {
      setError("Connect your wallet first");
      setTimeout(() => setError(null), 3000);
      return;
    }

    setIsFighting(true);
    setResult(null);
    setVibe(null);
    setTxStatus('staking');

    try {
      const gameData = { userMove, bet };
      const gameDataStr = JSON.stringify(gameData);
      const moveStr = userMove.charAt(0).toUpperCase() + userMove.slice(1);
      const txResult = await playLoomii(1, moveStr, account);

      if (!txResult.success) {
        setError(txResult.error || "Transaction failed");
        setIsFighting(false);
        setTxStatus('idle');
        return;
      }

      const txHash = txResult.hash;
      setCurrentTxHash(txHash);
      setTxStatus('confirmed');

      let aiMove = 'rock';
      try {
        const salt = Math.random().toString(36).substring(7);
        const response = await ai?.models?.generateContent({
          model: "gemini-3.1-pro-preview",
          contents: `[Block Entropy Salt: ${salt}] Transaction Hash: ${txHash}. Choose a move for Rock-Paper-Scissors: 'rock', 'paper', or 'scissors'. Return ONLY the word.`,
          config: { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }, temperature: 1.0 }
        });
        aiMove = response?.text?.toLowerCase().trim() || 'rock';
      } catch {
        aiMove = moves[Math.floor(Math.random() * 3)];
      }

      const finalAiMove = moves.includes(aiMove) ? aiMove : 'rock';
      let outcome: 'win' | 'loss' | 'draw' = 'draw';
      if (userMove === finalAiMove) outcome = 'draw';
      else if (
        (userMove === 'rock' && finalAiMove === 'scissors') ||
        (userMove === 'paper' && finalAiMove === 'rock') ||
        (userMove === 'scissors' && finalAiMove === 'paper')
      ) outcome = 'win';
      else outcome = 'loss';

      const wager: PendingWager = {
        player: account, gameType: 1, betAmount: bet, data: gameDataStr,
        timestamp: Date.now(), txHash: txHash!, gameName: 'RPS',
        simulatedOutcome: outcome
      };
      addPendingWager(wager);
      setResult({ user: userMove, ai: finalAiMove, outcome });

      let vibeCheck = "The block spirits are silent.";
      try {
        const response = await ai?.models?.generateContent({
          model: "gemini-3-flash-preview",
          contents: `The user played ${userMove} against AI's ${finalAiMove}. The result was a ${outcome}. Give a witty, short 'vibe check' on this block's luck. Max 15 words.`,
          config: { maxOutputTokens: 100 }
        });
        vibeCheck = response?.text || vibeCheck;
      } catch {}
      setVibe(vibeCheck);

      addHistory({
        type: 'rps', outcome, amount: bet,
        message: `${userMove.toUpperCase()} vs ${finalAiMove.toUpperCase()} (${outcome.toUpperCase()}) - Pending Resolution`,
        vibe: vibeCheck, timestamp: Date.now(), txHash: txHash!, isPending: true
      });

      if (isOwner) await resolveWager(wager);
      else setTxStatus('confirmed');
    } catch (e: any) {
      if (e.code === 'ACTION_REJECTED' || e.message?.includes('user rejected action')) {
        setError("Transaction cancelled by user.");
        setTimeout(() => setError(null), 3000);
      } else {
        setError("An unexpected error occurred during the duel.");
        setTimeout(() => setError(null), 5000);
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
              {result ? <MoveIcon move={result.user} /> : <div className="w-8 h-8 bg-muted rounded-full animate-pulse" />}
            </div>
          </div>
          <div className="text-4xl font-black italic text-muted-foreground/30">VS</div>
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-4">AI Oracle</div>
            <div className="w-32 h-32 bg-secondary rounded-2xl flex items-center justify-center border border-border">
              {result ? <MoveIcon move={result.ai} /> : <div className="w-8 h-8 bg-muted rounded-full animate-pulse" />}
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
          <div className="flex items-center justify-center gap-4">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Bet:</div>
            <input
              type="number" value={bet} onChange={(e) => setBet(parseInt(e.target.value))}
              className="bg-transparent border-b border-border font-mono text-center w-20 focus:border-primary outline-none text-foreground"
            />
            <div className="text-xs uppercase tracking-widest text-primary">GEN</div>
          </div>
        </div>

        {result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className={`text-2xl font-black uppercase italic tracking-tighter ${
              result.outcome === 'win' ? 'text-green-500' :
              result.outcome === 'loss' ? 'text-red-500' :
              'text-muted-foreground'
            }`}
          >
            {result.outcome === 'win' ? 'Victory' : result.outcome === 'loss' ? 'Defeat' : 'Draw'}
          </motion.div>
        )}
      </div>
    </div>
  );
}
