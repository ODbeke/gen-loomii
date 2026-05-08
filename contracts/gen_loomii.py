# v0.1.0
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
import re
from genlayer import *

class LoomiiAI(gl.Contract):
    owner: Address
    total_wagered: u256
    total_paid: u256
    house_reserve: u256

    def __init__(self) -> None:
        self.owner = gl.message.sender_address
        self.total_wagered = u256(0)
        self.total_paid = u256(0)
        self.house_reserve = u256(0)

    @gl.public.write
    def fund_house(self) -> None:
        # Allows the owner (or anyone) to fund the house to cover payouts
        self.house_reserve += gl.message.value

    def _evaluate_game(self, player_addr: str, game_type: int, amount: u256, player_data: str) -> str:
        input_data: str = f"""
        Game Context:
        - Player: {player_addr}
        - Game: {game_type} (0:Dice, 1:RPS, 2:Coin, 3:Mines)
        - Bet: {amount} GEN
        - Player Choices/Move: {player_data}
        """

        task: str = """
        Act as an impartial game server. Evaluate the player's choices against standard rules.
        Use the Player's address and choices to determine the opponent's move or outcome pseudo-randomly but deterministically.
        Return ONLY a valid JSON object. No markdown, no explanation.
        Format: {"win": boolean, "vibe": "string"}
        """
        return gl.nondet.exec_prompt(input_data + "\n" + task)

    @gl.public.write
    def play(self, game_type: int, player_data: str) -> str:
        amount: u256 = gl.message.value
        assert amount > u256(0), "Bet amount must be greater than zero"

        # Register wager immediately
        self.total_wagered += amount
        self.house_reserve += amount

        player_addr: str = gl.message.sender_address.as_hex

        # Execute under strict equivalence
        raw_output: str = gl.eq_principle.strict_eq(
            lambda: self._evaluate_game(player_addr, game_type, amount, player_data)
        )

        # Parse outcome and execute state changes
        try:
            # Robust JSON extraction
            json_match = re.search(r'\{.*\}', raw_output, re.DOTALL)
            if not json_match:
                return json.dumps({"status": "ERROR", "message": "No JSON found in oracle response"})
            
            result_json: dict = json.loads(json_match.group())
            is_win: bool = bool(result_json.get("win", False))
            vibe: str = str(result_json.get("vibe", "The oracle has spoken."))

            if is_win:
                payout_amt: u256 = amount * u256(2)
                assert self.house_reserve >= payout_amt, "Insufficient house reserve"
                
                gl.transfer(gl.message.sender_address, payout_amt)
                self.total_paid += payout_amt
                self.house_reserve -= payout_amt
                return json.dumps({"status": "WIN", "vibe": vibe})
            
            return json.dumps({"status": "LOSS", "vibe": vibe})

        except Exception as e:
            return json.dumps({"status": "ERROR", "message": f"Oracle parsing failed - {str(e)}"})

    @gl.public.view
    def get_stats(self) -> str:
        return json.dumps({
            "total_wagered": int(self.total_wagered),
            "total_paid": int(self.total_paid),
            "house_reserve": int(self.house_reserve),
            "owner": self.owner.as_hex
        })
