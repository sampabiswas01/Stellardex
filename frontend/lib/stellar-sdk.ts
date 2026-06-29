// Classic Stellar (Horizon) helpers for native XLM: balance, payment build, submit.
// All calls target Stellar TESTNET.
import {
  Horizon,
  TransactionBuilder,
  Operation,
  Asset,
  BASE_FEE,
} from "@stellar/stellar-sdk";
import {
  HORIZON_TESTNET_URL,
  STELLAR_TESTNET_PASSPHRASE,
} from "@/lib/stellar-wallet";

/** Shared Horizon server pointed at testnet. */
function getServer(): Horizon.Server {
  return new Horizon.Server(HORIZON_TESTNET_URL);
}

/**
 * Fetch the native (XLM) balance for an account from Horizon testnet.
 * Returns the raw balance string (e.g. "12.5000000").
 * If the account is not yet funded (HTTP 404) we resolve to "0".
 */
export async function fetchXlmBalance(address: string): Promise<string> {
  const server = getServer();
  try {
    const account = await server.loadAccount(address);
    const native = account.balances.find((b) => b.asset_type === "native");
    return native ? native.balance : "0";
  } catch (err: unknown) {
    // Horizon returns 404 for accounts that have never been funded.
    if (isNotFound(err)) {
      return "0";
    }
    throw new Error(`Failed to fetch balance: ${describeError(err)}`);
  }
}

/**
 * Build an unsigned native-XLM payment transaction and return its base64 XDR.
 * Loads the source account from Horizon, then builds a payment operation.
 */
export async function buildPaymentXdr(
  from: string,
  to: string,
  amount: string
): Promise<string> {
  const server = getServer();
  const account = await server.loadAccount(from);

  const transaction = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: STELLAR_TESTNET_PASSPHRASE,
  })
    .addOperation(
      Operation.payment({
        destination: to,
        asset: Asset.native(),
        amount,
      })
    )
    .setTimeout(30)
    .build();

  return transaction.toXDR();
}

/**
 * Submit a signed transaction XDR to Horizon testnet and return its hash.
 */
export async function submitSignedTx(
  signedXdr: string
): Promise<{ hash: string }> {
  const server = getServer();
  const transaction = TransactionBuilder.fromXDR(
    signedXdr,
    STELLAR_TESTNET_PASSPHRASE
  );

  try {
    const result = await server.submitTransaction(transaction);
    return { hash: result.hash };
  } catch (err: unknown) {
    throw new Error(describeError(err));
  }
}

/** True when an error looks like a Horizon 404 (account not found). */
function isNotFound(err: unknown): boolean {
  if (typeof err === "object" && err !== null) {
    const e = err as { response?: { status?: number } };
    return e.response?.status === 404;
  }
  return false;
}

/** Pull the most useful human-readable message out of a Horizon error. */
function describeError(err: unknown): string {
  if (typeof err === "object" && err !== null) {
    const e = err as {
      response?: {
        data?: {
          extras?: { result_codes?: unknown };
          detail?: string;
          title?: string;
        };
      };
      message?: string;
    };
    const extras = e.response?.data?.extras?.result_codes;
    if (extras) return JSON.stringify(extras);
    if (e.response?.data?.detail) return e.response.data.detail;
    if (e.response?.data?.title) return e.response.data.title;
    if (e.message) return e.message;
  }
  return String(err);
}
