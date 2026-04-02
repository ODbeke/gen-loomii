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
    def wager(self, game_type: int, data: str) -> None:
        amount = gl.message.value
        assert amount > 0, "Bet amount must be greater than zero"
        self.total_wagered += amount
        self.house_reserve += amount

    @gl.public.write
    def resolve_game(self, player_address: Address, game_type: int, bet_amount: int, player_data: str) -> str:
        assert gl.message.sender_address == self.owner, "Only the contract owner can resolve games"

        input_data = f"""
        Game Context:
        - Player: {player_address.as_hex}
        - Game: {game_type} (0:Dice, 1:RPS, 2:Coin, 3:Mines)
        - Bet: {bet_amount} GEN
        - Choices: {player_data}
        """

        task = """
        Analyze the game data and determine if the player won. 
        Return ONLY a JSON object. No markdown, no explanation.
        Format: {"win": boolean, "vibe": "string"}
        """

        # Using prompt_non_comparative for AI Consensus
        raw_output = gl.eq_principle.prompt_non_comparative(
            lambda: input_data,
            task=task,
            criteria="The response must be a single valid JSON object with a boolean 'win' field.",
        )

        try:
            # Robust JSON extraction (Standard for GenLayer to avoid parsing errors)
            json_match = re.search(r'\{.*\}', raw_output, re.DOTALL)
            if not json_match:
                raise ValueError("No JSON found in oracle response")
            
            result_json = json.loads(json_match.group())
            is_win = result_json["win"]
            vibe = result_json.get("vibe", "The oracle has spoken.")

            if is_win:
                payout_amt = u256(bet_amount) * 2
                assert self.house_reserve >= payout_amt, "Insufficient house reserve"
                
                gl.transfer(player_address, payout_amt)
                self.total_paid += payout_amt
                self.house_reserve -= payout_amt
                return f"WIN: {vibe}"
            
            return f"LOSS: {vibe}"

        except Exception as e:
            return f"ERROR: Oracle parsing failed - {str(e)}"

    @gl.public.view
    def get_stats(self) -> str:
        return json.dumps({
            "total_wagered": int(self.total_wagered),
            "total_paid": int(self.total_paid),
            "house_reserve": int(self.house_reserve),
            "owner": self.owner.as_hex
        })
