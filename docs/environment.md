# Environment reference

Use host configuration or uncommitted `.env` files. The checked-in
`.env.example` files contain placeholders only. Vite variables are embedded in
the public browser bundle and can never contain secrets.

## Frontend

| Variable | Required | Exposure | Purpose |
| --- | --- | --- | --- |
| `VITE_API_BASE_URL` | Split deployment only | Public | HTTPS resource-server origin; omit for same-origin/local proxy |
| `VITE_ORIGIN_TRIAL_TOKEN` | Public WebMCP release | Public, origin-bound | Token issued for the exact final frontend origin |
| `VITE_RELEASE_SHA` | Public release | Public | Full commit SHA matching the server and recorded evidence |

## Resource server

| Variable | Required | Exposure | Purpose |
| --- | --- | --- | --- |
| `FACILITATOR_URL` | Payment-ready release only | Public configuration | Verified HTTPS facilitator origin; omit/disable payment when unavailable |
| `EVM_ADDRESS` | Payment-ready release only | Public | Base Sepolia testnet USDC `payTo` recipient |
| `ALLOWED_ORIGINS` | Yes | Public configuration | One exact frontend origin; no wildcard, path, or trailing slash |
| `RELEASE_SHA` | Yes | Public | Full deployed commit SHA |

Network, scheme, asset, and amount are fixed in code: Base Sepolia
`eip155:84532`, x402 `exact`, testnet USDC
`0x036CbD53842c5426634e7929541eC2318f3dCF7e`, and 10,000 base units.

## Facilitator

| Variable | Required | Exposure | Purpose |
| --- | --- | --- | --- |
| `EVM_PRIVATE_KEY` | When facilitator runs | **Secret** | Gas-funded Base Sepolia test signer; host secret store only |
| `PORT` | Optional | Public configuration | Local or host-provided listening port |

## Never store or publish

- Wallet private keys or seed phrases
- Sponsor credentials or grant tokens
- Raw x402 signatures/payment payloads
- Provider secrets, production environment dumps, or browser profiles
- Full wallet addresses in screenshots unless intentionally public and reviewed

Before a public build, compare the final values with
[deployment.md](./deployment.md), run `pnpm release:check`, then run the public
smoke probe against the exact deployed origins.
