#![no_std]

mod events;
mod math;
mod storage;

use soroban_sdk::{contract, contractimpl, token, Address, Env};

use math::{calc_shares_to_mint, get_amount_out, optimal_deposit};
use storage::{
    get_lp_token, get_reserve_usdc, get_reserve_xlm, get_token_usdc, get_token_xlm,
    get_total_shares, is_initialized, set_initialized, set_reserves, set_tokens, set_total_shares,
};

#[contract]
pub struct Pool;

#[contractimpl]
impl Pool {
    /// One-time setup — register the two SAC addresses and the LP token contract.
    pub fn initialize(e: Env, xlm_sac: Address, usdc_sac: Address, lp_token: Address) {
        if is_initialized(&e) {
            panic!("already initialized");
        }
        set_tokens(&e, &xlm_sac, &usdc_sac, &lp_token);
        set_reserves(&e, 0, 0);
        set_total_shares(&e, 0);
        set_initialized(&e);
    }

    /// Add liquidity. Caller signs this transaction; the auth tree automatically
    /// covers the nested token.transfer calls from caller → pool.
    /// Returns LP tokens minted.
    pub fn deposit(
        e: Env,
        caller: Address,
        xlm_desired: i128,
        usdc_desired: i128,
        xlm_min: i128,
        usdc_min: i128,
    ) -> i128 {
        caller.require_auth();
        assert!(xlm_desired > 0 && usdc_desired > 0, "zero amount");

        let reserve_xlm = get_reserve_xlm(&e);
        let reserve_usdc = get_reserve_usdc(&e);
        let total_shares = get_total_shares(&e);

        let (xlm_in, usdc_in) = if total_shares == 0 {
            (xlm_desired, usdc_desired)
        } else {
            let usdc_optimal = optimal_deposit(xlm_desired, reserve_xlm, reserve_usdc);
            if usdc_optimal <= usdc_desired {
                assert!(usdc_optimal >= usdc_min, "slippage: usdc below min");
                (xlm_desired, usdc_optimal)
            } else {
                let xlm_optimal = optimal_deposit(usdc_desired, reserve_usdc, reserve_xlm);
                assert!(xlm_optimal >= xlm_min, "slippage: xlm below min");
                (xlm_optimal, usdc_desired)
            }
        };

        let lp_minted =
            calc_shares_to_mint(xlm_in, usdc_in, reserve_xlm, reserve_usdc, total_shares);
        assert!(lp_minted > 0, "insufficient liquidity minted");

        let pool = e.current_contract_address();

        // Pull tokens from caller into pool (covered by caller's auth tree)
        token::Client::new(&e, &get_token_xlm(&e)).transfer(&caller, &pool, &xlm_in);
        token::Client::new(&e, &get_token_usdc(&e)).transfer(&caller, &pool, &usdc_in);

        // Mint LP tokens to caller (pool is admin of LP token, so this self-authorizes)
        token::StellarAssetClient::new(&e, &get_lp_token(&e)).mint(&caller, &lp_minted);

        set_reserves(&e, reserve_xlm + xlm_in, reserve_usdc + usdc_in);
        set_total_shares(&e, total_shares + lp_minted);

        events::emit_deposit(&e, &caller, xlm_in, usdc_in, lp_minted);
        lp_minted
    }

    /// Swap exact input for output. token_in must be the XLM SAC or USDC SAC address.
    /// Returns amount of output token received.
    pub fn swap(
        e: Env,
        caller: Address,
        token_in: Address,
        amount_in: i128,
        min_out: i128,
    ) -> i128 {
        caller.require_auth();
        assert!(amount_in > 0, "zero amount_in");

        let xlm_addr = get_token_xlm(&e);
        let usdc_addr = get_token_usdc(&e);
        let reserve_xlm = get_reserve_xlm(&e);
        let reserve_usdc = get_reserve_usdc(&e);

        let (reserve_in, reserve_out, token_out_addr) = if token_in == xlm_addr {
            (reserve_xlm, reserve_usdc, usdc_addr)
        } else if token_in == usdc_addr {
            (reserve_usdc, reserve_xlm, xlm_addr)
        } else {
            panic!("invalid token_in");
        };

        let amount_out = get_amount_out(amount_in, reserve_in, reserve_out);
        assert!(amount_out >= min_out, "slippage: output below min");
        assert!(amount_out < reserve_out, "insufficient liquidity");

        let pool = e.current_contract_address();

        // Pull input token from caller
        token::Client::new(&e, &token_in).transfer(&caller, &pool, &amount_in);
        // Send output token to caller
        token::Client::new(&e, &token_out_addr).transfer(&pool, &caller, &amount_out);

        // Update reserves
        let xlm_token = get_token_xlm(&e);
        if token_in == xlm_token {
            set_reserves(&e, reserve_xlm + amount_in, reserve_usdc - amount_out);
        } else {
            set_reserves(&e, reserve_xlm - amount_out, reserve_usdc + amount_in);
        }

        events::emit_swap(&e, &caller, &token_in, amount_in, amount_out);
        amount_out
    }

    /// Remove liquidity by burning LP tokens. Returns (xlm_out, usdc_out).
    pub fn withdraw(
        e: Env,
        caller: Address,
        lp_shares: i128,
        min_xlm: i128,
        min_usdc: i128,
    ) -> (i128, i128) {
        caller.require_auth();
        assert!(lp_shares > 0, "zero lp_shares");

        let reserve_xlm = get_reserve_xlm(&e);
        let reserve_usdc = get_reserve_usdc(&e);
        let total_shares = get_total_shares(&e);
        assert!(total_shares > 0, "no liquidity");

        let xlm_out = lp_shares * reserve_xlm / total_shares;
        let usdc_out = lp_shares * reserve_usdc / total_shares;
        assert!(xlm_out >= min_xlm, "slippage: xlm below min");
        assert!(usdc_out >= min_usdc, "slippage: usdc below min");
        assert!(xlm_out > 0 && usdc_out > 0, "insufficient liquidity burned");

        let pool = e.current_contract_address();

        // Burn caller's LP tokens (caller.require_auth covers the nested burn auth)
        token::Client::new(&e, &get_lp_token(&e)).burn(&caller, &lp_shares);

        // Transfer underlying tokens back to caller
        token::Client::new(&e, &get_token_xlm(&e)).transfer(&pool, &caller, &xlm_out);
        token::Client::new(&e, &get_token_usdc(&e)).transfer(&pool, &caller, &usdc_out);

        set_reserves(&e, reserve_xlm - xlm_out, reserve_usdc - usdc_out);
        set_total_shares(&e, total_shares - lp_shares);

        events::emit_withdraw(&e, &caller, xlm_out, usdc_out, lp_shares);
        (xlm_out, usdc_out)
    }

    /// Returns (xlm_reserve, usdc_reserve).
    pub fn get_reserves(e: Env) -> (i128, i128) {
        (get_reserve_xlm(&e), get_reserve_usdc(&e))
    }

    /// Simulates swap output for a given amount_in (read-only, no state change).
    pub fn get_price(e: Env, token_in: Address, amount_in: i128) -> i128 {
        let xlm_addr = get_token_xlm(&e);
        let usdc_addr = get_token_usdc(&e);
        let (reserve_in, reserve_out) = if token_in == xlm_addr {
            (get_reserve_xlm(&e), get_reserve_usdc(&e))
        } else if token_in == usdc_addr {
            (get_reserve_usdc(&e), get_reserve_xlm(&e))
        } else {
            panic!("invalid token_in");
        };
        if reserve_in == 0 || reserve_out == 0 {
            return 0;
        }
        get_amount_out(amount_in, reserve_in, reserve_out)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};
    use stellardex_token::{LpToken, LpTokenClient};

    fn deploy_token(e: &Env, admin: &Address, name: &str, symbol: &str) -> Address {
        let id = e.register(LpToken, ());
        let client = LpTokenClient::new(e, &id);
        client.initialize(
            admin,
            &soroban_sdk::String::from_str(e, name),
            &soroban_sdk::String::from_str(e, symbol),
            &7u32,
        );
        id
    }

    /// Deploys pool + 3 tokens. LP token admin is set to pool address.
    fn setup() -> (Env, Address, Address, Address, Address) {
        let e = Env::default();
        e.mock_all_auths();

        let pool_id = e.register(Pool, ());

        // Deploy XLM mock, USDC mock, LP token
        let xlm_admin = Address::generate(&e);
        let xlm_id = deploy_token(&e, &xlm_admin, "Mock XLM", "XLM");
        let usdc_id = deploy_token(&e, &xlm_admin, "Mock USDC", "USDC");
        // LP token admin = pool (so pool can mint/burn)
        let lp_id = deploy_token(&e, &pool_id, "StellarDex LP", "SDLP");

        let pool_client = PoolClient::new(&e, &pool_id);
        pool_client.initialize(&xlm_id, &usdc_id, &lp_id);

        (e, pool_id, xlm_id, usdc_id, lp_id)
    }

    #[test]
    fn test_deposit_and_get_reserves() {
        let (e, pool_id, xlm_id, usdc_id, lp_id) = setup();
        let pool = PoolClient::new(&e, &pool_id);
        let xlm = LpTokenClient::new(&e, &xlm_id); // using as mock token
        let usdc = LpTokenClient::new(&e, &usdc_id);
        let lp = LpTokenClient::new(&e, &lp_id);

        let _admin = Address::generate(&e);
        let user = Address::generate(&e);

        // Mint test tokens to user
        xlm.mint(&user, &10_000_0000000i128);
        usdc.mint(&user, &10_000_0000000i128);

        // First deposit: 1000 XLM + 400 USDC
        let xlm_in = 1_000_0000000i128;
        let usdc_in = 400_0000000i128;
        let shares = pool.deposit(&user, &xlm_in, &usdc_in, &0, &0);
        assert!(shares > 0);

        let (r_xlm, r_usdc) = pool.get_reserves();
        assert_eq!(r_xlm, xlm_in);
        assert_eq!(r_usdc, usdc_in);
        assert_eq!(lp.balance(&user), shares);
    }

    #[test]
    fn test_swap_xlm_for_usdc() {
        let (e, pool_id, xlm_id, usdc_id, _lp_id) = setup();
        let pool = PoolClient::new(&e, &pool_id);
        let xlm = LpTokenClient::new(&e, &xlm_id);
        let usdc = LpTokenClient::new(&e, &usdc_id);

        let lp_provider = Address::generate(&e);
        let trader = Address::generate(&e);

        xlm.mint(&lp_provider, &10_000_0000000i128);
        usdc.mint(&lp_provider, &10_000_0000000i128);
        pool.deposit(&lp_provider, &10_000_0000000i128, &10_000_0000000i128, &0, &0);

        // Trader swaps 100 XLM for USDC
        xlm.mint(&trader, &100_0000000i128);
        let amount_out = pool.swap(&trader, &xlm_id, &100_0000000i128, &0);
        assert!(amount_out > 0);

        // With 1:1 pool and 0.3% fee on 100 XLM, expect ~99 USDC out (minus impact)
        assert!(amount_out < 100_0000000i128);
        assert!(amount_out > 90_0000000i128);

        // Verify reserves updated
        let (r_xlm, r_usdc) = pool.get_reserves();
        assert_eq!(r_xlm, 10_100_0000000i128);
        assert_eq!(r_usdc, 10_000_0000000i128 - amount_out);
    }

    #[test]
    fn test_deposit_withdraw_round_trip() {
        let (e, pool_id, xlm_id, usdc_id, _lp_id) = setup();
        let pool = PoolClient::new(&e, &pool_id);
        let xlm = LpTokenClient::new(&e, &xlm_id);
        let usdc = LpTokenClient::new(&e, &usdc_id);

        let user = Address::generate(&e);
        xlm.mint(&user, &1_000_0000000i128);
        usdc.mint(&user, &1_000_0000000i128);

        let shares = pool.deposit(&user, &1_000_0000000i128, &1_000_0000000i128, &0, &0);
        let (xlm_back, usdc_back) = pool.withdraw(&user, &shares, &0, &0);

        assert_eq!(xlm_back, 1_000_0000000i128);
        assert_eq!(usdc_back, 1_000_0000000i128);

        let (r_xlm, r_usdc) = pool.get_reserves();
        assert_eq!(r_xlm, 0);
        assert_eq!(r_usdc, 0);
    }

    #[test]
    fn test_get_price() {
        let (e, pool_id, xlm_id, usdc_id, _lp_id) = setup();
        let pool = PoolClient::new(&e, &pool_id);
        let xlm = LpTokenClient::new(&e, &xlm_id);
        let usdc = LpTokenClient::new(&e, &usdc_id);

        let lp_provider = Address::generate(&e);
        let trader = Address::generate(&e);

        // LP provider seeds the pool with 10k XLM + 10k USDC
        xlm.mint(&lp_provider, &10_000_0000000i128);
        usdc.mint(&lp_provider, &10_000_0000000i128);
        pool.deposit(&lp_provider, &10_000_0000000i128, &10_000_0000000i128, &0, &0);

        // get_price is a pure read — does not mutate state
        let price = pool.get_price(&xlm_id, &100_0000000i128);
        assert!(price > 0);

        // Trader does the actual swap and should receive exactly what get_price predicted
        xlm.mint(&trader, &100_0000000i128);
        let actual_out = pool.swap(&trader, &xlm_id, &100_0000000i128, &0);
        assert_eq!(price, actual_out);
    }

    #[test]
    #[should_panic(expected = "slippage")]
    fn test_swap_slippage_protection() {
        let (e, pool_id, xlm_id, usdc_id, _lp_id) = setup();
        let pool = PoolClient::new(&e, &pool_id);
        let xlm = LpTokenClient::new(&e, &xlm_id);
        let usdc = LpTokenClient::new(&e, &usdc_id);

        let user = Address::generate(&e);
        xlm.mint(&user, &10_000_0000000i128);
        usdc.mint(&user, &10_000_0000000i128);
        pool.deposit(&user, &10_000_0000000i128, &10_000_0000000i128, &0, &0);

        xlm.mint(&user, &100_0000000i128);
        // Demand more output than is possible — should panic with "slippage"
        pool.swap(&user, &xlm_id, &100_0000000i128, &200_0000000i128);
    }
}
