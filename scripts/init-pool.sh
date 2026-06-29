#!/usr/bin/env bash
# Add seed liquidity to the pool using real Circle testnet USDC.
# Run AFTER deploy.sh. The deployer must have:
#   - Native XLM  (funded via: stellar keys fund deployer --network testnet)
#   - Circle testnet USDC (get from https://faucet.circle.com or via Stellar testnet anchor)
#
# If the deployer has no USDC, skip this script and add liquidity via the UI
# with a wallet that already holds Circle testnet USDC.

set -euo pipefail

NETWORK="testnet"
IDENTITY="deployer"

# Load contract IDs written by deploy.sh
source ../frontend/.env.local 2>/dev/null || { echo "Run deploy.sh first"; exit 1; }

POOL_ID="$NEXT_PUBLIC_POOL_CONTRACT_ID"
USDC_SAC_ID="$NEXT_PUBLIC_USDC_CONTRACT_ID"
DEPLOYER_ADDRESS=$(stellar keys address "$IDENTITY")

echo "Pool:    $POOL_ID"
echo "USDC:    $USDC_SAC_ID  (Circle testnet USDC)"
echo "Signer:  $DEPLOYER_ADDRESS"

# Check deployer has enough USDC (Horizon check)
DEPLOYER_USDC=$(curl -s "https://horizon-testnet.stellar.org/accounts/$DEPLOYER_ADDRESS" \
  | python3 -c "import sys,json; \
    acct=json.load(sys.stdin); \
    bals=[b['balance'] for b in acct.get('balances',[]) \
      if b.get('asset_code')=='USDC' and b.get('asset_issuer')=='GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5']; \
    print(bals[0] if bals else '0')" 2>/dev/null || echo "0")

echo "Deployer USDC balance: $DEPLOYER_USDC"

if [ "$DEPLOYER_USDC" = "0" ] || [ -z "$DEPLOYER_USDC" ]; then
  echo ""
  echo "⚠️  Deployer has no Circle testnet USDC."
  echo "   Get some from: https://faucet.circle.com  (select Stellar testnet)"
  echo "   Then re-run this script."
  echo ""
  echo "   Alternatively, add liquidity directly via the UI with your Freighter wallet."
  exit 0
fi

echo "==> Adding seed liquidity: 100 XLM + 100 USDC..."
# XLM: 7 decimals → 100 XLM = 1_000_000_000
# USDC: 6 decimals → 100 USDC = 100_000_000
stellar contract invoke \
  --id "$POOL_ID" \
  --network "$NETWORK" \
  --source "$IDENTITY" \
  -- deposit \
  --caller "$DEPLOYER_ADDRESS" \
  --xlm_desired 1000000000 \
  --usdc_desired 100000000 \
  --xlm_min 0 \
  --usdc_min 0

echo "==> Pool reserves after seed:"
stellar contract invoke \
  --id "$POOL_ID" \
  --network "$NETWORK" \
  --source "$IDENTITY" \
  -- get_reserves

echo ""
echo "✅ Seed liquidity added!"
echo "   View on explorer: https://stellar.expert/explorer/testnet/contract/$POOL_ID"
