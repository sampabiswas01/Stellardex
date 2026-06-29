use soroban_sdk::{contracttype, Address, Env};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    TokenXlm,
    TokenUsdc,
    LpToken,
    ReserveXlm,
    ReserveUsdc,
    TotalShares,
    Initialized,
}

pub fn is_initialized(e: &Env) -> bool {
    e.storage().instance().has(&DataKey::Initialized)
}

pub fn set_initialized(e: &Env) {
    e.storage().instance().set(&DataKey::Initialized, &true);
}

pub fn get_token_xlm(e: &Env) -> Address {
    e.storage().instance().get(&DataKey::TokenXlm).unwrap()
}

pub fn get_token_usdc(e: &Env) -> Address {
    e.storage().instance().get(&DataKey::TokenUsdc).unwrap()
}

pub fn get_lp_token(e: &Env) -> Address {
    e.storage().instance().get(&DataKey::LpToken).unwrap()
}

pub fn get_reserve_xlm(e: &Env) -> i128 {
    e.storage()
        .instance()
        .get(&DataKey::ReserveXlm)
        .unwrap_or(0)
}

pub fn get_reserve_usdc(e: &Env) -> i128 {
    e.storage()
        .instance()
        .get(&DataKey::ReserveUsdc)
        .unwrap_or(0)
}

pub fn get_total_shares(e: &Env) -> i128 {
    e.storage()
        .instance()
        .get(&DataKey::TotalShares)
        .unwrap_or(0)
}

pub fn set_reserves(e: &Env, xlm: i128, usdc: i128) {
    e.storage().instance().set(&DataKey::ReserveXlm, &xlm);
    e.storage().instance().set(&DataKey::ReserveUsdc, &usdc);
}

pub fn set_total_shares(e: &Env, shares: i128) {
    e.storage().instance().set(&DataKey::TotalShares, &shares);
}

pub fn set_tokens(e: &Env, xlm: &Address, usdc: &Address, lp: &Address) {
    e.storage().instance().set(&DataKey::TokenXlm, xlm);
    e.storage().instance().set(&DataKey::TokenUsdc, usdc);
    e.storage().instance().set(&DataKey::LpToken, lp);
}
