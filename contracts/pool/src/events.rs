use soroban_sdk::{symbol_short, Address, Env};

pub fn emit_deposit(
    e: &Env,
    caller: &Address,
    xlm_in: i128,
    usdc_in: i128,
    lp_minted: i128,
) {
    let topics = (symbol_short!("deposit"), caller.clone());
    e.events().publish(topics, (xlm_in, usdc_in, lp_minted));
}

pub fn emit_swap(
    e: &Env,
    caller: &Address,
    token_in: &Address,
    amount_in: i128,
    amount_out: i128,
) {
    let topics = (symbol_short!("swap"), caller.clone(), token_in.clone());
    e.events().publish(topics, (amount_in, amount_out));
}

pub fn emit_withdraw(
    e: &Env,
    caller: &Address,
    xlm_out: i128,
    usdc_out: i128,
    lp_burned: i128,
) {
    let topics = (symbol_short!("withdraw"), caller.clone());
    e.events().publish(topics, (xlm_out, usdc_out, lp_burned));
}
