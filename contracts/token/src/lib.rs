#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, String, Symbol,
};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    TotalSupply,
    Balance(Address),
    Allowance(Address, Address), // (owner, spender)
    Name,
    Symbol,
    Decimals,
}

fn get_balance(e: &Env, addr: &Address) -> i128 {
    e.storage()
        .persistent()
        .get(&DataKey::Balance(addr.clone()))
        .unwrap_or(0)
}

fn set_balance(e: &Env, addr: &Address, amount: i128) {
    e.storage()
        .persistent()
        .set(&DataKey::Balance(addr.clone()), &amount);
}

fn get_total_supply(e: &Env) -> i128 {
    e.storage()
        .instance()
        .get(&DataKey::TotalSupply)
        .unwrap_or(0)
}

fn set_total_supply(e: &Env, supply: i128) {
    e.storage()
        .instance()
        .set(&DataKey::TotalSupply, &supply);
}

fn get_allowance(e: &Env, owner: &Address, spender: &Address) -> i128 {
    e.storage()
        .temporary()
        .get(&DataKey::Allowance(owner.clone(), spender.clone()))
        .unwrap_or(0)
}

fn emit_transfer(e: &Env, from: &Address, to: &Address, amount: i128) {
    let topics = (Symbol::new(e, "transfer"), from.clone(), to.clone());
    e.events().publish(topics, amount);
}

fn emit_approval(e: &Env, owner: &Address, spender: &Address, amount: i128, expiration_ledger: u32) {
    let topics = (Symbol::new(e, "approve"), owner.clone(), spender.clone());
    e.events().publish(topics, (amount, expiration_ledger));
}

fn emit_mint(e: &Env, admin: &Address, to: &Address, amount: i128) {
    let topics = (symbol_short!("mint"), admin.clone(), to.clone());
    e.events().publish(topics, amount);
}

fn emit_burn(e: &Env, from: &Address, amount: i128) {
    let topics = (symbol_short!("burn"), from.clone());
    e.events().publish(topics, amount);
}

#[contract]
pub struct LpToken;

#[contractimpl]
impl LpToken {
    pub fn initialize(e: Env, admin: Address, name: String, symbol: String, decimals: u32) {
        if e.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        e.storage().instance().set(&DataKey::Admin, &admin);
        e.storage().instance().set(&DataKey::Name, &name);
        e.storage().instance().set(&DataKey::Symbol, &symbol);
        e.storage().instance().set(&DataKey::Decimals, &decimals);
        set_total_supply(&e, 0);
    }

    pub fn admin(e: Env) -> Address {
        e.storage().instance().get(&DataKey::Admin).unwrap()
    }

    // ── SEP-41 interface ──────────────────────────────────────────────────

    pub fn allowance(e: Env, from: Address, spender: Address) -> i128 {
        get_allowance(&e, &from, &spender)
    }

    pub fn approve(e: Env, from: Address, spender: Address, amount: i128, expiration_ledger: u32) {
        from.require_auth();
        if amount < 0 {
            panic!("negative amount");
        }
        e.storage().temporary().set(
            &DataKey::Allowance(from.clone(), spender.clone()),
            &amount,
        );
        emit_approval(&e, &from, &spender, amount, expiration_ledger);
    }

    pub fn balance(e: Env, id: Address) -> i128 {
        get_balance(&e, &id)
    }

    pub fn transfer(e: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        if amount <= 0 {
            panic!("non-positive amount");
        }
        let from_bal = get_balance(&e, &from);
        if from_bal < amount {
            panic!("insufficient balance");
        }
        set_balance(&e, &from, from_bal - amount);
        set_balance(&e, &to, get_balance(&e, &to) + amount);
        emit_transfer(&e, &from, &to, amount);
    }

    pub fn transfer_from(e: Env, spender: Address, from: Address, to: Address, amount: i128) {
        spender.require_auth();
        if amount <= 0 {
            panic!("non-positive amount");
        }
        let allowance = get_allowance(&e, &from, &spender);
        if allowance < amount {
            panic!("insufficient allowance");
        }
        let from_bal = get_balance(&e, &from);
        if from_bal < amount {
            panic!("insufficient balance");
        }
        e.storage().temporary().set(
            &DataKey::Allowance(from.clone(), spender.clone()),
            &(allowance - amount),
        );
        set_balance(&e, &from, from_bal - amount);
        set_balance(&e, &to, get_balance(&e, &to) + amount);
        emit_transfer(&e, &from, &to, amount);
    }

    pub fn burn(e: Env, from: Address, amount: i128) {
        from.require_auth();
        if amount <= 0 {
            panic!("non-positive amount");
        }
        let bal = get_balance(&e, &from);
        if bal < amount {
            panic!("insufficient balance");
        }
        set_balance(&e, &from, bal - amount);
        set_total_supply(&e, get_total_supply(&e) - amount);
        emit_burn(&e, &from, amount);
    }

    pub fn burn_from(e: Env, spender: Address, from: Address, amount: i128) {
        spender.require_auth();
        let allowance = get_allowance(&e, &from, &spender);
        if allowance < amount {
            panic!("insufficient allowance");
        }
        let bal = get_balance(&e, &from);
        if bal < amount {
            panic!("insufficient balance");
        }
        e.storage().temporary().set(
            &DataKey::Allowance(from.clone(), spender.clone()),
            &(allowance - amount),
        );
        set_balance(&e, &from, bal - amount);
        set_total_supply(&e, get_total_supply(&e) - amount);
        emit_burn(&e, &from, amount);
    }

    pub fn decimals(e: Env) -> u32 {
        e.storage().instance().get(&DataKey::Decimals).unwrap()
    }

    pub fn name(e: Env) -> String {
        e.storage().instance().get(&DataKey::Name).unwrap()
    }

    pub fn symbol(e: Env) -> String {
        e.storage().instance().get(&DataKey::Symbol).unwrap()
    }

    pub fn total_supply(e: Env) -> i128 {
        get_total_supply(&e)
    }

    // ── Admin management ─────────────────────────────────────────────────

    /// Transfer admin rights to a new address (e.g. pool contract after deployment).
    pub fn set_admin(e: Env, new_admin: Address) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        e.storage().instance().set(&DataKey::Admin, &new_admin);
    }

    // ── Admin-only: mint (called only by pool contract) ───────────────────

    pub fn mint(e: Env, to: Address, amount: i128) {
        let admin: Address = e.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        if amount <= 0 {
            panic!("non-positive amount");
        }
        set_balance(&e, &to, get_balance(&e, &to) + amount);
        set_total_supply(&e, get_total_supply(&e) + amount);
        emit_mint(&e, &admin, &to, amount);
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    fn setup() -> (Env, Address, Address) {
        let e = Env::default();
        e.mock_all_auths();
        let admin = Address::generate(&e);
        let contract_id = e.register(LpToken, ());
        let client = LpTokenClient::new(&e, &contract_id);
        client.initialize(
            &admin,
            &String::from_str(&e, "StellarDex LP"),
            &String::from_str(&e, "SDLP"),
            &7u32,
        );
        (e, contract_id, admin)
    }

    #[test]
    fn test_mint_and_balance() {
        let (e, contract_id, _admin) = setup();
        let client = LpTokenClient::new(&e, &contract_id);
        let user = Address::generate(&e);
        client.mint(&user, &1_000_0000000i128);
        assert_eq!(client.balance(&user), 1_000_0000000i128);
        assert_eq!(client.total_supply(), 1_000_0000000i128);
    }

    #[test]
    fn test_transfer() {
        let (e, contract_id, _admin) = setup();
        let client = LpTokenClient::new(&e, &contract_id);
        let alice = Address::generate(&e);
        let bob = Address::generate(&e);
        client.mint(&alice, &500_0000000i128);
        client.transfer(&alice, &bob, &200_0000000i128);
        assert_eq!(client.balance(&alice), 300_0000000i128);
        assert_eq!(client.balance(&bob), 200_0000000i128);
    }

    #[test]
    fn test_burn() {
        let (e, contract_id, _admin) = setup();
        let client = LpTokenClient::new(&e, &contract_id);
        let user = Address::generate(&e);
        client.mint(&user, &1_000_0000000i128);
        client.burn(&user, &400_0000000i128);
        assert_eq!(client.balance(&user), 600_0000000i128);
        assert_eq!(client.total_supply(), 600_0000000i128);
    }

    #[test]
    fn test_approve_and_transfer_from() {
        let (e, contract_id, _admin) = setup();
        let client = LpTokenClient::new(&e, &contract_id);
        let alice = Address::generate(&e);
        let bob = Address::generate(&e);
        let charlie = Address::generate(&e);
        client.mint(&alice, &500_0000000i128);
        client.approve(&alice, &bob, &300_0000000i128, &1000u32);
        client.transfer_from(&bob, &alice, &charlie, &200_0000000i128);
        assert_eq!(client.balance(&alice), 300_0000000i128);
        assert_eq!(client.balance(&charlie), 200_0000000i128);
        assert_eq!(client.allowance(&alice, &bob), 100_0000000i128);
    }
}
