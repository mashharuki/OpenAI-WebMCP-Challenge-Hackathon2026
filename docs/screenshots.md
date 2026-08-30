# Screenshot checklist

Capture PNG images from the final release SHA at a readable desktop width.
Use English UI/captions, remove unrelated browser tabs and extensions, and do
not expose environment values, tokens, raw signatures, or browser profiles.

## Required set

- [ ] **01-publisher.png — Publisher context.** Open Table Journal branding,
      recipe title, ingredients/instructions, and Analyze action are identifiable.
- [ ] **02-gate-choice.png — Human choice.** The pending analysis, sponsor
      button, Base Sepolia button or safe disabled state, and cancel action are visible.
- [ ] **03-sponsor-path.png — Wallet-free access.** Open Table Weekly owned
      creative and visible countdown/completion state are identifiable.
- [ ] **04-payment-receipt.png — Testnet payment evidence.** Base Sepolia,
      0.01 USDC, shortened transaction hash, amount, asset, and confirmation are
      visible. Mark `recorded local prototype` when not captured from the public app.
- [ ] **05-webmcp-result.png — Original tool result.** The host shows
      `analyze_recipe` returning the canonical summary/insights after the page gate.

## Capture metadata

Record this next to the final files, not in the image itself unless required:

- Release SHA: `TODO`
- Public frontend URL or `local same-release recording`: `TODO`
- Browser/host and version: `TODO`
- Capture date in UTC: `TODO`
- Payment evidence classification (`live public` or `recorded local prototype`): `TODO`

Review every image against [asset-rights.md](./asset-rights.md) before upload.
