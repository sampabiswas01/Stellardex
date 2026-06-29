export default function PriceImpact({ impact }: { impact: number }) {
  const color =
    impact < 1
      ? "text-emerald-400"
      : impact < 5
      ? "text-amber-400"
      : "text-red-400";

  return (
    <span className={`text-xs font-medium tabular-nums ${color}`}>
      {impact < 0.01 ? "<0.01" : impact.toFixed(2)}%
    </span>
  );
}
