/// Integer square root via Babylonian method (floor).
pub fn sqrt(n: i128) -> i128 {
    if n <= 0 {
        return 0;
    }
    let mut x = n;
    let mut y = (x + 1) / 2;
    while y < x {
        x = y;
        y = (x + n / x) / 2;
    }
    x
}

/// Uniswap V2 swap output with 0.3% fee (997/1000).
/// amount_out = (reserve_out * amount_in * 997) / (reserve_in * 1000 + amount_in * 997)
pub fn get_amount_out(amount_in: i128, reserve_in: i128, reserve_out: i128) -> i128 {
    assert!(amount_in > 0, "amount_in must be positive");
    assert!(reserve_in > 0 && reserve_out > 0, "empty reserves");
    let amount_in_with_fee = amount_in * 997;
    let numerator = reserve_out * amount_in_with_fee;
    let denominator = reserve_in * 1000 + amount_in_with_fee;
    numerator / denominator
}

/// LP shares to mint on first deposit: sqrt(xlm * usdc).
/// On subsequent deposits: min(xlm_in * total / reserve_xlm, usdc_in * total / reserve_usdc).
pub fn calc_shares_to_mint(
    xlm_in: i128,
    usdc_in: i128,
    reserve_xlm: i128,
    reserve_usdc: i128,
    total_shares: i128,
) -> i128 {
    if total_shares == 0 {
        // first deposit
        sqrt(xlm_in * usdc_in)
    } else {
        let shares_from_xlm = xlm_in * total_shares / reserve_xlm;
        let shares_from_usdc = usdc_in * total_shares / reserve_usdc;
        if shares_from_xlm < shares_from_usdc {
            shares_from_xlm
        } else {
            shares_from_usdc
        }
    }
}

/// Optimal deposit amount of token_b given desired amount of token_a and current reserves.
/// Keeps the ratio: desired_a / optimal_b = reserve_a / reserve_b
pub fn optimal_deposit(desired_a: i128, reserve_a: i128, reserve_b: i128) -> i128 {
    desired_a * reserve_b / reserve_a
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sqrt() {
        assert_eq!(sqrt(0), 0);
        assert_eq!(sqrt(1), 1);
        assert_eq!(sqrt(4), 2);
        assert_eq!(sqrt(9), 3);
        assert_eq!(sqrt(100), 10);
        assert_eq!(sqrt(2), 1); // floor
        assert_eq!(sqrt(1_000_000), 1000);
    }

    #[test]
    fn test_get_amount_out() {
        // 1000 XLM in, reserves 10_000 XLM / 10_000 USDC
        let out = get_amount_out(1000, 10_000, 10_000);
        // expected: (10000 * 1000 * 997) / (10000 * 1000 + 1000 * 997) = 9_970_000 / 10_997_000 ≈ 906
        assert!(out > 900 && out < 910, "out = {}", out);
    }

    #[test]
    fn test_calc_shares_first_deposit() {
        let shares = calc_shares_to_mint(100, 400, 0, 0, 0);
        assert_eq!(shares, 200); // sqrt(100 * 400) = sqrt(40000) = 200
    }

    #[test]
    fn test_calc_shares_subsequent() {
        // Pool: 1000 XLM / 1000 USDC, 1000 shares
        let shares = calc_shares_to_mint(100, 100, 1000, 1000, 1000);
        assert_eq!(shares, 100);
    }
}
