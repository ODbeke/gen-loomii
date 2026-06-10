import { describe, expect, it } from "vitest";
import { extractStudioReceiptResult } from "./loomii-engine";

describe("extractStudioReceiptResult", () => {
  it("reads the contract return value from Studio leader receipts", () => {
    const receipt = {
      data: {
        calldata: {
          readable: "{\"args\":[2,\"{\\\"choice\\\":\\\"tails\\\",\\\"bet\\\":10}\",]\"method\":\"play\"}",
        },
      },
      consensus_data: {
        leader_receipt: [
          {
            result: {
              status: "return",
              payload: {
                readable:
                  "\"{\\\"outcome\\\": \\\"choice=tails;landed=tails\\\", \\\"round_id\\\": 0, \\\"status\\\": \\\"WIN\\\", \\\"vibe\\\": \\\"Coin landed on tails\\\\u2014your call was spot on!\\\", \\\"win\\\": true}\"",
              },
            },
          },
        ],
      },
    };

    expect(extractStudioReceiptResult(receipt)).toEqual({
      outcome: "choice=tails;landed=tails",
      round_id: 0,
      status: "WIN",
      vibe: "Coin landed on tails—your call was spot on!",
      win: true,
    });
  });
});
