import { ethers } from 'ethers';
import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';

export const LOOMII_CONTRACT_ADDRESS = "0x33f2DAef61d792D1cFA2fE9635A873387e768775";
export const INITIAL_BALANCE = 1000000;

export const LOOMII_ABI_ETHERS = [
  "function get_stats() view returns (string)"
];

export const NETWORK_CONFIG = {
  chainId: '0xF22F',
  chainName: 'GenLayer StudioNet',
  nativeCurrency: { name: 'GEN', symbol: 'GEN', decimals: 18 },
  rpcUrls: ['https://studio.genlayer.com/api'],
  blockExplorerUrls: ['https://explorer-studio.genlayer.com/'],
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
    chain: studionet,
    account,
  });
}

/**
 * Place a wager via the new contract's `play` function.
 * The bet amount is sent as native GEN value, and the contract resolves
 * the outcome via the GenLayer Equivalence Principle (strict_eq).
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
    });

    console.log("✅ Wager sent via GenLayer play():", hash);
    if (onHash) onHash(hash);
    
    const receipt = await client.waitForTransactionReceipt({ hash });
    
    // In GenLayer, the return value is often in the receipt's result field
    // or can be fetched via getTransactionReceipt
    let result = { status: 'UNKNOWN', vibe: 'The oracle is silent.' };
    try {
      if (receipt.output) {
        // If the SDK provides output directly
        const decoded = typeof receipt.output === 'string' && receipt.output.startsWith('0x')
          ? ethers.toUtf8String(receipt.output)
          : receipt.output;
        result = JSON.parse(decoded);
      }
    } catch (e) {
      console.warn("Could not parse transaction output:", e);
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
  } catch {
    return {
      totalWagered: "0.0", totalPaid: "0.0", houseReserve: "0.0",
      owner: "0x0000000000000000000000000000000000000000"
    };
  }
};
