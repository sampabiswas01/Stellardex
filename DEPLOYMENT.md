# Deployment — Stellar Testnet

StellarDex contracts deployed and initialized on the Stellar **Testnet**
(`Test SDF Network ; September 2015`).

## Contract addresses

| Contract | Address | Explorer |
|----------|---------|----------|
| **Pool (AMM)** | `CDV2ERHHD5JH3NBUCSKTMVQ6MTE5KP4GRGH7RHZHNLASS3YBZS6CUTRC` | [view](https://stellar.expert/explorer/testnet/contract/CDV2ERHHD5JH3NBUCSKTMVQ6MTE5KP4GRGH7RHZHNLASS3YBZS6CUTRC) |
| **LP Token** | `CCIARPEUKTBMHZUI2OYXAUO3WFL5DUOGGGYVSLTCFQVC7BIW7LE53DCU` | [view](https://stellar.expert/explorer/testnet/contract/CCIARPEUKTBMHZUI2OYXAUO3WFL5DUOGGGYVSLTCFQVC7BIW7LE53DCU) |
| XLM SAC | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` | [view](https://stellar.expert/explorer/testnet/contract/CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC) |
| USDC SAC (Circle testnet) | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` | [view](https://stellar.expert/explorer/testnet/contract/CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA) |

**Deployer account:** `GDWVKV2HDQL7GEUIJIIPRBVU5SCUZVSD252GNIDRELOD3IHABFG55JZJ`

## Transaction hashes (contract interactions)

| Action | Transaction hash | Explorer |
|--------|------------------|----------|
| LP token — install WASM | `d0107a16187b6601f7919c0c65777591ff5bced2bacb724ba1229dbe6cacc996` | [tx](https://stellar.expert/explorer/testnet/tx/d0107a16187b6601f7919c0c65777591ff5bced2bacb724ba1229dbe6cacc996) |
| LP token — deploy | `d917b320e0a4e0e75dd6b74c4f9693c63ef0858f325ec321d3d640fe43667fa3` | [tx](https://stellar.expert/explorer/testnet/tx/d917b320e0a4e0e75dd6b74c4f9693c63ef0858f325ec321d3d640fe43667fa3) |
| LP token — `initialize` | `637c107ac52db146e486abc56a943fa795ef840607e2b52b06141a559828607b` | [tx](https://stellar.expert/explorer/testnet/tx/637c107ac52db146e486abc56a943fa795ef840607e2b52b06141a559828607b) |
| Pool — deploy | `995ac8f2fe6f39354ce7671dececef199d8fadc9be5fcc42415968a52f2ea46c` | [tx](https://stellar.expert/explorer/testnet/tx/995ac8f2fe6f39354ce7671dececef199d8fadc9be5fcc42415968a52f2ea46c) |
| Pool — `initialize` | `6f22cea5508276e9a2de4f26626dc2eef69a79ea883a5a0dff565b7bbc7cf433` | [tx](https://stellar.expert/explorer/testnet/tx/6f22cea5508276e9a2de4f26626dc2eef69a79ea883a5a0dff565b7bbc7cf433) |
| LP token — `set_admin` → Pool | `6731f701c9bac706bba5655f8437168c1baeeaf11e6cf63459af8464f69a0928` | [tx](https://stellar.expert/explorer/testnet/tx/6731f701c9bac706bba5655f8437168c1baeeaf11e6cf63459af8464f69a0928) |

## Verification

Read the pool reserves directly via the Stellar CLI:

```bash
stellar contract invoke \
  --id CDV2ERHHD5JH3NBUCSKTMVQ6MTE5KP4GRGH7RHZHNLASS3YBZS6CUTRC \
  --network testnet --source <your-identity> \
  -- get_reserves
# => ["0","0"]   (initialized, no liquidity yet)
```

## Frontend configuration

Set these in `frontend/.env.local`:

```
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
NEXT_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
NEXT_PUBLIC_POOL_CONTRACT_ID=CDV2ERHHD5JH3NBUCSKTMVQ6MTE5KP4GRGH7RHZHNLASS3YBZS6CUTRC
NEXT_PUBLIC_LP_TOKEN_CONTRACT_ID=CCIARPEUKTBMHZUI2OYXAUO3WFL5DUOGGGYVSLTCFQVC7BIW7LE53DCU
NEXT_PUBLIC_XLM_CONTRACT_ID=CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
NEXT_PUBLIC_USDC_CONTRACT_ID=CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA
```
