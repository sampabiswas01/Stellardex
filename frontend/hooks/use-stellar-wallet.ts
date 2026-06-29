"use client";
// useWallet() — manages Freighter connection, XLM balance, and sending XLM on testnet.
import { useCallback, useEffect, useState } from "react";
import {
  detectFreighter,
  connectWallet,
  getWalletAddress,
  signTx,
} from "@/lib/stellar-wallet";
import {
  fetchXlmBalance,
  buildPaymentXdr,
  submitSignedTx,
} from "@/lib/stellar-sdk";

export interface UseWalletState {
  address: string | null;
  balance: string | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface UseWallet extends UseWalletState {
  hasFreighter: boolean | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshBalance: () => Promise<void>;
  sendXlm: (to: string, amount: string) => Promise<{ hash: string }>;
}

function toMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export function useWallet(): UseWallet {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFreighter, setHasFreighter] = useState<boolean | null>(null);

  // Detect extension + restore an already-authorised session on mount.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const detected = await detectFreighter();
        if (!active) return;
        setHasFreighter(detected);
        if (detected) {
          const existing = await getWalletAddress();
          if (active && existing) setAddress(existing);
        }
      } catch (err) {
        if (active) setHasFreighter(false);
        console.error("Freighter detection failed:", err);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const loadBalance = useCallback(async (addr: string) => {
    const bal = await fetchXlmBalance(addr);
    setBalance(bal);
  }, []);

  // Fetch the balance whenever the connected address changes.
  useEffect(() => {
    if (!address) {
      setBalance(null);
      return;
    }
    let active = true;
    (async () => {
      try {
        const bal = await fetchXlmBalance(address);
        if (active) setBalance(bal);
      } catch (err) {
        if (active) setError(toMessage(err));
      }
    })();
    return () => {
      active = false;
    };
  }, [address]);

  const connect = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const addr = await connectWallet();
      setAddress(addr);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    // Local state only — Freighter has no programmatic disconnect.
    setAddress(null);
    setBalance(null);
    setError(null);
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!address) return;
    setIsLoading(true);
    setError(null);
    try {
      await loadBalance(address);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [address, loadBalance]);

  const sendXlm = useCallback(
    async (to: string, amount: string): Promise<{ hash: string }> => {
      if (!address) throw new Error("Connect a wallet first.");
      setIsLoading(true);
      setError(null);
      try {
        const unsignedXdr = await buildPaymentXdr(address, to, amount);
        const signedXdr = await signTx(unsignedXdr);
        const result = await submitSignedTx(signedXdr);
        // Refresh balance after a successful send (non-blocking failure).
        try {
          await loadBalance(address);
        } catch {
          /* balance refresh is best-effort */
        }
        return result;
      } catch (err) {
        setError(toMessage(err));
        throw err instanceof Error ? err : new Error(toMessage(err));
      } finally {
        setIsLoading(false);
      }
    },
    [address, loadBalance]
  );

  return {
    address,
    balance,
    isConnected: address !== null,
    isLoading,
    error,
    hasFreighter,
    connect,
    disconnect,
    refreshBalance,
    sendXlm,
  };
}
