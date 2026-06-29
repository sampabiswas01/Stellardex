import {
  Contract,
  Keypair,
  Networks,
  rpc as SorobanRpc,
  TransactionBuilder,
  BASE_FEE,
  xdr,
  scValToNative,
  nativeToScVal,
  Address,
} from "@stellar/stellar-sdk";

export const NETWORK = process.env.NEXT_PUBLIC_STELLAR_NETWORK || "testnet";
export const RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ||
  "https://soroban-testnet.stellar.org";
export const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL ||
  "https://horizon-testnet.stellar.org";
export const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ||
  Networks.TESTNET;

export const POOL_ID = process.env.NEXT_PUBLIC_POOL_CONTRACT_ID || "";
export const LP_TOKEN_ID = process.env.NEXT_PUBLIC_LP_TOKEN_CONTRACT_ID || "";
export const XLM_ID = process.env.NEXT_PUBLIC_XLM_CONTRACT_ID || "";
export const USDC_ID = process.env.NEXT_PUBLIC_USDC_CONTRACT_ID || "";

// Decimal constants
export const XLM_DECIMALS = 7; // stroops
export const USDC_DECIMALS = 6;
export const LP_DECIMALS = 7;

export function toStroops(amount: number, decimals: number): bigint {
  return BigInt(Math.round(amount * 10 ** decimals));
}

export function fromStroops(amount: bigint | string, decimals: number): number {
  return Number(amount) / 10 ** decimals;
}

export function formatAmount(amount: bigint | string, decimals: number, dp = 6): string {
  const n = fromStroops(amount, decimals);
  return n.toLocaleString("en-US", { maximumFractionDigits: dp });
}

export function getRpcClient(): SorobanRpc.Server {
  return new SorobanRpc.Server(RPC_URL, { allowHttp: false });
}

/**
 * Ensures the account exists on-chain, funding it via Friendbot if not.
 * Returns true when the account was newly created so callers can show a status.
 */
export async function ensureFunded(publicKey: string): Promise<boolean> {
  const server = getRpcClient();
  try {
    await server.getAccount(publicKey);
    return false; // already exists
  } catch {
    await server.requestAirdrop(publicKey);
    return true; // just funded
  }
}

/** Build a Soroban contract invocation transaction (unsigned). */
export async function buildContractTx(
  publicKey: string,
  contractId: string,
  method: string,
  args: xdr.ScVal[]
): Promise<string> {
  const server = getRpcClient();

  // On testnet, the wallet account may not exist yet — fund it via Friendbot automatically.
  let account;
  try {
    account = await server.getAccount(publicKey);
  } catch {
    account = await server.requestAirdrop(publicKey);
  }

  const contract = new Contract(contractId);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulation failed: ${sim.error}`);
  }
  if (SorobanRpc.Api.isSimulationRestore(sim)) {
    throw new Error(
      "Some contract ledger entries have expired and need to be restored before this swap can proceed. Please try again in a moment or contact support."
    );
  }
  const prepared = SorobanRpc.assembleTransaction(tx, sim).build();
  return prepared.toXDR();
}

export interface TxResult {
  status: "SUCCESS" | "FAILED";
  hash: string;
  error?: string;
}

/**
 * Call the Soroban RPC JSON-RPC endpoint directly.
 * We bypass TransactionBuilder.fromXDR / server.sendTransaction here because
 * stellar-base v12.x XDR types only cover Protocol 21, while the testnet runs
 * Protocol 26. Parsing a Protocol 26 signed transaction through stellar-base
 * throws "Bad union switch" on unknown union discriminants.
 * Using raw fetch sends the base64 XDR as-is, no SDK parsing needed.
 */
async function rpcCall(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`RPC ${method}: ${json.error.message ?? JSON.stringify(json.error)}`);
  return json.result as Record<string, unknown>;
}

/** Submit a signed XDR transaction and wait for confirmation. */
export async function submitTx(signedXdr: string): Promise<TxResult> {
  const sendResult = await rpcCall("sendTransaction", { transaction: signedXdr });

  const status = sendResult.status as string;
  if (status === "ERROR") {
    throw new Error(`Submission rejected: ${sendResult.errorResultXdr ?? "unknown"}`);
  }
  if (status === "TRY_AGAIN_LATER") {
    throw new Error("RPC is rate-limited. Please wait a moment and try again.");
  }

  const hash = sendResult.hash as string;

  // Poll for confirmation (max ~30 s)
  for (let attempts = 0; attempts < 30; attempts++) {
    await new Promise((r) => setTimeout(r, 1000));
    const result = await rpcCall("getTransaction", { hash });
    const txStatus = result.status as string;

    if (txStatus === "NOT_FOUND") continue;

    if (txStatus === "FAILED") {
      return {
        status: "FAILED",
        hash,
        error: `Transaction failed on-chain: ${result.resultXdr ?? "no details"}`,
      };
    }

    return { status: "SUCCESS", hash };
  }

  throw new Error("Transaction confirmation timed out. Check Stellar Explorer.");
}

/** Simulate and return the result of a read-only contract call. */
export async function simulateView(
  contractId: string,
  method: string,
  args: xdr.ScVal[]
): Promise<xdr.ScVal | null> {
  const server = getRpcClient();
  // Use a dummy keypair for read-only simulation
  const dummyKeypair = Keypair.random();
  const account = new SorobanRpc.Server(RPC_URL, { allowHttp: false });

  // Build with a generic fee payer
  const sourceAccount = await server.getAccount(dummyKeypair.publicKey()).catch(() => null);
  if (!sourceAccount) {
    // fall back: we can't simulate without a funded account; return null
    return null;
  }

  const contract = new Contract(contractId);
  const tx = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim) || !("result" in sim) || !sim.result) {
    return null;
  }
  return sim.result.retval;
}

/** Encode a Soroban Address ScVal from a string. */
export function addressArg(addr: string): xdr.ScVal {
  return nativeToScVal(Address.fromString(addr), { type: "address" });
}

/** Encode an i128 ScVal. */
export function i128Arg(n: bigint): xdr.ScVal {
  return nativeToScVal(n, { type: "i128" });
}
