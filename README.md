<div align="center">
  <h1>Loomii</h1>
  <p><b>AI-Governed Decentralized Gaming</b></p>
  <img src="https://img.shields.io/badge/Powered%20by-GenLayer-blueviolet" />
</div>

---






**[Loomii](https://gen-loomii.lovable.app/)** is a decentralized, AI-powered gaming platform built on **GenLayer StudioNet**. 

It leverages GenLayer's **Intelligent Contracts** to bring a new level of fairness and unpredictability to Web3 gaming.


Loomii transforms traditional casino-style games into Intelligent Games. Instead of simple random number generators (RNG), Loomii uses GenLayer's **Equivalence Principle (AI Consensus)** to resolve game outcomes. This allows for complex, context-aware resolutions and unique vibes for every win or loss.

______

## 🎮 Featured Games

- **Dice:** A high-stakes roll against the AI oracle.
- **Rock-Paper-Scissors (RPS):** Classic strategy resolved by intelligent consensus.
- **Coin Flip:** A simple 50/50, but with the oracle's cryptic commentary.
- **Mines:** A strategic grid game where you avoid the hidden traps.

  <img width="2768" height="572" alt="image" src="https://github.com/user-attachments/assets/58f2b6a8-2137-43f7-bb36-44600d5b554b" />


______

## Key Features

- **Intelligent Contracts:** Powered by Python-based GenLayer contracts (`loomii_contract.py`).
- **AI Oracle Resolution:** Outcomes are determined by AI consensus, ensuring fairness and adding a layer of "personality" to the game engine.
- **Gasless Experience:** Optimized for the gasless testing environment of **GenLayer StudioNet**.
- **Real-time Statistics:** Track House Reserve, Total Wagered, and Total Paid directly from the smart contract.
- **Deterministic Payouts:** Secure, on-chain payouts executed automatically by the contract logic.
- **Brutalist UI:** A high-performance, dark-themed interface designed for precision and speed.


_____

## 🛠️ Tech Stack

- **Frontend:** React 19, Vite, Tailwind CSS 4, Framer Motion, Lucide React.
- **Blockchain:** 
  - `ethers.js`: For interacting with GenLayer Intelligent Contracts via standard Ethereum providers.
  - `genlayer-js`: A cutting-edge integration that brings **Intelligent Contracts** to life.
- **Smart Contract:** Python (GenLayer Intelligent Contract framework).


_____

## 📜 Smart Contract (`loomii_contract.py`)

The core logic resides in a GenLayer Intelligent Contract:
- `wager(game_type, data)`: Accepts wagers in **GEN** tokens.
- `resolve_game(player_address, game_type, bet_amount, player_data)`: The AI-driven resolution engine that uses the Equivalence Principle to determine winners.
- `get_stats()`: Returns real-time contract metrics.


_____

## ⚠️ Deployment & Testing Note: StudioNet vs. Bradbury

Network Transition
This project was originally architected for GenLayer Bradbury. However, due to the migration to GenLayer StudioNet, certain transaction behaviors have been adjusted:

Gasless Transactions: StudioNet currently supports gasless testing. Unlike the original Bradbury specification which required a non-zero stake for state transitions, StudioNet allows for logic execution without a mandatory amount in some contexts.

The Zero-Bet Traceback: You may encounter an AssertionError: Bet amount must be greater than zero if the frontend defaults to 0. While StudioNet is gasless, the Smart Contract Logic still enforces a > 0 bet to maintain the integrity of the game's Wager/Payout economic model.

Why the Assertion Remains
Even though the network is currently gasless, we have kept the assert amount > 0 check in loomii_contract.py (Line 23) because:

Economic Integrity: A gambling/gaming contract requires a stake to calculate a proportional payout.

Future Proofing: Ensuring the code remains compatible with the Bradbury economic model once value-based transactions are re-enabled.


_____

## Prerequisites
- Node.js (v18+)
- MetaMask
- GenLayer Account (StudioNet)

_____

### GenLayer StudioNet Configuration
| | |
| :--- | :--- |
| **Network Name** | GenLayer StudioNet |
| **RPC URL** | `https://studio.genlayer.com/api` |
| **Chain ID** | `61999` |
| **Currency Symbol** | `GEN` |






___

## 🚧 Project Status

- **Main Games:** Fully Functional on StudioNet.
- **Bridge:** Currently **Under Construction 🛠️** (Upgrading for enhanced cross-chain support).
_____
_____

*Built for the **GenLayer Testnet Bradbury Hackaton**.*
