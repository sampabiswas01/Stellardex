"use client";
import { create } from "zustand";
import { getReserves, getLpBalance, getLpTotalSupply, getUsdcBalance, getXlmBalance } from "./contracts";
import { XLM_DECIMALS, USDC_DECIMALS } from "./stellar";

export type TxStatus = "idle" | "funding" | "building" | "signing" | "submitting" | "success" | "error";

interface TxRecord {
  hash: string;
  type: "swap" | "deposit" | "withdraw";
  timestamp: number;
  amountIn?: string;
  amountOut?: string;
}

interface DexStore {
  // Wallet
  walletAddress: string | null;
  setWalletAddress: (addr: string | null) => void;

  // Pool state
  reserveXlm: bigint;
  reserveUsdc: bigint;
  lpBalance: bigint;
  lpTotalSupply: bigint;
  xlmBalance: bigint;    // user's native XLM balance (via Horizon, in stroops)
  usdcBalance: bigint;   // user's mock-USDC balance in the pool token contract
  reservesLoading: boolean;
  refreshReserves: () => Promise<void>;

  // Transaction status
  txStatus: TxStatus;
  txHash: string | null;
  txError: string | null;
  setTxStatus: (status: TxStatus, hash?: string, error?: string) => void;

  // Recent transactions
  txHistory: TxRecord[];
  addTx: (tx: TxRecord) => void;
}

export const useDexStore = create<DexStore>((set, get) => ({
  walletAddress: null,
  setWalletAddress: (addr) => {
    set({ walletAddress: addr });
    if (addr) get().refreshReserves();
  },

  reserveXlm: 0n,
  reserveUsdc: 0n,
  lpBalance: 0n,
  lpTotalSupply: 0n,
  xlmBalance: 0n,
  usdcBalance: 0n,
  reservesLoading: false,

  refreshReserves: async () => {
    set({ reservesLoading: true });
    try {
      const { xlm, usdc } = await getReserves();
      const addr = get().walletAddress;
      const lpBal = addr ? await getLpBalance(addr) : 0n;
      const lpSupply = addr ? await getLpTotalSupply(addr) : 0n;
      const usdcBal = addr ? await getUsdcBalance(addr) : 0n;
      const xlmBal = addr ? await getXlmBalance(addr) : 0n;
      set({ reserveXlm: xlm, reserveUsdc: usdc, lpBalance: lpBal, lpTotalSupply: lpSupply, usdcBalance: usdcBal, xlmBalance: xlmBal });
    } catch {
      // silently fail — UI shows stale data
    } finally {
      set({ reservesLoading: false });
    }
  },

  txStatus: "idle",
  txHash: null,
  txError: null,
  setTxStatus: (status, hash, error) =>
    set({ txStatus: status, txHash: hash ?? null, txError: error ?? null }),

  txHistory: [],
  addTx: (tx) =>
    set((s) => ({ txHistory: [tx, ...s.txHistory].slice(0, 20) })),
}));
