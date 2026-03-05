import "dotenv/config";
import WebSocket from "ws";
import axios from "axios";

interface Trade {
  coin: string;
  side: "B" | "A";
  px: string;
  sz: string;
  time: number;
  hash: string;
}

interface WsMessage {
  channel: string;
  data: Trade[];
}

const HL_REST = `${process.env.CHAINSTACK_URL!.replace(/\/+$/, "")}/info`;
const HL_WS = "wss://api.hyperliquid.xyz/ws";
const MIN_NOTIONAL = Number(process.env.MIN_NOTIONAL) || 10_000;

async function fetchAllCoins(): Promise<string[]> {
  const { data } = await axios.post(HL_REST, { type: "meta" });
  return data.universe.map((c: { name: string }) => c.name);
}

function formatUSD(n: number): string {
  return (
    "$" +
    n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function formatNum(n: number, dec = 4): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}

function logTrade(trade: Trade): void {
  const side = trade.side === "B" ? "LONG  🟢" : "SHORT 🔴";
  const price = Number(trade.px);
  const size = Number(trade.sz);
  const notional = price * size;
  const ts = new Date(trade.time).toISOString().replace("T", " ").slice(0, 23);

  console.log("─".repeat(55));
  console.log(`  ${side}  │  ${trade.coin}`);
  console.log(`  Time     : ${ts}`);
  console.log(`  Price    : ${formatUSD(price)}`);
  console.log(`  Size     : ${formatNum(size)} ${trade.coin}`);
  console.log(`  Notional : ${formatUSD(notional)}`);
  console.log(`  Tx Hash  : ${trade.hash}`);
  console.log("─".repeat(55));
}

async function main(): Promise<void> {
  console.log(`Endpoint    : ${HL_REST}`);
  console.log(`Min notional: ${formatUSD(MIN_NOTIONAL)}\n`);

  const coins = await fetchAllCoins();
  console.log(`Tracking ${coins.length} perp markets...\n`);

  const ws = new WebSocket(HL_WS);

  ws.on("open", () => {
    for (const coin of coins) {
      ws.send(
        JSON.stringify({
          method: "subscribe",
          subscription: { type: "trades", coin },
        }),
      );
    }
    console.log(
      `Subscribed. Waiting for trades > ${formatUSD(MIN_NOTIONAL)}...\n`,
    );
  });

  ws.on("message", (raw: WebSocket.RawData) => {
    let msg: WsMessage;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.channel !== "trades" || !Array.isArray(msg.data)) return;

    for (const trade of msg.data) {
      const notional = Number(trade.px) * Number(trade.sz);
      if (notional >= MIN_NOTIONAL) logTrade(trade);
    }
  });

  ws.on("error", (err: Error) =>
    console.error("WebSocket error:", err.message),
  );

  ws.on("close", (code: number, reason: Buffer) => {
    console.warn(
      `WebSocket closed (${code}): ${reason}. Reconnecting in 5s...`,
    );
    setTimeout(main, 5000);
  });
}

main().catch(console.error);
