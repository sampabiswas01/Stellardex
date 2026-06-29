import { scValToNative, xdr } from "@stellar/stellar-sdk";
import {
  POOL_ID,
  LP_TOKEN_ID,
  XLM_ID,
  USDC_ID,
  addressArg,
  i128Arg,
  buildContractTx,
  getRpcClient,
} from "./stellar";
import { Contract, TransactionBuilder, BASE_FEE, Networks, rpc as SorobanRpc, Keypair } from "@stellar/stellar-sdk";

// ── Read-only views ──────────────────────────────────────────────────────────

export async function getReserves(): Promise<{ xlm: bigint; usdc: bigint }> {
  const server = getRpcClient();
  // Use a funded account for simulation — in practice use any funded testnet account
  const simulatorKey = process.env.NEXT_PUBLIC_SIMULATOR_KEY;
  if (!simulatorKey) return { xlm: 0n, usdc: 0n };

  const account = await server.getAccount(simulatorKey).catch(() => null);
  if (!account) return { xlm: 0n, usdc: 0n };

  const contract = new Contract(POOL_ID);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE || Networks.TESTNET,
  })
    .addOperation(contract.call("get_reserves"))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim) || !("result" in sim) || !sim.result) {
    return { xlm: 0n, usdc: 0n };
  }

  const val = scValToNative(sim.result.retval) as [string, string];
  return { xlm: BigInt(val[0]), usdc: BigInt(val[1]) };
}

export async function getPrice(
  tokenIn: "xlm" | "usdc",
  amountIn: bigint,
  publicKey: string
): Promise<bigint> {
  const server = getRpcClient();
  const account = await server.getAccount(publicKey).catch(() => null);
  if (!account || amountIn <= 0n) return 0n;

  const tokenAddr = tokenIn === "xlm" ? XLM_ID : USDC_ID;
  const contract = new Contract(POOL_ID);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE || Networks.TESTNET,
  })
    .addOperation(contract.call("get_price", addressArg(tokenAddr), i128Arg(amountIn)))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim) || !("result" in sim) || !sim.result) return 0n;
  return BigInt(scValToNative(sim.result.retval) as string);
}

export async function getLpBalance(walletAddress: string): Promise<bigint> {
  const server = getRpcClient();
  const account = await server.getAccount(walletAddress).catch(() => null);
  if (!account) return 0n;

  const contract = new Contract(LP_TOKEN_ID);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE || Networks.TESTNET,
  })
    .addOperation(contract.call("balance", addressArg(walletAddress)))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim) || !("result" in sim) || !sim.result) return 0n;
  return BigInt(scValToNative(sim.result.retval) as string);
}

/**
 * Get the user's Circle USDC balance via Horizon.
 * Circle testnet USDC is a classic Stellar asset, so Horizon's /accounts
 * endpoint is the most reliable source — it's what Freighter reads too.
 */
export async function getUsdcBalance(walletAddress: string): Promise<bigint> {
  try {
    const HORIZON = process.env.NEXT_PUBLIC_HORIZON_URL || "https://horizon-testnet.stellar.org";
    const res = await fetch(`${HORIZON}/accounts/${walletAddress}`);
    if (!res.ok) return 0n;
    const data = await res.json();
    const usdcEntry = (data.balances as Array<{ asset_type: string; asset_code?: string; asset_issuer?: string; balance: string }>)
      ?.find(
        (b) =>
          b.asset_code === "USDC" &&
          b.asset_issuer === "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
      );
    if (!usdcEntry) return 0n;
    // USDC has 6 decimal places in Stellar (not stroops)
    const [intPart, decPart = ""] = usdcEntry.balance.split(".");
    const micro = decPart.padEnd(6, "0").slice(0, 6);
    return BigInt(intPart) * 1_000_000n + BigInt(micro);
  } catch {
    return 0n;
  }
}

export async function getLpTotalSupply(publicKey: string): Promise<bigint> {
  const server = getRpcClient();
  const account = await server.getAccount(publicKey).catch(() => null);
  if (!account) return 0n;

  const contract = new Contract(LP_TOKEN_ID);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE || Networks.TESTNET,
  })
    .addOperation(contract.call("total_supply"))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim) || !("result" in sim) || !sim.result) return 0n;
  return BigInt(scValToNative(sim.result.retval) as string);
}

/**
 * Fetch the user's native XLM balance via Horizon.
 * Returns balance in stroops (7 decimal places).
 * Uses Horizon (not the XLM SAC) because it's the only way to read native
 * balances without going through stellar-base XDR parsing.
 */
export async function getXlmBalance(walletAddress: string): Promise<bigint> {
  try {
    const HORIZON = process.env.NEXT_PUBLIC_HORIZON_URL || "https://horizon-testnet.stellar.org";
    const res = await fetch(`${HORIZON}/accounts/${walletAddress}`);
    if (!res.ok) return 0n;
    const data = await res.json();
    const native = (data.balances as Array<{ asset_type: string; balance: string }>)
      ?.find((b) => b.asset_type === "native");
    if (!native) return 0n;
    // Horizon returns balance as "1234.5678900" — convert to stroops
    const [intPart, decPart = ""] = native.balance.split(".");
    const stroops = decPart.padEnd(7, "0").slice(0, 7);
    return BigInt(intPart) * 10_000_000n + BigInt(stroops);
  } catch {
    return 0n;
  }
}

// ── Transaction builders (return unsigned XDR for Freighter to sign) ─────────

export async function buildSwapTx(
  walletAddress: string,
  tokenIn: "xlm" | "usdc",
  amountIn: bigint,
  minOut: bigint
): Promise<string> {
  const tokenInAddr = tokenIn === "xlm" ? XLM_ID : USDC_ID;
  return buildContractTx(walletAddress, POOL_ID, "swap", [
    addressArg(walletAddress),
    addressArg(tokenInAddr),
    i128Arg(amountIn),
    i128Arg(minOut),
  ]);
}

export async function buildDepositTx(
  walletAddress: string,
  xlmDesired: bigint,
  usdcDesired: bigint,
  xlmMin: bigint,
  usdcMin: bigint
): Promise<string> {
  return buildContractTx(walletAddress, POOL_ID, "deposit", [
    addressArg(walletAddress),
    i128Arg(xlmDesired),
    i128Arg(usdcDesired),
    i128Arg(xlmMin),
    i128Arg(usdcMin),
  ]);
}

export async function buildWithdrawTx(
  walletAddress: string,
  lpShares: bigint,
  minXlm: bigint,
  minUsdc: bigint
): Promise<string> {
  return buildContractTx(walletAddress, POOL_ID, "withdraw", [
    addressArg(walletAddress),
    i128Arg(lpShares),
    i128Arg(minXlm),
    i128Arg(minUsdc),
  ]);
}
