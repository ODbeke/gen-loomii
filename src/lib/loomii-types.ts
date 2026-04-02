export type GameType = 'dice' | 'rps' | 'coin' | 'mines' | 'faucet';

export interface GameResult {
  type: GameType;
  outcome: 'win' | 'loss' | 'draw' | 'pending';
  amount: number;
  message: string;
  vibe?: string;
  timestamp: number;
  txHash?: string;
  payoutTxHash?: string;
  isPending?: boolean;
}

export interface PendingWager {
  player: string;
  gameType: number;
  betAmount: number;
  data: string;
  timestamp: number;
  txHash: string;
  gameName: string;
  simulatedOutcome: 'win' | 'loss' | 'draw';
}

export type TxStatus = 'idle' | 'staking' | 'processing' | 'payout' | 'confirmed';

export interface GameProps {
  balance: number;
  setBalance: (b: number) => void;
  account: string | null;
  addHistory: (result: GameResult) => void;
  addPendingWager: (wager: PendingWager) => void;
  resolveWager: (wager: PendingWager) => Promise<boolean>;
  ai?: any;
  setTxStatus: (status: TxStatus) => void;
  currentTxHash: string | null;
  setCurrentTxHash: (hash: string | null) => void;
  setPayoutTxHash: (hash: string | null) => void;
  setError: (error: string | null) => void;
  isOwner: boolean;
}
