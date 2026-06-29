#!/usr/bin/env bash
# Deploy StellarDex contracts to Stellar Testnet.
# Uses Circle's real testnet USDC (GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5)
# so swaps are visible directly in Freighter without any custom token setup.
#
# Prerequisites:
#   stellar keys generate --global deployer --network testnet
#   stellar keys fund deployer --network testnet

set -euo pipefail

NETWORK="testnet"
IDENTITY="deployer"

# Build contracts with the Soroban-compatible target
echo "==> Building contracts..."
cd ../contracts
stellar contract build
cd ../scripts

WASM_DIR="../contracts/target/wasm32v1-none/release"

DEPLOYER_ADDRESS=$(stellar keys address "$IDENTITY")
echo "Deployer: $DEPLOYER_ADDRESS"

# ── Resolve SAC addresses (deterministic — no deployment needed) ──────────
echo "==> Resolving SAC addresses..."

XLM_SAC_ID=$(stellar contract id asset --asset native --network "$NETWORK")
echo "XLM SAC:   $XLM_SAC_ID"

# Circle testnet USDC: USDC issued by GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
USDC_SAC_ID=$(stellar contract id asset \
  --asset "USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5" \
  --network "$NETWORK")
echo "USDC SAC:  $USDC_SAC_ID"

# ── Deploy LP Token ───────────────────────────────────────────────────────
echo "==> Deploying LP Token..."
LP_TOKEN_ID=$(stellar contract deploy \
  --wasm "$WASM_DIR/stellardex_token.wasm" \
  --network "$NETWORK" \
  --source "$IDENTITY")
echo "LP Token:  $LP_TOKEN_ID"

stellar contract invoke \
  --id "$LP_TOKEN_ID" \
  --network "$NETWORK" \
  --source "$IDENTITY" \
  -- initialize \
  --admin "$DEPLOYER_ADDRESS" \
  --name "StellarDex LP" \
  --symbol "SDLP" \
  --decimals 7

# ── Deploy Pool ───────────────────────────────────────────────────────────
echo "==> Deploying Pool..."
POOL_ID=$(stellar contract deploy \
  --wasm "$WASM_DIR/stellardex_pool.wasm" \
  --network "$NETWORK" \
  --source "$IDENTITY")
echo "Pool:      $POOL_ID"

stellar contract invoke \
  --id "$POOL_ID" \
  --network "$NETWORK" \
  --source "$IDENTITY" \
  -- initialize \
  --xlm_sac "$XLM_SAC_ID" \
  --usdc_sac "$USDC_SAC_ID" \
  --lp_token "$LP_TOKEN_ID"

# ── Transfer LP token admin → Pool ────────────────────────────────────────
# Pool must be admin so it can mint/burn LP tokens on deposit/withdraw.
echo "==> Transferring LP token admin to pool..."
stellar contract invoke \
  --id "$LP_TOKEN_ID" \
  --network "$NETWORK" \
  --source "$IDENTITY" \
  -- set_admin \
  --new_admin "$POOL_ID"
echo "LP admin → Pool ✓"

# ── Write frontend env ────────────────────────────────────────────────────
cat > ../frontend/.env.local <<EOF
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
NEXT_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015

NEXT_PUBLIC_POOL_CONTRACT_ID=$POOL_ID
NEXT_PUBLIC_LP_TOKEN_CONTRACT_ID=$LP_TOKEN_ID
NEXT_PUBLIC_XLM_CONTRACT_ID=$XLM_SAC_ID
NEXT_PUBLIC_USDC_CONTRACT_ID=$USDC_SAC_ID

# Funded deployer account used for read-only simulations
NEXT_PUBLIC_SIMULATOR_KEY=$DEPLOYER_ADDRESS
EOF

echo ""
echo "✅ Deployment complete!"
echo "   Pool:      $POOL_ID"
echo "   LP Token:  $LP_TOKEN_ID"
echo "   XLM SAC:   $XLM_SAC_ID"
echo "   USDC SAC:  $USDC_SAC_ID  (Circle testnet USDC — visible in Freighter)"
echo ""
echo "Next: run scripts/init-pool.sh to add seed liquidity."
echo "      OR connect your Freighter wallet and add liquidity via the UI."
