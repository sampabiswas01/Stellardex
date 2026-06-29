// Freighter wallet helpers — Stellar TESTNET only.
//
// NOTE: This project has @stellar/freighter-api@2.0.0 installed. In v2 the API
// exposes getPublicKey() (there is no getAddress()), and requestAccess() /
// signTransaction() resolve to plain strings. All functions below are written
// against that installed surface so the build stays type-clean.
import {
  isConnected,
  isAllowed,
  requestAccess,
  getPublicKey,
  signTransaction,
} from "@stellar/freighter-api";

/** Stellar TESTNET network passphrase. */
export const STELLAR_TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";

/** Horizon TESTNET base URL. */
export const HORIZON_TESTNET_URL = "https://horizon-testnet.stellar.org";

/** Freighter network identifier used by the v2 signing API. */
const FREIGHTER_NETWORK = "TESTNET";

/**
 * Detect whether the Freighter extension is installed / available.
 * Uses isConnected() from @stellar/freighter-api.
 */
export async function detectFreighter(): Promise<boolean> {
  try {
    return await isConnected();
  } catch {
    return false;
  }
}

/**
 * Request permission (if not already granted) and return the wallet G-address.
 * Uses isAllowed() + requestAccess() + getPublicKey().
 */
export async function connectWallet(): Promise<string> {
  // If the dApp is already authorised we can read the key directly.
  let allowed = false;
  try {
    allowed = await isAllowed();
  } catch {
    allowed = false;
  }

  if (!allowed) {
    // Prompts the user to approve the connection. In v2 this resolves to the key.
    const granted = await requestAccess();
    if (granted) return granted;
  }

  const address = await getPublicKey();
  if (!address) {
    throw new Error("Freighter did not return a wallet address.");
  }
  return address;
}

/**
 * Return the current wallet address without prompting, or null if not authorised.
 * Uses isAllowed() + getPublicKey().
 */
export async function getWalletAddress(): Promise<string | null> {
  try {
    const allowed = await isAllowed();
    if (!allowed) return null;
    const address = await getPublicKey();
    return address || null;
  } catch {
    return null;
  }
}

/**
 * Sign a base64 transaction XDR with Freighter, scoped to TESTNET.
 * Uses signTransaction() with the testnet passphrase. Returns the signed XDR.
 */
export async function signTx(xdr: string): Promise<string> {
  const signed = await signTransaction(xdr, {
    network: FREIGHTER_NETWORK,
    networkPassphrase: STELLAR_TESTNET_PASSPHRASE,
  });
  if (!signed) {
    throw new Error("Freighter returned an empty signed transaction.");
  }
  return signed;
}
