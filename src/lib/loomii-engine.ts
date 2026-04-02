import { ethers } from 'ethers';
import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';

export const LOOMII_CONTRACT_ADDRESS = "0x929D3a62b12F1483f9E75005EE6e9AB0016e7Feb";
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
 * Lazily creates a GenLayer client. Called only when a write is needed,
 * avoiding the viem getAddress() crash at module load time.
 */
async function getGenLayerClient() {
  const ethereum = (window as any).ethereum;
  if (!ethereum) throw new Error("No wallet provider found. Please install MetaMask.");
  
  // Get the connected account from the provider to satisfy genlayer-js
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
 * Wager via genlayer-js writeContract so it's indexed as a Call transaction
 * with GenVM/consensus data on StudioNet.
 */
export const playLoomii = async (gameType: number, move: string, userAddress: string | null | undefined) => {
  if (!userAddress) {
    return { success: false, error: "Wallet not connected. Please connect your wallet to play." };
  }

  const addrStr = String(userAddress).toLowerCase();
  if (addrStr === 'undefined' || addrStr === 'null' || addrStr === '' || !addrStr.startsWith('0x')) {
    return { success: false, error: "Invalid wallet connection. Please reconnect your wallet." };
  }

  if (!ethers.isAddress(userAddress)) {
    return { success: false, error: "Invalid wallet address format. Please reconnect your wallet." };
  }

  try {
    const client = await getGenLayerClient();

    const hash = await client.writeContract({
      address: LOOMII_CONTRACT_ADDRESS as `0x${string}`,
      functionName: 'wager',
      args: [BigInt(gameType), move],
      value: 0n,
    });

    console.log("✅ Wager sent via GenLayer writeContract:", hash);
    await client.waitForTransactionReceipt({ hash });

    return { success: true, hash };
  } catch (error: any) {
    console.error("❌ Loomii Engine Error:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Resolve a pending wager via genlayer-js writeContract so GenVM indexes it.
 */
export const resolveGame = async (playerAddress: string, gameType: number, betAmount: number, playerData: string) => {
  const client = await getGenLayerClient();
  const validAddr = ethers.getAddress(playerAddress);
  const betAmountBigInt = ethers.parseUnits(betAmount.toString(), 18);

  const hash = await client.writeContract({
    address: LOOMII_CONTRACT_ADDRESS as `0x${string}`,
    functionName: 'resolve_game',
    args: [validAddr as `0x${string}`, BigInt(gameType), betAmountBigInt, playerData],
    value: 0n,
  });

  await client.waitForTransactionReceipt({ hash });
  return hash;
};

/**
 * Owner withdrawal via genlayer-js writeContract.
 */
export const withdrawFunds = async (amount: string) => {
  const client = await getGenLayerClient();
  const hash = await client.writeContract({
    address: LOOMII_CONTRACT_ADDRESS as `0x${string}`,
    functionName: 'withdraw',
    args: [ethers.parseUnits(amount, 18)],
    value: 0n,
  });
  await client.waitForTransactionReceipt({ hash });
};

/**
 * Emergency drain via genlayer-js writeContract.
 */
export const emergencyDrain = async () => {
  const client = await getGenLayerClient();
  const hash = await client.writeContract({
    address: LOOMII_CONTRACT_ADDRESS as `0x${string}`,
    functionName: 'emergency_drain',
    args: [],
    value: 0n,
  });
  await client.waitForTransactionReceipt({ hash });
};

/**
 * Read-only stats fetch via ethers.js JsonRpcProvider (no signer needed).
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
