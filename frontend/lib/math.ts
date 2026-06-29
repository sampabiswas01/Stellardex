/** Mirrors the on-chain constant-product formula (0.3% fee). */
export function getAmountOut(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint
): bigint {
  if (amountIn <= 0n || reserveIn <= 0n || reserveOut <= 0n) return 0n;
  const amountInWithFee = amountIn * 997n;
  const numerator = reserveOut * amountInWithFee;
  const denominator = reserveIn * 1000n + amountInWithFee;
  return numerator / denominator;
}

/** Price impact as a percentage (0–100). */
export function priceImpact(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint
): number {
  if (reserveIn <= 0n || reserveOut <= 0n || amountIn <= 0n) return 0;
  const idealOut = (amountIn * reserveOut) / reserveIn; // no-fee midpoint
  const actualOut = getAmountOut(amountIn, reserveIn, reserveOut);
  if (idealOut <= 0n) return 0;
  const impact = Number((idealOut - actualOut) * 10000n / idealOut) / 100;
  return Math.max(0, impact);
}

/** Minimum amount out after applying slippage tolerance (bps, e.g. 50 = 0.5%). */
export function minAmountOut(amountOut: bigint, slippageBps: number): bigint {
  return (amountOut * BigInt(10000 - slippageBps)) / 10000n;
}

/** Calculate LP shares for a deposit (mirrors on-chain logic). */
export function calcShares(
  xlmIn: bigint,
  usdcIn: bigint,
  reserveXlm: bigint,
  reserveUsdc: bigint,
  totalShares: bigint
): bigint {
  if (totalShares === 0n) {
    return bigIntSqrt(xlmIn * usdcIn);
  }
  const fromXlm = (xlmIn * totalShares) / reserveXlm;
  const fromUsdc = (usdcIn * totalShares) / reserveUsdc;
  return fromXlm < fromUsdc ? fromXlm : fromUsdc;
}

/** Integer square root (Babylonian method). */
function bigIntSqrt(n: bigint): bigint {
  if (n <= 0n) return 0n;
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
}

/** Spot price: how much token_out per 1 unit of token_in (no fee). */
export function spotPrice(reserveIn: bigint, reserveOut: bigint): number {
  if (reserveIn <= 0n) return 0;
  return Number(reserveOut) / Number(reserveIn);
}
