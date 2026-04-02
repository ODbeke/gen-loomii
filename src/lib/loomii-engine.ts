import { ethers } from 'ethers';

export const LOOMII_CONTRACT_ADDRESS = "0x929D3a62b12F1483f9E75005EE6e9AB0016e7Feb";
export const INITIAL_BALANCE = 1000000;

export const LOOMII_ABI = [
  "function wager(uint256 gameType, string data) payable",
  "function resolve_game(address player_address, uint256 game_type, uint256 bet_amount, string player_data) returns (string)",
  "function get_stats() view returns (string)",
  "function withdraw(uint256 amount)",
  "function emergency_drain()"
];

export const NETWORK_CONFIG = {
  chainId: '0xF22F',
  chainName: 'GenLayer StudioNet',
  nativeCurrency: { name: 'GEN', symbol: 'GEN', decimals: 18 },
  rpcUrls: ['https://studio.genlayer.com/api'],
  blockExplorerUrls: ['https://studio.genlayer.com/'],
};

async function getSigner() {
  if (!(window as any).ethereum) throw new Error("No wallet found");
  const provider = new ethers.BrowserProvider((window as any).ethereum);
  return provider.getSigner();
}

export async function getContract(needsSigner = false) {
  if (needsSigner) {
    const signer = await getSigner();
    return new ethers.Contract(LOOMII_CONTRACT_ADDRESS, LOOMII_ABI, signer);
  }
  const provider = new ethers.JsonRpcProvider(NETWORK_CONFIG.rpcUrls[0]);
  return new ethers.Contract(LOOMII_CONTRACT_ADDRESS, LOOMII_ABI, provider);
}

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
    const contract = await getContract(true);
    const tx = await contract.wager(BigInt(gameType), move, { value: 0n });
    const receipt = await tx.wait();
    return { success: true, hash: receipt.hash };
  } catch (error: any) {
    console.error("❌ Loomii Engine Error:", error.message);
    return { success: false, error: error.message };
  }
};

export const resolveGame = async (playerAddress: string, gameType: number, betAmount: number, playerData: string) => {
  const contract = await getContract(true);
  const validAddr = ethers.getAddress(playerAddress);
  const betAmountBigInt = ethers.parseUnits(betAmount.toString(), 18);
  const tx = await contract.resolve_game(validAddr, BigInt(gameType), betAmountBigInt, playerData);
  const receipt = await tx.wait();
  return receipt.hash;
};

export const withdrawFunds = async (amount: string) => {
  const contract = await getContract(true);
  const tx = await contract.withdraw(ethers.parseUnits(amount, 18));
  await tx.wait();
};

export const emergencyDrain = async () => {
  const contract = await getContract(true);
  const tx = await contract.emergency_drain();
  await tx.wait();
};

export const fetchStats = async () => {
  try {
    const contract = await getContract(false);
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
