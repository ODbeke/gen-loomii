# v0.3.1
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import hashlib
import json
import typing
from genlayer import *

@gl.evm.contract_interface
class _Recipient:
    class View:
        pass

    class Write:
        pass

class LoomiiAI(gl.Contract):
    owner: Address
    total_wagered: u256
    total_paid: u256
    house_reserve: u256
    round_id: u256

    def __init__(self) -> None:
        self.owner = gl.message.sender_address
        self.total_wagered = u256(0)
        self.total_paid = u256(0)
        self.house_reserve = u256(0)
        self.round_id = u256(0)

    @gl.public.write.payable
    def fund_house(self) -> None:
        # Allows the owner (or anyone) to fund the house to cover payouts
        self.house_reserve += gl.message.value

    def _load_player_data(self, player_data: str) -> dict[str, typing.Any]:
        try:
            data = json.loads(player_data)
            assert isinstance(data, dict), "Player data must be a JSON object"
            return data
        except Exception:
            raise Exception("Invalid player data")

    def _roll(self, seed: str, modulo: int) -> int:
        digest = hashlib.sha256(seed.encode("utf-8")).hexdigest()
        return int(digest[:16], 16) % modulo

    def _mine_hit(self, seed: str, guess: int, num_mines: int) -> bool:
        mines: list[int] = []
        nonce = 0
        while len(mines) < num_mines:
            cell = self._roll(f"{seed}:mine:{nonce}", 25)
            if cell not in mines:
                mines.append(cell)
            nonce += 1
        return guess in mines

    def _resolve_game(
        self,
        player_addr: str,
        game_type: int,
        amount: u256,
        player_data: str,
        current_round_id: u256
    ) -> dict[str, typing.Any]:
        data = self._load_player_data(player_data)
        seed = f"{player_addr}:{game_type}:{int(amount)}:{player_data}:{int(current_round_id)}"

        if game_type == 0:
            target = int(data.get("target", 50))
            is_over = bool(data.get("isOver", True))
            assert 1 <= target <= 100, "Dice target must be between 1 and 100"
            roll = self._roll(seed, 100) + 1
            won = roll > target if is_over else roll < target
            outcome = f"roll={roll};prediction={'over' if is_over else 'under'};target={target}"
        elif game_type == 1:
            moves = ["rock", "paper", "scissors"]
            user_move = str(data.get("userMove", "")).lower()
            assert user_move in moves, "Invalid RPS move"
            oracle_move = moves[self._roll(seed, 3)]
            won = (
                (user_move == "rock" and oracle_move == "scissors") or
                (user_move == "paper" and oracle_move == "rock") or
                (user_move == "scissors" and oracle_move == "paper")
            )
            outcome = f"player={user_move};oracle={oracle_move}"
        elif game_type == 2:
            choice = str(data.get("choice", "")).lower()
            assert choice == "heads" or choice == "tails", "Invalid coin choice"
            landed = "heads" if self._roll(seed, 2) == 0 else "tails"
            won = choice == landed
            outcome = f"choice={choice};landed={landed}"
        elif game_type == 3:
            guess = int(data.get("guess", -1))
            num_mines = int(data.get("numMines", 5))
            assert 0 <= guess < 25, "Mine guess must be a grid cell"
            assert 1 <= num_mines <= 20, "Mine count must be between 1 and 20"
            hit_mine = self._mine_hit(seed, guess, num_mines)
            won = not hit_mine
            outcome = f"guess={guess};mines={num_mines};hit_mine={hit_mine}"
        else:
            raise Exception("Unsupported game type")

        return {
            "status": "WIN" if won else "LOSS",
            "win": won,
            "outcome": outcome,
            "round_id": int(current_round_id),
        }

    def _ai_resolution(
        self,
        player_addr: str,
        game_type: int,
        amount: u256,
        player_data: str,
        expected: dict[str, typing.Any]
    ) -> dict[str, typing.Any]:
        prompt = f"""
        You are Loomii's impartial GenLayer game adjudicator.

        The intelligent contract has already computed the deterministic on-chain game result.
        Do not change the winner or invent a new roll. Audit the result and return a short
        player-facing vibe for the resolved round.

        Player: {player_addr}
        Game type: {game_type} (0 Dice, 1 Rock-Paper-Scissors, 2 Coin Flip, 3 Mines)
        Wager in wei: {int(amount)}
        Player data JSON: {player_data}
        Deterministic result JSON: {json.dumps(expected, sort_keys=True)}

        Return JSON only with this exact shape:
        {{
          "status": "WIN" or "LOSS",
          "win": boolean,
          "outcome": "copy the deterministic outcome string",
          "vibe": "one concise sentence, no more than 140 characters"
        }}
        """

        def leader_fn() -> dict[str, typing.Any]:
            return gl.nondet.exec_prompt(prompt, response_format="json")

        def validator_fn(leaders_res: gl.vm.Result) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return False

            data = leaders_res.calldata
            if not isinstance(data, dict):
                return False

            vibe = data.get("vibe", "")
            return (
                data.get("status") == expected["status"] and
                data.get("win") == expected["win"] and
                data.get("outcome") == expected["outcome"] and
                isinstance(vibe, str) and
                0 < len(vibe) <= 180
            )

        return gl.vm.run_nondet_unsafe(leader_fn, validator_fn)

    @gl.public.write.payable
    def play(self, game_type: int, player_data: str) -> str:
        amount: u256 = gl.message.value
        assert amount > u256(0), "Bet amount must be greater than zero"
        player_addr: str = gl.message.sender_address.as_hex
        current_round_id: u256 = self.round_id

        expected = self._resolve_game(player_addr, game_type, amount, player_data, current_round_id)
        result = self._ai_resolution(player_addr, game_type, amount, player_data, expected)

        # Consensus has completed; deterministic state changes happen after the nondet block.
        self.round_id += u256(1)
        self.total_wagered += amount
        self.house_reserve += amount

        if result["win"]:
            payout_amt: u256 = amount * u256(2)
            assert self.house_reserve >= payout_amt, "Insufficient house reserve"

            _Recipient(gl.message.sender_address).emit_transfer(value=payout_amt)
            self.total_paid += payout_amt
            self.house_reserve -= payout_amt

        return json.dumps({
            "status": result["status"],
            "win": result["win"],
            "outcome": result["outcome"],
            "vibe": result["vibe"],
            "round_id": int(current_round_id),
        }, sort_keys=True)

    @gl.public.view
    def get_stats(self) -> str:
        return json.dumps({
            "total_wagered": int(self.total_wagered),
            "total_paid": int(self.total_paid),
            "house_reserve": int(self.house_reserve),
            "round_id": int(self.round_id),
            "owner": self.owner.as_hex
        }, sort_keys=True)
