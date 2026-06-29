# StellarDex — Implementation Guide
## Uniswap V2 Style AMM on Stellar Soroban (XLM/USDC, Testnet)

This guide walks you through building the entire DEX from scratch to a fully running testnet deployment.
Follow phases in order — each phase builds on the previous one.

---

## Prerequisites (Install Before Starting)

- **Rust** — Install from https://rustup.rs
  - After installing, add the WASM target: `rustup target add wasm32-unknown-unknown`
- **Node.js 18+** — Install from https://nodejs.org
- **Stellar CLI** — Install via cargo: `cargo install --locked stellar-cli`
- **Git** — For version control
- **Freighter Wallet** — Browser extension from https://www.freighter.app (for testing)
- **VS Code** (recommended) with the Rust Analyzer extension

---

## Phase 1 — Project Scaffold

**Goal:** Create the monorepo folder structure and initialize all tooling.

### 1.1 Create the folder structure

Create the following directory layout manually or via terminal:

```
stellardex/
├── contracts/       ← Rust smart contracts
│   ├── pool/        ← AMM pool contract
│   └── token/       ← LP token contract
├── frontend/        ← Next.js app
└── scripts/         ← Deployment shell scripts
```

### 1.2 Initialize the Rust workspace

Inside `contracts/`, create a `Cargo.toml` that declares both `pool` and `token` as workspace members.
Set the Soroban SDK version (22.x) as a workspace dependency WITHOUT the `testutils` feature
(testutils is only for dev/test builds, not WASM release).
Add an optimized `[profile.release]` section with `lto = true`, `opt-level = "z"`, and `panic = "abort"`.

### 1.3 Create each contract crate

Inside `contracts/pool/` and `contracts/token/`, create individual `Cargo.toml` files.
Each crate must declare `crate-type = ["cdylib", "rlib"]` so it compiles both as a deployable WASM
and as a library (for cross-contract test imports).
In `[dev-dependencies]`, add the Soroban SDK WITH `features = ["testutils"]`.

### 1.4 Initialize the Next.js frontend

Inside `frontend/`, run `npx create-next-app@14` with TypeScript, Tailwind CSS, and the App Router.
After scaffolding, install the following additional dependencies:
- `@stellar/stellar-sdk` — Stellar/Soroban JavaScript SDK
- `@stellar/freighter-api` — Freighter wallet integration
- `zustand` — Lightweight state management

### 1.5 Configure TypeScript for BigInt support

In `frontend/tsconfig.json`, add `"target": "ES2020"` to `compilerOptions`.
Without this, TypeScript will reject BigInt literals (`0n`, `1000n`) used throughout the math layer.

### 1.6 Configure Next.js webpack for Stellar SDK

In `next.config.ts`, add a webpack config that sets `resolve.fallback` for `fs`, `net`, and `tls` to `false`.
The Stellar SDK references Node.js built-ins that do not exist in a browser bundle.

### 1.7 Configure Tailwind

In `tailwind.config.ts`, add a custom `stellar` color palette and a `stellar-gradient` background image.
These will be used across all UI components for consistent branding.

### Verification
- `cargo check` inside `contracts/` should complete with no errors
- `npm run dev` inside `frontend/` should start the dev server

---

## Phase 2 — LP Token Contract (SEP-41)

**Goal:** Build the LP token contract that the pool mints/burns to track liquidity shares.

### 2.1 Understand the SEP-41 standard

SEP-41 is Stellar's fungible token interface standard — the equivalent of ERC-20 on Ethereum.
Any token on Soroban that follows SEP-41 can be used by wallets, DEXes, and other contracts interoperably.
Read the standard at: https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0041.md

### 2.2 Design the storage layout

In `contracts/token/src/lib.rs`, define a `DataKey` enum with the following variants:
- `Admin` — the address allowed to mint (will be set to the pool contract)
- `TotalSupply` — total LP tokens in circulation
- `Balance(Address)` — per-user token balance
- `Allowance(Address, Address)` — spender allowances for `transfer_from`
- `Name`, `Symbol`, `Decimals` — token metadata

Use **instance storage** for global state (admin, supply, metadata) and **persistent storage** for
per-user balances (so balances survive ledger TTL expiration properly).

### 2.3 Implement the initialize function

The `initialize` function takes: admin address, token name, token symbol, and decimals (use 7 for LP tokens).
It must panic if called a second time (check if `Admin` key already exists in storage).
This is called once right after deployment — the admin will be the pool contract address.

### 2.4 Implement the SEP-41 interface

Implement all required functions:
- `allowance(from, spender)` — read the current allowance
- `approve(from, spender, amount, expiration_ledger)` — set allowance; always call `from.require_auth()`
- `balance(id)` — read balance of an address
- `transfer(from, to, amount)` — move tokens; call `from.require_auth()`
- `transfer_from(spender, from, to, amount)` — spend an allowance; call `spender.require_auth()`
- `burn(from, amount)` — destroy tokens; call `from.require_auth()`
- `burn_from(spender, from, amount)` — burn via allowance
- `decimals()`, `name()`, `symbol()` — metadata getters
- `total_supply()` — global supply

### 2.5 Implement the admin-only mint function

Add a `mint(to, amount)` function that calls `admin.require_auth()` before minting.
This is NOT part of SEP-41 — it is a custom admin function that only the pool contract can call.
The pool contract will use Soroban SDK's `token::StellarAssetClient` to invoke this function.

### 2.6 Emit events

After every transfer, approval, mint, and burn, emit a Soroban event using `e.events().publish()`.
Events are how block explorers and the transaction history UI track activity.
Use short symbol topics like `"transfer"`, `"mint"`, `"burn"`, `"approve"`.

### 2.7 Write unit tests

In the same file under `#[cfg(test)]`, write tests covering:
- Mint increases balance and total supply
- Transfer moves balance between addresses
- Burn reduces balance and total supply
- Approve sets allowance; transfer_from spends it and reduces allowance
- Double-initialize panics

Run with `cargo test -p stellardex-token`.

---

## Phase 3 — Pool AMM Contract

**Goal:** Build the core constant-product AMM that handles all swap and liquidity logic.

### 3.1 Understand the constant-product formula

The AMM maintains the invariant: `reserve_xlm × reserve_usdc = k` (constant).

Key formulas:
- **Swap output** with 0.3% fee: `amount_out = (reserve_out × amount_in × 997) / (reserve_in × 1000 + amount_in × 997)`
- **First deposit LP shares**: `sqrt(xlm_deposited × usdc_deposited)`
- **Subsequent deposit LP shares**: `min(xlm_in × total_shares / reserve_xlm, usdc_in × total_shares / reserve_usdc)`
- **Withdraw amounts**: `token_out = lp_shares × reserve / total_shares`

### 3.2 Create the storage module (`storage.rs`)

Define a `DataKey` enum with: `TokenXlm`, `TokenUsdc`, `LpToken`, `ReserveXlm`, `ReserveUsdc`, `TotalShares`, `Initialized`.
Write typed getter and setter functions for each key using instance storage.
Having typed accessors prevents scattered raw storage calls throughout the main logic.

### 3.3 Create the math module (`math.rs`)

Implement three pure functions (no Env parameter, no side effects):
1. `get_amount_out(amount_in, reserve_in, reserve_out)` — the 0.3% fee swap formula
2. `calc_shares_to_mint(xlm_in, usdc_in, reserve_xlm, reserve_usdc, total_shares)` — handles both first and subsequent deposits
3. `optimal_deposit(desired_a, reserve_a, reserve_b)` — calculates how much of token B to deposit given a desired amount of token A, to maintain the current ratio

Also implement integer square root using the Babylonian method (needed for the first-deposit share formula).
Write unit tests for all math functions — these are the most critical logic in the system.

### 3.4 Create the events module (`events.rs`)

Define three event emitter functions:
- `emit_deposit(caller, xlm_in, usdc_in, lp_minted)` — emitted on every successful deposit
- `emit_swap(caller, token_in, amount_in, amount_out)` — emitted on every swap
- `emit_withdraw(caller, xlm_out, usdc_out, lp_burned)` — emitted on every withdrawal

Use short symbol topics (7 chars max in Soroban). These events power the transaction history UI.

### 3.5 Implement the main contract (`lib.rs`)

#### initialize(xlm_sac, usdc_sac, lp_token)
- Store the three contract addresses
- Set reserves to 0 and total shares to 0
- Mark as initialized; panic if called again

#### deposit(caller, xlm_desired, usdc_desired, xlm_min, usdc_min) → lp_shares
- Call `caller.require_auth()` at the very top
- If the pool has existing liquidity, calculate the optimal deposit ratio
  - Try using the full `xlm_desired` amount and compute the required USDC
  - If that USDC amount exceeds `usdc_desired`, flip: use full `usdc_desired` and compute required XLM
  - Check that neither computed amount is below its respective `_min` parameter (slippage protection)
- Calculate LP shares to mint using the math module
- Panic if LP shares would be 0
- Use `token::Client::transfer(caller → pool)` for both XLM and USDC
  - This works because the user's auth signature on `deposit()` covers nested transfer auth calls
- Use `token::StellarAssetClient::mint(caller, lp_shares)` to mint LP tokens to the depositor
  - This works because the pool is the admin of the LP token contract
- Update reserves and total shares in storage
- Emit the Deposit event

#### swap(caller, token_in, amount_in, min_out) → amount_out
- Call `caller.require_auth()`
- Validate `token_in` is either the XLM SAC or USDC SAC address; panic otherwise
- Determine which reserve is `reserve_in` and which is `reserve_out`
- Calculate `amount_out` using the swap formula
- Assert `amount_out >= min_out` (slippage protection)
- Assert `amount_out < reserve_out` (cannot drain the pool)
- Use `token::Client::transfer(caller → pool)` to pull in the input token
- Use `token::Client::transfer(pool → caller)` to send out the output token
- Update reserves
- Emit the Swap event

#### withdraw(caller, lp_shares, min_xlm, min_usdc) → (xlm_out, usdc_out)
- Call `caller.require_auth()`
- Calculate proportional output: `token_out = lp_shares × reserve / total_shares`
- Assert both outputs are above their minimums (slippage protection)
- Assert both outputs are > 0
- Use `token::Client::burn(caller, lp_shares)` to destroy the LP tokens
- Use `token::Client::transfer(pool → caller)` for both XLM and USDC
- Update reserves and total shares
- Emit the Withdraw event

#### get_reserves() → (xlm_reserve, usdc_reserve)
- Read-only. Returns current reserves directly from storage.

#### get_price(token_in, amount_in) → amount_out
- Read-only. Runs `get_amount_out` against current reserves without modifying state.
- Return 0 if either reserve is 0 (pool is empty).
- The frontend calls this to show price previews before the user confirms a swap.

### 3.6 Understand Soroban auth model

**Critical concept:** When the pool calls `token::Client::transfer(&caller, &pool, &amount)`, this requires
the caller to have authorized this sub-call. In Soroban, when a user signs the top-level `pool.deposit()`
transaction, their signature covers the entire call tree including nested token transfers from their address.
Freighter wallet handles building and signing this auth tree automatically.

### 3.7 Write integration tests

Test the full lifecycle:
- Deploy mock XLM token, mock USDC token, LP token (with pool as admin), and pool contract
- Deposit: verify reserves update, LP tokens are minted to user
- Swap XLM → USDC: verify output is less than input (fee applied), reserves update
- Swap USDC → XLM: verify the reverse direction
- Withdraw: verify tokens return proportionally, LP tokens are burned
- Slippage test: verify swap panics with "slippage" when `min_out` is too high
- `get_price` test: verify it returns the same value as an actual swap would

Run with `cargo test -p stellardex-pool`.

---

## Phase 4 — Compile to WASM

**Goal:** Build the contracts into deployable WebAssembly binaries.

### 4.1 Build command

From inside the `contracts/` directory, run:
```
cargo build --target wasm32-unknown-unknown --release
```

The compiled `.wasm` files will appear at:
- `contracts/target/wasm32-unknown-unknown/release/stellardex_token.wasm`
- `contracts/target/wasm32-unknown-unknown/release/stellardex_pool.wasm`

### 4.2 Important: testutils must NOT be in release build

The workspace `Cargo.toml` must define soroban-sdk WITHOUT `features = ["testutils"]`.
The `testutils` feature pulls in `serde_json`, `rand`, and other std-only crates that break WASM compilation.
Only `[dev-dependencies]` sections in individual crates should enable `testutils`.

### 4.3 Verify file sizes

The WASMs should be small (under 200 KB each) due to the release profile optimizations.
Large WASM files cost more to deploy and execute on-chain.

---

## Phase 5 — Testnet Setup

**Goal:** Create and fund a Stellar testnet identity for deployment.

### 5.1 Create a testnet identity

Using Stellar CLI:
```
stellar keys generate --global deployer --network testnet
```
This creates a key pair stored locally. The `--global` flag saves it in your home directory config.

### 5.2 Fund the account

The Stellar testnet has a "Friendbot" service that sends free test XLM to any new account:
```
stellar keys fund deployer --network testnet
```
This gives you ~10,000 XLM on testnet — enough to deploy contracts and test extensively.

### 5.3 Verify balance

Check your address and balance:
```
stellar keys address deployer
stellar account balance --account deployer --network testnet
```

### 5.4 Understand testnet RPC

The Soroban RPC endpoint for testnet is: `https://soroban-testnet.stellar.org`
Your frontend and CLI will communicate with this endpoint to submit transactions and read state.
Testnet resets periodically (every few months) — all deployed contracts will be wiped on reset.

---

## Phase 6 — Deploy Contracts to Testnet

**Goal:** Deploy all three contracts (mock USDC, LP token, pool) and initialize the pool.

### 6.1 Deploy the mock USDC token

Deploy the compiled `stellardex_token.wasm` as the USDC stand-in:
```
stellar contract deploy --wasm <path>/stellardex_token.wasm --network testnet --source deployer
```
Save the returned contract ID. This is your `USDC_CONTRACT_ID`.

Then call its `initialize` function with:
- admin = your deployer address
- name = "USD Coin"
- symbol = "USDC"
- decimals = 6

### 6.2 Get the XLM SAC address

The native XLM asset already has a pre-deployed Stellar Asset Contract on testnet.
Retrieve its address without deploying anything:
```
stellar contract id asset --asset native --network testnet
```
Save this as your `XLM_CONTRACT_ID`. The pool will use this to interact with native XLM.

### 6.3 Deploy the LP token contract

Deploy `stellardex_token.wasm` again (a fresh instance):
```
stellar contract deploy --wasm <path>/stellardex_token.wasm --network testnet --source deployer
```
Save the returned ID as `LP_TOKEN_CONTRACT_ID`.

**Important:** For now, initialize it with your deployer address as admin:
```
stellar contract invoke --id <LP_TOKEN_ID> ... -- initialize --admin <DEPLOYER_ADDRESS> ...
```
You will change the admin to the pool contract in a later step.

### 6.4 Deploy the pool contract

Deploy `stellardex_pool.wasm`:
```
stellar contract deploy --wasm <path>/stellardex_pool.wasm --network testnet --source deployer
```
Save the returned ID as `POOL_CONTRACT_ID`.

### 6.5 Initialize the pool

Call the pool's `initialize` function with:
```
stellar contract invoke --id <POOL_ID> ... -- initialize \
  --xlm_sac <XLM_CONTRACT_ID> \
  --usdc_sac <USDC_CONTRACT_ID> \
  --lp_token <LP_TOKEN_CONTRACT_ID>
```

### 6.6 Transfer LP token admin to the pool

The LP token's admin must be the pool contract so only the pool can mint/burn LP tokens.
Since our LP token uses a stored admin (not the SAC `set_admin` pattern), you need to
re-deploy the LP token with `admin = POOL_CONTRACT_ID` from the start.

**Recommended deploy order:**
1. Deploy pool contract (no initialization yet)
2. Deploy LP token with `admin = POOL_CONTRACT_ID`
3. Deploy mock USDC with `admin = your deployer address`
4. Initialize the pool

### 6.7 Add seed liquidity

Mint some test USDC to your deployer account, then call `pool.deposit()` with a reasonable initial amount
(e.g., 1,000 XLM + 1,000 USDC). This establishes the initial price ratio.
Without seed liquidity, the pool has no reserves and swaps will fail.

### 6.8 Write all contract IDs to the frontend env file

Create `frontend/.env.local` with:
```
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
NEXT_PUBLIC_POOL_CONTRACT_ID=<POOL_CONTRACT_ID>
NEXT_PUBLIC_LP_TOKEN_CONTRACT_ID=<LP_TOKEN_CONTRACT_ID>
NEXT_PUBLIC_XLM_CONTRACT_ID=<XLM_CONTRACT_ID>
NEXT_PUBLIC_USDC_CONTRACT_ID=<USDC_CONTRACT_ID>
NEXT_PUBLIC_SIMULATOR_KEY=<YOUR_DEPLOYER_PUBLIC_KEY>
```

---

## Phase 7 — Frontend Core: Stellar Integration Layer

**Goal:** Build the TypeScript layer that connects the frontend to Soroban contracts.

### 7.1 Create `lib/stellar.ts` — the RPC client

Set up the Soroban RPC server connection using `SorobanRpc.Server` from `@stellar/stellar-sdk`.
Read all network configuration from environment variables.
Implement the following utilities:
- `getRpcClient()` — returns a configured RPC server instance
- `toStroops(amount, decimals)` — converts human-readable numbers to the contract's smallest unit (bigint)
- `fromStroops(amount, decimals)` — converts smallest unit back to display number
- `buildContractTx(publicKey, contractId, method, args)` — builds an unsigned transaction XDR string
  1. Fetch the user's account from RPC
  2. Build a TransactionBuilder with the contract call operation
  3. Simulate the transaction (required before submission — simulation fills in the auth entries and fees)
  4. Assemble the simulated transaction using `SorobanRpc.assembleTransaction()`
  5. Return the XDR string for Freighter to sign
- `submitTx(signedXdr)` — submits a signed XDR and polls until confirmed
  1. Call `server.sendTransaction()`
  2. Save the returned `hash`
  3. Poll `server.getTransaction(hash)` every second until status is no longer `NOT_FOUND`
  4. Return `{ status: "SUCCESS" | "FAILED", hash }`
- Helper functions for encoding Soroban arguments: `addressArg(addr)` and `i128Arg(n)`

### 7.2 Create `lib/math.ts` — off-chain price calculations

Mirror the on-chain math in TypeScript (using BigInt for precision):
- `getAmountOut(amountIn, reserveIn, reserveOut)` — the 0.3% fee formula
- `priceImpact(amountIn, reserveIn, reserveOut)` — percentage impact vs. the ideal no-fee price
- `minAmountOut(amountOut, slippageBps)` — apply slippage tolerance to get minimum acceptable output
- `calcShares(xlmIn, usdcIn, reserveXlm, reserveUsdc, totalShares)` — LP share preview for deposits
- `spotPrice(reserveIn, reserveOut)` — simple ratio for price display

These are used to show previews and price impact warnings BEFORE the user submits a transaction.

### 7.3 Create `lib/contracts.ts` — typed contract wrappers

Build functions that return unsigned transaction XDR (for Freighter to sign) or simulate read-only calls:
- `getReserves()` — simulate `pool.get_reserves()` and parse the result into `{ xlm: bigint, usdc: bigint }`
- `getPrice(tokenIn, amountIn, publicKey)` — simulate `pool.get_price()` and parse the output
- `getLpBalance(walletAddress)` — simulate `lp_token.balance()` for a user's LP holdings
- `getLpTotalSupply(publicKey)` — simulate `lp_token.total_supply()`
- `buildSwapTx(walletAddress, tokenIn, amountIn, minOut)` — returns unsigned XDR for a swap
- `buildDepositTx(walletAddress, xlmDesired, usdcDesired, xlmMin, usdcMin)` — returns unsigned XDR for deposit
- `buildWithdrawTx(walletAddress, lpShares, minXlm, minUsdc)` — returns unsigned XDR for withdrawal

### 7.4 Create `lib/store.ts` — global state with Zustand

Define a Zustand store with:
- `walletAddress` — the connected Freighter address (null if disconnected)
- `setWalletAddress(addr)` — sets address and triggers reserve refresh
- `reserveXlm`, `reserveUsdc`, `lpBalance`, `lpTotalSupply` — pool state (as bigint)
- `refreshReserves()` — fetches all pool state and updates the store; called on connect and on a 10-second interval
- `txStatus` — one of: `"idle" | "building" | "signing" | "submitting" | "success" | "error"`
- `txHash`, `txError` — set after transaction completes
- `setTxStatus(status, hash?, error?)` — updates transaction state
- `txHistory` — array of recent transactions (max 20, newest first)
- `addTx(tx)` — prepends a transaction record to history

---

## Phase 8 — Frontend Components

**Goal:** Build the UI components that users interact with.

### 8.1 WalletButton component

- On mount, call `freighter.isConnected()` to check if Freighter extension is installed
- If not installed, show a link to https://www.freighter.app
- If installed but not connected, show a "Connect Wallet" button
  - On click: call `requestAccess()` then `getPublicKey()` to get the address
- If connected, show a truncated address (first 4 + last 4 chars) as a "Disconnect" button

**Freighter API v2 note:** Use `getPublicKey()` (not `getAddress()`). The `signTransaction()` function
returns a raw string XDR (not an object). Use `accountToSign` (not `address`) in sign options.

### 8.2 SwapCard component

This is the main swap interface.

**Layout:**
- Header row with "Swap" title and slippage selector (0.1% / 0.5% / 1% / custom input)
- Input box labeled "You pay" with the token symbol and a number input
- A flip button (↕) between the two boxes that swaps XLM/USDC direction
- Output box labeled "You receive" showing the calculated output (read-only)
- Price impact display (green < 1%, yellow 1-5%, red > 5%)
- Minimum received row showing amount after slippage
- Fee note: 0.3%
- Warning if price impact > 15% (block swap in this case)
- Swap button with dynamic label reflecting current transaction state

**Logic:**
- On input change: recalculate output using `lib/math.ts getAmountOut()` against current reserves
- On swap click:
  1. Build the transaction XDR via `buildSwapTx()`
  2. Pass XDR to Freighter's `signTransaction()` with `accountToSign` and `networkPassphrase`
  3. Submit the signed XDR via `submitTx()`
  4. On success: update tx status, add to history, refresh reserves, clear input
  5. On error: show error state

### 8.3 LiquidityCard component

Provide both Add and Remove liquidity in a tabbed interface.

**Add tab:**
- Two input fields: XLM amount and USDC amount
- Auto-balance: when the user types in one field, auto-calculate the other based on current pool ratio
  (Only auto-balance when pool has existing liquidity. First deposit can be any ratio.)
- LP tokens to receive preview (calculated via `calcShares()`)
- Deposit button — same signing flow as swap

**Remove tab:**
- A percentage slider (1-100%) with quick-select buttons (25%, 50%, 75%, 100%)
- Shows estimated XLM and USDC to be received based on the selected percentage
- Remove button — same signing flow as swap

**Your Position section** (shown when user has LP balance > 0):
- Current LP token balance
- Pool share percentage: `userLp / totalSupply × 100`
- Estimated XLM and USDC value of the position

### 8.4 PriceImpact component

A simple row showing the price impact percentage with color coding:
- Green: < 1%
- Yellow: 1–5%
- Red: > 5% (with warning emoji)

### 8.5 TxHistory component

Fetches recent pool events from the Soroban RPC and displays them.

**Event fetching:**
- Call `server.getEvents()` with `filters: [{ type: "contract", contractIds: [POOL_ID] }]`
- Parse the event topics to determine type (Deposit/Swap/Withdraw)
- Display events in reverse chronological order (newest first)
- Each row links to Stellar Expert: `https://stellar.expert/explorer/testnet/tx/<hash>`
- Refresh button to manually re-fetch
- Auto-refresh after each user transaction (watch `txStatus` for "success")

---

## Phase 9 — Frontend Pages

**Goal:** Wire everything together into navigable pages.

### 9.1 App layout (`app/layout.tsx`)

Create a sticky navigation header with:
- Brand name "StellarDex" on the left
- Nav links: "Swap" (links to `/`) and "Liquidity" (links to `/liquidity`)
- WalletButton on the right

Apply the stellar gradient background to the entire body.

### 9.2 Swap page (`app/page.tsx`)

This is the landing page at `/`.

**Structure:**
- A pool stats bar showing three cards: XLM Reserve, USDC Reserve, Current Price (USDC per XLM)
- The SwapCard component centered below
- The TxHistory component below that

**Auto-refresh:** On page load and every 10 seconds, call `store.refreshReserves()` via `useEffect`.
The interval should be cleared on unmount to avoid memory leaks.

The price in the stats bar is the spot price: `Number(reserveUsdc) / Number(reserveXlm)` displayed with 4 decimal places.

### 9.3 Liquidity page (`app/liquidity/page.tsx`)

This is the `/liquidity` route.

**Structure:**
- A pool stats bar showing three cards: XLM Reserve, USDC Reserve, LP Total Supply
- The LiquidityCard component centered below
- The TxHistory component below that

Same auto-refresh pattern as the swap page.

---

## Phase 10 — End-to-End Testing on Testnet

**Goal:** Verify the entire system works together from browser to blockchain.

### 10.1 Set up Freighter for testnet

- Install the Freighter browser extension
- Create or import a wallet
- Go to Settings → Network → Switch to Testnet
- Go to Settings → Advanced → Enable Soroban (if not already enabled)

### 10.2 Fund your test wallet

Use the Stellar Laboratory or Friendbot to get testnet XLM:
- Visit: `https://friendbot.stellar.org/?addr=<YOUR_WALLET_ADDRESS>`
- Or use Stellar CLI: `stellar keys fund <your_wallet_pubkey> --network testnet`

### 10.3 Get test USDC

Call the mock USDC contract's `mint` function directly via Stellar CLI:
```
stellar contract invoke --id <USDC_CONTRACT_ID> --network testnet --source deployer \
  -- mint --to <YOUR_WALLET_ADDRESS> --amount 100000000000
```
This mints 100,000 USDC (with 6 decimals = 100,000,000,000 in smallest units).

### 10.4 Test sequence

**Test 1: Connect wallet**
- Open http://localhost:3000
- Click "Connect Wallet" — Freighter popup should appear
- Approve connection — your truncated address should appear in the header
- Pool reserves should load in the stats bar

**Test 2: Add liquidity**
- Navigate to `/liquidity`
- Enter 10 XLM in the XLM field
- USDC field should auto-fill with the proportional USDC amount
- Click "Add Liquidity" — Freighter popup should appear asking to sign
- Approve — transaction submits and confirms
- Your position section should appear showing your LP balance

**Test 3: Swap XLM → USDC**
- Navigate back to `/`
- Enter 1 XLM in the "You pay" field
- Verify output amount appears in "You receive"
- Verify price impact is shown (small for 1 XLM in a 10 XLM pool)
- Click "Swap" and approve in Freighter
- Verify pool reserves update after confirmation

**Test 4: Swap USDC → XLM**
- Click the flip button (↕)
- Enter some USDC amount
- Swap and confirm

**Test 5: Transaction history**
- All three transactions should appear in the TxHistory panel
- Clicking a transaction should open Stellar Expert in a new tab
- Verify the transaction details look correct on Stellar Expert

**Test 6: Remove liquidity**
- Go to `/liquidity` → "Remove Liquidity" tab
- Move the slider to 50%
- Confirm the estimated XLM and USDC shown make sense
- Click "Remove Liquidity" and approve
- Verify LP balance decreases, XLM/USDC balances increase in Freighter

**Test 7: Slippage protection**
- Set slippage to 0.1%
- Try to swap a large amount (> 10% of pool) — you should see high price impact warning
- The swap should either be blocked or fail on-chain with a slippage error

### 10.5 Verify on Stellar Expert

For each transaction, check https://stellar.expert/explorer/testnet/tx/<hash>
Verify:
- Contract was invoked (pool contract ID matches)
- Events were emitted (Deposit/Swap/Withdraw topics visible)
- Token balances changed as expected

---

## Common Issues and Fixes

### Contract deployment fails
- Ensure your account has enough XLM (minimum ~5 XLM for each deployment)
- Check that the WASM file exists at the correct path
- Verify you're targeting testnet (`--network testnet`)

### "Simulation failed" error in frontend
- The RPC simulation runs before every transaction
- If reserves are zero (pool not initialized), `get_price` simulation will fail — this is expected
- Ensure `NEXT_PUBLIC_SIMULATOR_KEY` in `.env.local` is a funded testnet account

### Freighter shows wrong network
- Open Freighter → Settings → Network → Select Testnet
- Refresh the page after switching networks

### Transaction stuck at "submitting"
- The testnet RPC may occasionally be slow
- The polling in `submitTx` waits up to 30 seconds; after that, treat it as a timeout

### LP token admin error on deposit
- The LP token must have been initialized with `admin = POOL_CONTRACT_ID`
- If you initialized with the deployer address, re-deploy the LP token with the correct admin

### BigInt TypeScript errors
- Ensure `"target": "ES2020"` is in `frontend/tsconfig.json`
- Delete `frontend/tsconfig.tsbuildinfo` to clear the incremental cache
- Re-run `npx tsc --noEmit` to verify

### Reserves show as 0 in UI
- Seed liquidity may not have been added (`scripts/init-pool.sh` not run)
- Check that `NEXT_PUBLIC_POOL_CONTRACT_ID` in `.env.local` matches the deployed contract
- The pool must be initialized before `get_reserves` will return non-zero values

---

## Deployment Checklist

Before calling the testnet deployment complete, verify every item:

- [ ] `cargo test` inside `contracts/` — all tests pass, zero failures
- [ ] `cargo build --target wasm32-unknown-unknown --release` — both WASM files generated, no errors
- [ ] LP token deployed with `admin = POOL_CONTRACT_ID`
- [ ] Mock USDC deployed and initialized
- [ ] Pool deployed and `initialize()` called with correct SAC addresses
- [ ] Seed liquidity added to the pool (non-zero reserves)
- [ ] `frontend/.env.local` contains all four contract IDs and simulator key
- [ ] `npx tsc --noEmit` passes with no errors
- [ ] `npm run dev` starts without errors
- [ ] Freighter wallet connected successfully in browser
- [ ] Swap XLM → USDC completes on testnet
- [ ] Swap USDC → XLM completes on testnet
- [ ] Add liquidity completes and LP balance shows in UI
- [ ] Remove liquidity completes and tokens return correctly
- [ ] Transaction history shows all events with working Stellar Expert links
- [ ] Pool reserves update live after each transaction
