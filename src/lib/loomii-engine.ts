import { ethers } from 'ethers';
import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { TransactionStatus, ExecutionResult } from 'genlayer-js/types';
import { getErrorMessage } from './errors';
import type { LoomiiContractResult } from './loomii-types';

export const LOOMII_CONTRACT_ADDRESS = "0x6f75F56eA4Cc17979Df41f5b4b48b98Acb8e6262";
export const INITIAL_BALANCE = 1000000;

export const NETWORK_CONFIG = {
  chainId: '0xF22F', // 61999
  chainName: 'GenLayer Studio Network',
  nativeCurrency: { name: 'GEN Token', symbol: 'GEN', decimals: 18 },
  rpcUrls: ['https://studio.genlayer.com/api'],
  blockExplorerUrls: ['https://genlayer-explorer.vercel.app/'],
};

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

type LoomiiStats = {
  total_wagered?: string | number | bigint;
  total_paid?: string | number | bigint;
  house_reserve?: string | number | bigint;
  owner?: string;
};

const parseLoomiiResult = (value: unknown): LoomiiContractResult | null => {
  if (!value) return null;

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parseLoomiiResult(parsed);
    } catch {
      return null;
    }
  }

  if (typeof value !== 'object') return null;

  const record = value as Record<string, unknown>;
  if (record.status === 'WIN' || record.status === 'LOSS' || record.status === 'ERROR') {
    return record as LoomiiContractResult;
  }

  return null;
};

const parseReadableResult = (readable: unknown): LoomiiContractResult | null => {
  if (typeof readable !== 'string') return null;

  try {
    const parsed = JSON.parse(readable);
    if (typeof parsed === 'string') return parseLoomiiResult(parsed);
    return parseLoomiiResult(parsed);
  } catch {
    return null;
  }
};

export const extractStudioReceiptResult = (receipt: unknown): LoomiiContractResult | null => {
  if (!receipt || typeof receipt !== 'object') return null;
  const record = receipt as Record<string, unknown>;
  const consensusData = record.consensus_data;
  if (!consensusData || typeof consensusData !== 'object') return null;

  const leaderReceipt = (consensusData as Record<string, unknown>).leader_receipt;
  if (!Array.isArray(leaderReceipt)) return null;

  for (const item of leaderReceipt) {
    if (!item || typeof item !== 'object') continue;
    const result = (item as Record<string, unknown>).result;
    if (!result || typeof result !== 'object') continue;

    const payload = (result as Record<string, unknown>).payload;
    if (!payload || typeof payload !== 'object') continue;

    const parsed = parseReadableResult((payload as Record<string, unknown>).readable);
    if (parsed) return parsed;
  }

  return null;
};

const extractReceiptResult = async (receipt: unknown, hash: string): Promise<LoomiiContractResult> => {
  let result: LoomiiContractResult = { status: 'UNKNOWN', vibe: 'The oracle is silent.' };

  const studioResult = extractStudioReceiptResult(receipt);
  if (studioResult) {
    return studioResult;
  }

  const receiptRecord = receipt as { data?: unknown };

  // On non-Studio receipts the contract's return value can be in receipt.data.
  if (receiptRecord.data) {
    try {
      const parsed = parseLoomiiResult(receiptRecord.data);
      if (parsed) {
        return parsed;
      }
    } catch (e) {
      console.warn("Could not parse receipt.data:", e, receiptRecord.data);
    }
  }

  // If receipt didn't have our result, try using debugTraceTransaction where available.
  try {
    const readClient = getReadClient();
    const trace = await readClient.debugTraceTransaction({ hash });
    console.log("🔍 Debug trace return_data:", trace.return_data);
    if (trace.return_data) {
      try {
        let decoded = trace.return_data;
        if (decoded.startsWith('0x')) {
          decoded = ethers.toUtf8String(decoded);
        }
        const parsed = parseLoomiiResult(decoded);
        if (parsed) result = parsed;
      } catch (parseErr) {
        console.warn("Could not parse trace return_data:", parseErr);
      }
    }
  } catch (traceErr) {
    console.warn("Debug trace failed:", traceErr);
  }

  return result;
};

const getEthereumProvider = (): EthereumProvider | null => {
  const candidate = (window as Window & { ethereum?: EthereumProvider }).ethereum;
  return candidate ?? null;
};

/**
 * Creates a read-only GenLayer client (no wallet needed).
 */
function getReadClient() {
  return createClient({
    chain: studionet,
  });
}

/**
 * Creates a GenLayer write client using the browser wallet.
 */
async function getWriteClient() {
  const ethereum = getEthereumProvider();
  if (!ethereum) throw new Error("No wallet provider found. Please install MetaMask.");

  const accounts = await ethereum.request({ method: 'eth_accounts' }) as string[];
  if (!accounts || accounts.length === 0) {
    throw new Error("No account connected. Please connect your wallet first.");
  }
  const account = accounts[0] as `0x${string}`;

  const client = createClient({
    chain: studionet,
    account,
    provider: ethereum,
  });
  return client;
}

/**
 * Fetch the native GEN balance of an account.
 */
export const fetchBalance = async (address: string): Promise<string> => {
  try {
    const provider = new ethers.JsonRpcProvider(NETWORK_CONFIG.rpcUrls[0]);
    const balance = await provider.getBalance(address);
    return ethers.formatEther(balance);
  } catch (error) {
    console.error("Error fetching balance:", error);
    return "0.0";
  }
};

/**
 * Place a wager via the contract's `play` function.
 * Uses the GenLayer SDK v1.x API with proper receipt handling.
 */
export const playLoomii = async (
  gameType: number,
  playerData: string,
  userAddress: string | null | undefined,
  betAmount: number,
  onHash?: (hash: string) => void
) => {
  if (!userAddress) {
    return { success: false, error: "Wallet not connected. Please connect your wallet to play." };
  }
  if (!ethers.isAddress(userAddress)) {
    return { success: false, error: "Invalid wallet address. Please reconnect your wallet." };
  }
  if (!betAmount || betAmount <= 0) {
    return { success: false, error: "Bet amount must be greater than zero." };
  }

  try {
    const client = await getWriteClient();
    const valueWei = ethers.parseUnits(betAmount.toString(), 18);

    const hash = await client.writeContract({
      address: LOOMII_CONTRACT_ADDRESS as `0x${string}`,
      functionName: 'play',
      args: [gameType, playerData],
      value: BigInt(valueWei.toString()),
    });

    console.log("✅ Wager sent via GenLayer play():", hash);
    if (onHash) onHash(hash);
    
    let receipt: unknown;
    try {
      // Wait for transaction to be ACCEPTED (consensus reached). StudioNet can take a while
      // to move from activated/proposed states, so use a wider polling window.
      receipt = await client.waitForTransactionReceipt({
        hash,
        status: TransactionStatus.ACCEPTED,
        interval: 5000,
        retries: 180,
      });
    } catch (waitError) {
      console.warn("Receipt wait timed out; fetching latest transaction state:", waitError);
      receipt = await client.getTransaction({ hash });
    }

    console.log("📦 Receipt received:", JSON.stringify(receipt, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2));
    
    // Check execution result
    if ((receipt as { txExecutionResultName?: unknown }).txExecutionResultName === ExecutionResult.FINISHED_WITH_ERROR) {
      return { success: false, hash, error: "Contract execution failed on-chain." };
    }

    const result = await extractReceiptResult(receipt, hash);

    if (result.status === 'ERROR') {
      return { success: false, hash, error: result.message || result.vibe || "Contract returned an error." };
    }

    return { success: true, hash, result };
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.error("❌ Loomii Engine Error:", message);
    return { success: false, error: message };
  }
};

/**
 * Owner (or anyone) funds the house reserve so payouts can be made.
 */
export const fundHouse = async (amount: string) => {
  const client = await getWriteClient();
  const valueWei = ethers.parseUnits(amount, 18);
  const hash = await client.writeContract({
    address: LOOMII_CONTRACT_ADDRESS as `0x${string}`,
    functionName: 'fund_house',
    args: [],
    value: BigInt(valueWei.toString()),
  });
  await client.waitForTransactionReceipt({ 
    hash,
    status: TransactionStatus.ACCEPTED,
  });
  return hash;
};

/**
 * Read-only stats fetch using the GenLayer SDK readContract.
 */
export const fetchStats = async () => {
  try {
    const client = getReadClient();
    const statsResult = await client.readContract({
      address: LOOMII_CONTRACT_ADDRESS as `0x${string}`,
      functionName: 'get_stats',
      args: [],
    });

    let stats: LoomiiStats;
    if (typeof statsResult === 'string') {
      stats = JSON.parse(statsResult);
    } else {
      stats = statsResult as LoomiiStats;
    }

    return {
      totalWagered: ethers.formatEther((stats.total_wagered ?? 0).toString()),
      totalPaid: ethers.formatEther((stats.total_paid ?? 0).toString()),
      houseReserve: ethers.formatEther((stats.house_reserve ?? 0).toString()),
      owner: (stats.owner ?? "0x0000000000000000000000000000000000000000").toLowerCase()
    };
  } catch (error) {
    console.error("Error fetching stats:", error);
    return {
      totalWagered: "0.0", totalPaid: "0.0", houseReserve: "0.0",
      owner: "0x0000000000000000000000000000000000000000"
    };
  }
};
