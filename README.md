# StellarDex

A decentralized exchange (DEX) on the **Stellar** network, built with **Soroban** smart contracts and a **Next.js** frontend. StellarDex implements a Uniswap V2–style constant-product automated market maker (AMM) for swapping **XLM ↔ USDC**, providing liquidity, and tracking positions — fully on-chain on Stellar **Testnet**.

> Swaps use Circle's real testnet USDC (`USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`), so balances are visible directly in Freighter.

**Live on Stellar Testnet** — Pool contract [`CDV2ERHH…S6CUTRC`](https://stellar.expert/explorer/testnet/contract/CDV2ERHHD5JH3NBUCSKTMVQ6MTE5KP4GRGH7RHZHNLASS3YBZS6CUTRC). Full addresses & transaction hashes in [DEPLOYMENT.md](./DEPLOYMENT.md).

## Features

- **Swap** — XLM ↔ USDC with constant-product pricing (`x · y = k`) and slippage protection.
- **Liquidity** — deposit/withdraw to earn a share of trading fees; LP tokens track ownership.
- **Portfolio** — view balances, pool reserves, and transaction history.
- **Wallet** (`/wallet`) — Freighter integration on testnet: detect → connect → XLM balance → send XLM → transaction hash.

## Tech stack

| Layer | Stack |
|-------|-------|
| Contracts | Rust, `soroban-sdk` 22, Soroban (Stellar smart contracts) |
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, Zustand |
| Wallet | `@stellar/freighter-api`, `@stellar/stellar-sdk` |
| CI/CD | GitHub Actions (testnet deploy + Vercel) |

## Repository layout

```
.
├── contracts/              # Soroban smart contracts (Rust workspace)
│   ├── pool/               # AMM pool: initialize, deposit, swap, withdraw, get_reserves, get_price
│   └── token/              # LP / SAC-compatible token: mint, burn, transfer, approve, set_admin, …
├── frontend/               # Next.js app
│   ├── app/                # Routes: /, /swap, /liquidity, /portfolio, /wallet
│   ├── components/         # UI components (incl. components/wallet/stellar-wallet-panel.tsx)
│   ├── hooks/              # use-stellar-wallet.ts
│   └── lib/                # stellar.ts (Soroban), stellar-wallet.ts, stellar-sdk.ts, math, store
├── scripts/                # deploy.sh, init-pool.sh
└── .github/workflows/      # ci.yml, deploy.yml
```

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Rust](https://www.rust-lang.org/tools/install) with the `wasm32v1-none` target: `rustup target add wasm32v1-none`
- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli/install-cli): `cargo install --locked stellar-cli --features opt`
- [Freighter](https://freighter.app) browser extension (set to **Testnet**)

## Smart contracts

```bash
cd contracts
cargo test --workspace                              # run unit tests
cargo build --target wasm32v1-none --release        # build WASM
# or, equivalently, with the Stellar CLI:
stellar contract build
```

**Pool** methods: `initialize`, `deposit`, `swap`, `withdraw`, `get_reserves`, `get_price`.
**Token** methods: `initialize`, `mint`, `burn`, `transfer`, `transfer_from`, `approve`, `allowance`, `balance`, `set_admin`, `total_supply`, `name`, `symbol`, `decimals`.

### Deploy to testnet

```bash
# One-time: create and fund a deployer identity
stellar keys generate --global deployer --network testnet
stellar keys fund deployer --network testnet

# Deploy + initialize both contracts and write frontend/.env.local
cd scripts
./deploy.sh
./init-pool.sh   # optional: seed the pool with liquidity
```

`deploy.sh` deploys the LP token and pool, initializes them, transfers LP-token admin to the pool, and writes the resulting contract IDs into `frontend/.env.local`.

## Frontend

```bash
cd frontend
cp .env.local.example .env.local   # fill in contract IDs (deploy.sh does this automatically)
npm install
npm run dev                         # http://localhost:3000
```

Scripts: `npm run dev` · `npm run build` · `npm run lint` · `npm run typecheck` · `npm run test`.

### Environment variables (`frontend/.env.local`)

```
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
NEXT_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
NEXT_PUBLIC_POOL_CONTRACT_ID=...
NEXT_PUBLIC_LP_TOKEN_CONTRACT_ID=...
NEXT_PUBLIC_XLM_CONTRACT_ID=...
NEXT_PUBLIC_USDC_CONTRACT_ID=...
```

## CI/CD

GitHub Actions workflows live in `.github/workflows/`:

- **`ci.yml`** (push / PR to `main`)
  - `contracts`: install Rust + `wasm32v1-none`, `cargo test`, build release WASM.
  - `frontend`: `npm ci`, lint, build, test.
- **`deploy.yml`** (push to `main`)
  - `deploy-contract`: install Stellar CLI, build WASM, deploy + initialize both contracts on testnet.
  - `deploy-frontend`: build and deploy the Next.js app (Vercel by default).

Required repository secrets for deployment:

| Secret | Purpose |
|--------|---------|
| `STELLAR_SECRET_KEY` | Funded testnet account (`S…`) used to deploy & initialize contracts |
| `VERCEL_TOKEN` | Vercel deploy token for the frontend |

## License

MIT
