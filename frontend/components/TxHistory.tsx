"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useDexStore } from "@/lib/store";
import { getRpcClient, POOL_ID } from "@/lib/stellar";
import { scValToNative } from "@stellar/stellar-sdk";
import { RefreshCw, ExternalLink, ArrowLeftRight, Plus, Minus } from "lucide-react";

interface EventRow {
  id: string;
  type: string;
  ledger: number;
  txHash: string;
  summary: string;
}

function parseEventType(topics: string[]): string {
  const first = topics[0] ?? "";
  if (first.includes("deposit")) return "Deposit";
  if (first.includes("swap")) return "Swap";
  if (first.includes("withdraw")) return "Withdraw";
  return "Event";
}

type IconComponent = typeof ArrowLeftRight;

const TYPE_CONFIG: Record<
  string,
  { icon: IconComponent; color: string; bg: string; border: string }
> = {
  Swap: {
    icon: ArrowLeftRight,
    color: "text-blue-300",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
  },
  Deposit: {
    icon: Plus,
    color: "text-emerald-300",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
  },
  Withdraw: {
    icon: Minus,
    color: "text-red-300",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
  },
  Event: {
    icon: ArrowLeftRight,
    color: "text-gray-400",
    bg: "bg-white/[0.04]",
    border: "border-white/[0.07]",
  },
};

export default function TxHistory() {
  const { txStatus } = useDexStore();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(false);

  async function fetchEvents() {
    if (!POOL_ID) return;
    setLoading(true);
    try {
      const server = getRpcClient();
      const res = await server.getEvents({
        filters: [{ type: "contract", contractIds: [POOL_ID] }],
        limit: 20,
      });
      const rows: EventRow[] = (res.events ?? []).map((ev: any) => {
        const topics = (ev.topic ?? []).map((t: any) => {
          try {
            return String(scValToNative(t));
          } catch {
            return "?";
          }
        });
        return {
          id: ev.id,
          type: parseEventType(topics),
          ledger: ev.ledger,
          txHash: ev.txHash,
          summary: topics.slice(1).join(" → "),
        };
      });
      setEvents(rows.reverse());
    } catch {
      // RPC unavailable — silently skip
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (txStatus === "success") fetchEvents();
  }, [txStatus]);

  useEffect(() => {
    fetchEvents();
  }, []);

  return (
    <div className="w-full max-w-md mx-auto space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold text-white">Recent Activity</h3>
        <button
          onClick={fetchEvents}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-10 text-gray-600 text-sm">
          {loading ? "Fetching transactions…" : "No transactions yet"}
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((ev, i) => {
            const cfg = TYPE_CONFIG[ev.type] ?? TYPE_CONFIG.Event;
            const Icon = cfg.icon;
            return (
              <motion.a
                key={ev.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.04 }}
                href={`https://stellar.expert/explorer/testnet/tx/${ev.txHash}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/[0.07] bg-white/[0.025] hover:bg-white/[0.05] hover:border-white/[0.12] transition-all group"
              >
                <div
                  className={`w-8 h-8 rounded-lg ${cfg.bg} border ${cfg.border} flex items-center justify-center shrink-0`}
                >
                  <Icon size={14} className={cfg.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-medium ${cfg.color}`}>{ev.type}</span>
                    <span className="text-gray-600 text-xs">Ledger {ev.ledger}</span>
                  </div>
                  {ev.summary && (
                    <p className="text-gray-500 text-xs mt-0.5 truncate">{ev.summary}</p>
                  )}
                </div>
                <ExternalLink
                  size={13}
                  className="text-gray-600 group-hover:text-gray-400 transition shrink-0"
                />
              </motion.a>
            );
          })}
        </div>
      )}
    </div>
  );
}
