import { ethers } from 'ethers';
import { createClient } from 'genlayer-js';
import { testnetBradbury } from 'genlayer-js/chains';

export const LOOMII_CONTRACT_ADDRESS = "0x929D3a62b12F1483f9E75005EE6e9AB0016e7Feb";
export const INITIAL_BALANCE = 1000000;

export const LOOMII_ABI = [
  {
    inputs: [
      { internalType: "uint256", name: "gameType", type: "uint256" },
      { internalType: "string", name: "data", type: "string" }
    ],
    name: "wager",
    outputs: [],
    stateMutability: "payable",
    type: "function"
  },
  {
    inputs: [
      { internalType: "address", name: "player_address", type: "address" },
      { internalType: "uint256", name: "game_type", type: "uint256" },
      { internalType: "uint256", name: "bet_amount", type: "uint256" },
      { internalType: "string", name: "player_data", type: "string" }
    ],
    name: "resolve_game",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [],
    name: "get_stats",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function"
  }
];

export const NETWORK_CONFIG = {
  chainId: '0xF22F',
  chainName: 'GenLayer StudioNet',
  nativeCurrency: { name: 'GEN', symbol: 'GEN', decimals: 18 },
  rpcUrls: ['https://studio.genlayer.com/api'],
  blockExplorerUrls: ['https://studio.genlayer.com/'],
};

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
    const client = createClient({
      chain: testnetBradbury,
      provider: (window as any).ethereum
    });

    const hash = await client.writeContract({
      address: LOOMII_CONTRACT_ADDRESS as `0x${string}`,
      functionName: 'wager',
      args: [BigInt(gameType), move],
      value: 0n
    });

    await client.waitForTransactionReceipt({ hash });
    return { success: true, hash };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};
