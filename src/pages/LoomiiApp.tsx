import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dice5, Gamepad2, Coins, Bomb, Wallet, ChevronRight, RefreshCw,
  ShieldCheck, Trophy, AlertCircle, History, Sparkles,
  ArrowRightLeft, ChevronDown, Construction, Fuel, LogOut, ExternalLink, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { ethers } from 'ethers';

import type { GameType, GameResult, PendingWager, TxStatus } from '@/lib/loomii-types';
import {
  LOOMII_CONTRACT_ADDRESS, NETWORK_CONFIG,
  INITIAL_BALANCE, fetchStats, resolveGame, withdrawFunds, emergencyDrain
} from '@/lib/loomii-engine';
import { GameCard } from '@/components/loomii/GameCard';
import { AccountDropdown } from '@/components/loomii/AccountDropdown';
import { BridgeDropdown } from '@/components/loomii/BridgeDropdown';
import { DiceGame } from '@/components/loomii/DiceGame';
import { RPSGame } from '@/components/loomii/RPSGame';
import { CoinFlipGame } from '@/components/loomii/CoinFlipGame';
import { MinesGame } from '@/components/loomii/MinesGame';

export default function LoomiiApp() {
  const [balance, setBalance] = useState(INITIAL_BALANCE);
  const [account, setAccount] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [activeGame, setActiveGame] = useState<GameType | null>(null);
  const [history, setHistory] = useState<GameResult[]>([]);
  const [pendingWagers, setPendingWagers] = useState<PendingWager[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<TxStatus>('idle');
  const [currentTxHash, setCurrentTxHash] = useState<string | null>(null);
  const [payoutTxHash, setPayoutTxHash] = useState<string | null>(null);
  const [contractStats, setContractStats] = useState<any>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchContractStats = async () => {
    const stats = await fetchStats();
    setContractStats(stats);
  };

  useEffect(() => {
    fetchContractStats();
    const interval = setInterval(fetchContractStats, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (txStatus === 'confirmed') {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = setTimeout(() => setTxStatus('idle'), 5000);
    }
    return () => { if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current); };
  }, [txStatus]);

  const aiRef = useRef<GoogleGenAI | null>(null);

  useEffect(() => {
    aiRef.current = new GoogleGenAI({ apiKey: (import.meta as any).env?.VITE_GEMINI_API_KEY || '' });

    if (typeof window !== 'undefined' && (window as any).ethereum) {
      const eth = (window as any).ethereum;
      eth.on('accountsChanged', (accounts: string[]) => {
        if (!accounts?.length || accounts[0] === 'undefined' || typeof accounts[0] !== 'string') {
          setAccount(null); setBalance(0);
        } else {
          try { setAccount(ethers.getAddress(accounts[0])); } catch { setAccount(null); }
        }
      });
      eth.on('chainChanged', () => window.location.reload());
    }
  }, []);

  useEffect(() => {
    const savedHistory = localStorage.getItem('loomii_history');
    if (savedHistory) {
      const parsed = JSON.parse(savedHistory);
      const cleaned = Array.isArray(parsed) ? parsed.filter((item: any) =>
        item.player !== "undefined" && item.player !== undefined && item.player !== null
      ) : [];
      setHistory(cleaned);
    }
    const savedPending = localStorage.getItem('loomii_pending_wagers');
    if (savedPending) {
      const parsed = JSON.parse(savedPending);
      const cleaned = Array.isArray(parsed) ? parsed.filter((item: any) =>
        item.player !== "undefined" && item.player !== undefined && item.player !== null
      ) : [];
      setPendingWagers(cleaned);
    }
  }, []);

  useEffect(() => { localStorage.setItem('loomii_history', JSON.stringify(history)); }, [history]);
  useEffect(() => { localStorage.setItem('loomii_pending_wagers', JSON.stringify(pendingWagers)); }, [pendingWagers]);

  useEffect(() => {
    const savedHistory = localStorage.getItem('loomii_history');
    if (savedHistory?.includes('"undefined"')) {
      localStorage.removeItem('loomii_history');
      localStorage.removeItem('loomii_pending_wagers');
      window.location.reload();
    }
  }, []);

  const connectWallet = async () => {
    if (!(window as any).ethereum) {
      setError("Please install MetaMask or another browser wallet.");
      return;
    }
    setIsConnecting(true);
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      if (!accounts?.length || accounts[0] === 'undefined' || typeof accounts[0] !== 'string') {
        setIsConnecting(false); return;
      }
      const sanitizedAddress = ethers.getAddress(accounts[0]);
      const network = await provider.getNetwork();
      if (network.chainId !== 61999n) {
        try {
          await (window as any).ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: NETWORK_CONFIG.chainId }],
          });
        } catch (switchError: any) {
          if (switchError.code === 4902) {
            await (window as any).ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [NETWORK_CONFIG],
            });
          } else throw switchError;
        }
      }
      setAccount(sanitizedAddress);
    } catch (err: any) {
      setError(err.message || "Failed to connect wallet");
    } finally {
      setIsConnecting(false);
    }
  };

  const addHistory = (result: GameResult) => {
    setHistory(prev => [result, ...prev].slice(0, 50));
  };

  const addPendingWager = (wager: PendingWager) => {
    setPendingWagers(prev => [wager, ...prev]);
  };

  const removePendingWager = (txHash: string) => {
    setPendingWagers(prev => prev.filter(w => w.txHash !== txHash));
  };

  const resolveWagerFn = async (wager: PendingWager) => {
    try {
      setTxStatus('processing');
      if (!wager.player || typeof wager.player !== 'string' || !wager.player.startsWith('0x')) {
        throw new Error(`Invalid player address in wager: ${wager.player}`);
      }
      await resolveGame(wager.player, wager.gameType, wager.betAmount, wager.data);
      setTxStatus('confirmed');
      removePendingWager(wager.txHash);
      setHistory(prev => prev.map(item =>
        item.txHash === wager.txHash ? { ...item, isPending: false, outcome: wager.simulatedOutcome } : item
      ));
      fetchContractStats();
      return true;
    } catch (err: any) {
      if (err.message?.includes('already resolved') || err.data?.message?.includes('already resolved')) {
        removePendingWager(wager.txHash);
        setHistory(prev => prev.map(item =>
          item.txHash === wager.txHash ? { ...item, isPending: false, outcome: wager.simulatedOutcome } : item
        ));
        setTxStatus('confirmed');
        return true;
      }
      setError("On-chain resolution failed. Check explorer.");
      setTxStatus('idle');
      return false;
    }
  };

  const syncWager = (txHash: string) => {
    const wager = pendingWagers.find(w => w.txHash === txHash);
    if (wager) {
      removePendingWager(txHash);
      setHistory(prev => prev.map(item =>
        item.txHash === txHash ? { ...item, isPending: false, outcome: wager.simulatedOutcome } : item
      ));
      return true;
    }
    return false;
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('loomii_history');
  };

  const gameProps = {
    balance, setBalance, account, addHistory, addPendingWager, resolveWagerFn,
    ai: aiRef.current, setTxStatus, currentTxHash, setCurrentTxHash, setPayoutTxHash, setError,
    isOwner: account?.toLowerCase() === contractStats?.owner
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveGame(null)}>
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center loomii-glow">
              <Sparkles className="text-primary-foreground w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tighter uppercase italic">Loomii</h1>
          </div>

          <div className="flex items-center gap-6">
            {!account ? (
              <button
                onClick={connectWallet}
                disabled={isConnecting}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2 rounded-full font-bold uppercase tracking-widest text-sm hover:scale-[1.02] active:scale-[0.98] transition-all loomii-glow disabled:opacity-50"
              >
                {isConnecting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <AccountDropdown
                  account={account}
                  balance={balance}
                  onDisconnect={() => { setAccount(null); setBalance(0); setActiveGame(null); }}
                />
                <BridgeDropdown balance={balance} setBalance={setBalance} />
              </div>
            )}
            <a
              href="https://testnet-faucet.genlayer.foundation/"
              target="_blank"
              rel="noopener noreferrer"
              title="Claim Faucet Tokens"
              className="p-2 rounded-full hover:bg-secondary border border-transparent hover:border-border text-muted-foreground hover:text-primary transition-all"
            >
              <Fuel className="w-4 h-4" />
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-8 p-4 bg-destructive/10 border border-destructive/50 rounded-xl flex items-center gap-3 text-destructive text-sm"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {!activeGame ? (
            <motion.div key="lobby" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <div className="mb-16 text-center max-w-5xl mx-auto">
                <motion.h2
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-5xl md:text-7xl lg:text-8xl font-black italic uppercase tracking-tighter leading-[0.85] mb-4"
                >
                  The Pulse Of <span className="text-primary">AI Gaming</span>
                </motion.h2>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.6 }}
                  transition={{ delay: 0.2 }}
                  className="text-lg md:text-xl lg:text-2xl font-medium uppercase tracking-widest mb-8"
                >
                  Fun and Fully On-Chain
                </motion.div>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.5 }}
                  transition={{ delay: 0.4 }}
                  className="text-sm md:text-base lg:text-lg leading-relaxed max-w-2xl mx-auto"
                >
                  Experience the first gaming suite powered by GenLayer's intelligent contracts, where every roll, flip, and click is governed by decentralized AI consensus.
                </motion.p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <GameCard title="Loomii Dice" description="Intelligent luck-based dice game with block vibe checks." icon={<Dice5 className="w-8 h-8" />} color="bg-blue-500" onClick={() => account ? setActiveGame('dice') : connectWallet()} />
                <GameCard title="RPS Battle" description="PvE Rock-Paper-Scissors with AI move validation." icon={<Gamepad2 className="w-8 h-8" />} color="bg-purple-500" onClick={() => account ? setActiveGame('rps') : connectWallet()} />
                <GameCard title="Head or Tail" description="Classic 50/50 flip powered by true randomness." icon={<Coins className="w-8 h-8" />} color="bg-amber-500" onClick={() => account ? setActiveGame('coin') : connectWallet()} />
                <GameCard title="Mines" description="5x5 grid survival with AI Oracle hints." icon={<Bomb className="w-8 h-8" />} color="bg-red-500" onClick={() => account ? setActiveGame('mines') : connectWallet()} />
              </div>

              {!account && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-12 p-8 bg-primary/5 border border-primary/20 rounded-3xl text-center max-w-xl mx-auto"
                >
                  <Wallet className="w-12 h-12 text-primary mx-auto mb-4" />
                  <h3 className="text-2xl font-bold uppercase italic mb-2">Wallet Required</h3>
                  <p className="text-muted-foreground mb-6 text-sm">Connect your MetaMask to GenLayer StudioNet to start playing and earning GEN.</p>
                  <button
                    onClick={connectWallet}
                    disabled={isConnecting}
                    className="w-full max-w-xs bg-primary text-primary-foreground px-8 py-3 rounded-full font-bold uppercase tracking-widest hover:scale-105 active:scale-95 transition-all loomii-glow disabled:opacity-50"
                  >
                    {isConnecting ? 'Connecting...' : 'Connect Wallet Now'}
                  </button>
                </motion.div>
              )}
            </motion.div>
          ) : (
            <motion.div key="game" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="max-w-4xl mx-auto">
              <button
                onClick={() => setActiveGame(null)}
                className="mb-8 flex items-center gap-2 text-sm uppercase tracking-widest opacity-50 hover:opacity-100 transition-opacity"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
                Back to Lobby
              </button>

              <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-2xl">
                {activeGame === 'dice' && <DiceGame {...gameProps} />}
                {activeGame === 'rps' && <RPSGame {...gameProps} />}
                {activeGame === 'coin' && <CoinFlipGame {...gameProps} />}
                {activeGame === 'mines' && <MinesGame {...gameProps} />}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Transaction Lifecycle Overlay (Staking only) */}
        <AnimatePresence>
          {txStatus === 'staking' && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-6"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="bg-card border border-border rounded-3xl p-8 max-w-md w-full text-center shadow-2xl"
              >
                <div className="mb-8 relative">
                  <div className="w-24 h-24 rounded-full border-4 border-border mx-auto flex items-center justify-center">
                    <Wallet className="w-10 h-10 text-primary animate-pulse" />
                  </div>
                  <div className="absolute inset-0 border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin" />
                </div>
                <h2 className="text-2xl font-bold uppercase italic tracking-tight mb-2">Staking GEN...</h2>
                <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
                  Confirm the transaction in your wallet to place your wager on the GenLayer Bradbury Testnet.
                </p>
                <div className="flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground/50">
                  <ShieldCheck className="w-3 h-3" />
                  Secure On-Chain Transaction
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status Indicator */}
        <AnimatePresence>
          {txStatus !== 'idle' && txStatus !== 'staking' && (
            <motion.div
              initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
              className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40"
            >
              <div className="bg-card border border-border rounded-full px-6 py-3 flex items-center gap-4 shadow-2xl backdrop-blur-md">
                <div className="flex items-center gap-3">
                  {txStatus === 'processing' && <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />}
                  {txStatus === 'payout' && <Trophy className="w-4 h-4 text-green-500 animate-bounce" />}
                  {txStatus === 'confirmed' && <ShieldCheck className="w-4 h-4 text-primary" />}
                  <span className="text-xs font-bold uppercase tracking-widest">
                    {txStatus === 'processing' && 'Waiting for AI Consensus...'}
                    {txStatus === 'payout' && 'Payout Triggered!'}
                    {txStatus === 'confirmed' && 'Transaction Confirmed'}
                  </span>
                </div>
                {currentTxHash && <div className="w-px h-4 bg-border" />}
                <div className="flex flex-col gap-2">
                  {currentTxHash && (
                    <a href={`${NETWORK_CONFIG.blockExplorerUrls[0]}tx/${currentTxHash}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[10px] text-primary hover:underline font-mono">
                      <ExternalLink className="w-3 h-3" />
                      Wager: {currentTxHash.slice(0, 6)}...{currentTxHash.slice(-4)}
                    </a>
                  )}
                  {payoutTxHash && (
                    <a href={`${NETWORK_CONFIG.blockExplorerUrls[0]}tx/${payoutTxHash}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[10px] text-green-500 hover:underline font-mono">
                      <ExternalLink className="w-3 h-3" />
                      Payout: {payoutTxHash.slice(0, 6)}...{payoutTxHash.slice(-4)}
                    </a>
                  )}
                </div>
                {txStatus === 'confirmed' && (
                  <button onClick={() => setTxStatus('idle')} className="ml-2 p-1 hover:bg-secondary rounded-full transition-colors">
                    <LogOut className="w-3 h-3 rotate-90 opacity-50" />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* History Section */}
        <div className="mt-24 border-t border-border pt-12">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <History className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold uppercase italic tracking-tight">Recent Transactions</h2>
            </div>
            <div className="flex items-center gap-6">
              <button onClick={clearHistory} className="text-[10px] uppercase tracking-widest text-muted-foreground/50 hover:text-foreground transition-opacity">
                Clear History
              </button>
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground/50">
                <ShieldCheck className="w-3 h-3" />
                Verified by GenLayer
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {history.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground/30 italic">No transactions found in this block.</div>
            ) : (
              history.map((item, i) => (
                <motion.div
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  key={i}
                  className="flex items-center justify-between p-4 bg-card border border-border rounded-lg hover:border-muted-foreground/20 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded flex items-center justify-center ${
                      item.outcome === 'win' ? 'bg-green-500/10 text-green-500' :
                      item.outcome === 'loss' ? 'bg-red-500/10 text-red-500' :
                      item.outcome === 'pending' ? 'bg-blue-500/10 text-blue-500' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {item.outcome === 'win' ? <Trophy className="w-4 h-4" /> :
                       item.outcome === 'pending' ? <RefreshCw className="w-4 h-4 animate-spin" /> :
                       <AlertCircle className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="text-sm font-bold uppercase tracking-tight">
                        {item.type === 'faucet' ? 'Faucet' : `${item.type} Game`}
                        {item.isPending && <span className="ml-2 text-[8px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">Pending</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">{new Date(item.timestamp).toLocaleTimeString()}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className={`text-sm font-mono font-bold ${
                        item.outcome === 'win' ? 'text-green-500' :
                        item.outcome === 'loss' ? 'text-red-500' :
                        'text-muted-foreground'
                      }`}>
                        {item.outcome === 'win' ? '+' : item.outcome === 'loss' ? '-' : ''}{item.amount} GEN
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <div className="text-[10px] text-muted-foreground/60 max-w-[150px] truncate italic">{item.vibe || item.message}</div>
                        {item.txHash && (
                          <a href={`${NETWORK_CONFIG.blockExplorerUrls[0]}tx/${item.txHash}`} target="_blank" rel="noopener noreferrer"
                            className="text-[10px] text-primary hover:underline flex items-center gap-1">
                            <ExternalLink className="w-2.5 h-2.5" /> TX
                          </a>
                        )}
                      </div>
                    </div>
                    {item.isPending && account && (
                      <div className="flex gap-2">
                        {contractStats && account.toLowerCase() === contractStats.owner ? (
                          <button
                            onClick={() => {
                              const wager = pendingWagers.find(w => w.txHash === item.txHash);
                              if (wager) resolveWagerFn(wager);
                            }}
                            className="px-3 py-1.5 bg-primary text-primary-foreground text-[10px] font-bold uppercase rounded hover:scale-105 transition-transform"
                          >
                            Resolve
                          </button>
                        ) : (
                          <button
                            onClick={() => syncWager(item.txHash!)}
                            className="px-3 py-1.5 bg-secondary border border-primary/30 text-primary text-[10px] font-bold uppercase rounded hover:bg-primary/10 transition-all"
                            title="Sync with chain if already finalized"
                          >
                            Sync
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* Contract Admin Panel */}
      {account && contractStats && account.toLowerCase() === contractStats.owner && (
        <div className="max-w-7xl mx-auto px-6 pb-12">
          <div className="bg-card border border-primary/30 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <ShieldCheck className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-black italic uppercase tracking-tighter">Contract Admin</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 bg-secondary rounded-xl border border-border">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">House Reserve</div>
                <div className="text-2xl font-mono text-primary">{contractStats.houseReserve} GEN</div>
              </div>
              <div className="p-4 bg-secondary rounded-xl border border-border">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Total Wagered</div>
                <div className="text-2xl font-mono">{contractStats.totalWagered} GEN</div>
              </div>
              <div className="p-4 bg-secondary rounded-xl border border-border">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Total Paid</div>
                <div className="text-2xl font-mono">{contractStats.totalPaid} GEN</div>
              </div>
            </div>

            {pendingWagers.length > 0 && (
              <div className="mt-8">
                <div className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-4">Pending Resolutions ({pendingWagers.length})</div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {pendingWagers.map((wager) => (
                    <div key={wager.txHash} className="flex items-center justify-between p-4 bg-secondary border border-border rounded-xl">
                      <div className="flex items-center gap-4">
                        <div className="text-xs font-bold uppercase">{wager.gameName}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">{wager.player.slice(0, 6)}...{wager.player.slice(-4)}</div>
                        <div className="text-[10px] font-mono text-primary">{wager.betAmount} GEN</div>
                      </div>
                      <div className="flex items-center gap-4">
                        <a href={`${NETWORK_CONFIG.blockExplorerUrls[0]}tx/${wager.txHash}`} target="_blank" rel="noopener noreferrer"
                          className="text-[10px] text-primary hover:underline flex items-center gap-1">
                          <ExternalLink className="w-2.5 h-2.5" /> TX
                        </a>
                        <button
                          onClick={() => resolveWagerFn(wager)}
                          className="px-4 py-2 bg-primary text-primary-foreground text-[10px] font-bold uppercase rounded-lg hover:scale-105 transition-transform"
                        >
                          Resolve Now
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-8 flex gap-4">
              <button
                onClick={async () => {
                  const amount = prompt("Enter amount to withdraw (GEN):");
                  if (amount) {
                    try {
                      setTxStatus('processing');
                      await withdrawFunds(amount);
                      setTxStatus('confirmed');
                      alert("Withdrawal successful!");
                      fetchContractStats();
                    } catch (e: any) {
                      setTxStatus('idle');
                      if (e.code === 'ACTION_REJECTED' || e.message?.includes('user rejected action')) {
                        alert("Withdrawal cancelled by user.");
                      } else {
                        alert("Withdrawal failed.");
                      }
                    }
                  }
                }}
                className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-bold uppercase tracking-widest text-xs"
              >
                Withdraw Funds
              </button>
              <button
                onClick={async () => {
                  if (confirm("Are you sure you want to trigger emergency drain?")) {
                    try {
                      setTxStatus('processing');
                      await emergencyDrain();
                      setTxStatus('confirmed');
                      alert("Emergency drain successful!");
                      fetchContractStats();
                    } catch (e: any) {
                      setTxStatus('idle');
                      if (e.code === 'ACTION_REJECTED' || e.message?.includes('user rejected action')) {
                        alert("Emergency drain cancelled by user.");
                      } else {
                        alert("Emergency drain failed.");
                      }
                    }
                  }
                }}
                className="px-6 py-3 border border-destructive text-destructive rounded-lg font-bold uppercase tracking-widest text-xs"
              >
                Emergency Drain
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="py-12 border-t border-border text-center text-muted-foreground/30 text-xs uppercase tracking-[0.2em]">
        Loomii &copy; 2026 &bull; Powered by GenLayer Intelligent Contracts
      </footer>
    </div>
  );
}
