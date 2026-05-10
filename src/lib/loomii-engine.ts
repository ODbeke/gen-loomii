import { ethers } from 'ethers';
import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';

export const LOOMII_CONTRACT_ADDRESS = "0xfbE9673c4fB05B8F3065277D3Cc628162C71696E";
export const INITIAL_BALANCE = 1000000;

export const LOOMII_ABI_ETHERS = [
  "function get_stats() view returns (string)"
];

export const NETWORK_CONFIG = {
  chainId: '0x107D', // 4221
  chainName: 'GenLayer Testnet Bradbury',
  nativeCurrency: { name: 'GEN', symbol: 'GEN', decimals: 18 },
  rpcUrls: ['https://rpc.testnet-chain.genlayer.com'],
  blockExplorerUrls: ['https://explorer.testnet.genlayer.com/'],
};

const bradbury = {
  id: 4221,
  name: 'GenLayer Testnet Bradbury',
  nativeCurrency: { name: 'GEN', symbol: 'GEN', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet-chain.genlayer.com'] },
    public: { http: ['https://rpc.testnet-chain.genlayer.com'] },
  },
  blockExplorers: {
    default: { name: 'GenLayer Explorer', url: 'https://explorer.testnet.genlayer.com' },
  },
};

/**
 * Lazily creates a GenLayer client. Called only when a write is needed.
 */
async function getGenLayerClient() {
  const ethereum = (window as any).ethereum;
  if (!ethereum) throw new Error("No wallet provider found. Please install MetaMask.");

  const accounts: string[] = await ethereum.request({ method: 'eth_accounts' });
  if (!accounts || accounts.length === 0) {
    throw new Error("No account connected. Please connect your wallet first.");
  }
  const account = accounts[0] as `0x${string}`;

  return createClient({
    chain: bradbury as any,
    account,
  });
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
 * Place a wager via the new contract's `play` function.
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
    const client = await getGenLayerClient();
    const value = ethers.parseUnits(betAmount.toString(), 18);

    const hash = await client.writeContract({
      address: LOOMII_CONTRACT_ADDRESS as `0x${string}`,
      functionName: 'play',
      args: [BigInt(gameType), playerData],
      value: BigInt(value.toString()),
      maxFeePerGas: 0n,
      maxPriorityFeePerGas: 0n,
    });

    console.log("✅ Wager sent via GenLayer play():", hash);
    if (onHash) onHash(hash);
    
    const receipt = await client.waitForTransactionReceipt({ hash });
    
    let result = { status: 'UNKNOWN', vibe: 'The oracle is silent.' };
    
    // Attempt to decode the output from the receipt
    // In GenLayer receipts, the output is typically the return value of the function
    if (receipt.output) {
      try {
        let decoded: string;
        if (typeof receipt.output === 'string') {
          if (receipt.output.startsWith('0x')) {
            decoded = ethers.toUtf8String(receipt.output);
          } else {
            decoded = receipt.output;
          }
        } else {
          decoded = JSON.stringify(receipt.output);
        }
        
        // Contract returns a JSON string, so we parse it
        result = JSON.parse(decoded);
      } catch (e) {
        console.warn("Could not parse transaction output:", e, receipt.output);
        // Fallback: If it's a win, the house reserve or total paid would change, 
        // but we'll stick to a default vibe if parsing fails.
      }
    }

    return { success: true, hash, result };
  } catch (error: any) {
    console.error("❌ Loomii Engine Error:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Owner (or anyone) funds the house reserve so payouts can be made.
 */
export const fundHouse = async (amount: string) => {
  const client = await getGenLayerClient();
  const value = ethers.parseUnits(amount, 18);
  const hash = await client.writeContract({
    address: LOOMII_CONTRACT_ADDRESS as `0x${string}`,
    functionName: 'fund_house',
    args: [],
    value: BigInt(value.toString()),
    maxFeePerGas: 0n,
    maxPriorityFeePerGas: 0n,
  });
  await client.waitForTransactionReceipt({ hash });
  return hash;
};

/**
 * Read-only stats fetch via ethers.js JsonRpcProvider.
 */
export const fetchStats = async () => {
  try {
    const provider = new ethers.JsonRpcProvider(NETWORK_CONFIG.rpcUrls[0]);
    const contract = new ethers.Contract(LOOMII_CONTRACT_ADDRESS, LOOMII_ABI_ETHERS, provider);
    const statsResult = await contract.get_stats();
    const statsStr = typeof statsResult === 'string' && statsResult.startsWith('0x')
      ? ethers.toUtf8String(statsResult) : statsResult;
    const stats = JSON.parse(statsStr);
    return {
      totalWagered: ethers.formatEther(stats.total_wagered.toString()),
      totalPaid: ethers.formatEther(stats.total_paid.toString()),
      houseReserve: ethers.formatEther(stats.house_reserve.toString()),
      owner: stats.owner.toLowerCase()
    };
  } catch (error) {
    console.error("Error fetching stats:", error);
    return {
      totalWagered: "0.0", totalPaid: "0.0", houseReserve: "0.0",
      owner: "0x0000000000000000000000000000000000000000"
    };
  }
};
