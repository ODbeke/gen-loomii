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

export interface LoomiiContractResult {
  status: 'WIN' | 'LOSS' | 'ERROR' | 'UNKNOWN';
  win?: boolean;
  outcome?: string;
  vibe?: string;
  round_id?: number;
  message?: string;
}

export type TxStatus = 'idle' | 'staking' | 'processing' | 'payout' | 'confirmed';

export interface GameProps {
  balance: number;
  setBalance: (b: number) => void;
  account: string | null;
  addHistory: (result: GameResult) => void;
  setTxStatus: (status: TxStatus) => void;
  currentTxHash: string | null;
  setCurrentTxHash: (hash: string | null) => void;
  setPayoutTxHash: (hash: string | null) => void;
  setError: (error: string | null) => void;
  refreshStats: () => void;
}
