# Human release and submission checklist

This is the final human-owned release record. Repository commands may verify
local or public read-only boundaries, but they never upload, publish, connect a
wallet, or submit to Devpost.

## Deadline and release identity

- Internal deadline: **2026-09-04 03:00 JST**
- Official deadline: **2026-09-04 05:00 JST**
- [ ] Freeze non-blocker changes before recording the candidate.
- [ ] Record the full candidate commit SHA: `TODO`
- [ ] Record the public frontend URL: `TODO`
- [ ] Record the public resource-server URL: `TODO`
- [ ] Record the optional facilitator URL or `disabled`: `TODO`
- [ ] Confirm the deployment, screenshots, video, README, and Devpost copy all
      identify the same full release SHA.

If a blocker requires a code change, record its owning upstream specification
and rerun the complete release gate before replacing the candidate SHA.

## Automated prerequisites

- [ ] Run `pnpm release:check` from the frozen candidate and retain its final
      `GO` output without environment values.
- [ ] Run the public read-only probe against the final origins:

  ```bash
  pnpm smoke:public -- \
    --frontend-url https://FRONTEND.example \
    --server-url https://SERVER.example \
    --facilitator-url https://FACILITATOR.example
  ```

- [ ] Confirm the probe reports HTTPS, exact-origin CORS, `no-store`, hidden
      production preview, Origin Trial presence, and a working sponsor path.
- [ ] Confirm the public repository resolves, exposes the root MIT license, and
      contains no committed `.env` file, token, key, seed phrase, or signature.

## Required real-host sponsor checks

Run both journeys from the final public URL. Do not treat fake-host E2E as a
replacement.

### ChatGPT supported browser

- [ ] Open the public publisher and confirm `analyze_recipe` is discoverable.
- [ ] Invoke it once and confirm the original invocation remains pending while
      the page shows the access choice.
- [ ] Choose sponsor access, keep the sponsor visible for eight seconds, and
      confirm the original invocation returns exactly one canonical result.
- [ ] Repeat cancellation once and confirm it does not display success.
- Evidence note or screenshot path: `TODO`
- Browser/host version and UTC verification time: `TODO`

### WebMCP-enabled Chrome

- [ ] Confirm the Origin Trial is active for the exact public origin.
- [ ] Repeat the pending → sponsor → original-result journey.
- [ ] Confirm refreshing or aborting an active invocation ends safely and a new
      attempt can start.
- Evidence note or screenshot path: `TODO`
- Chrome version and UTC verification time: `TODO`

## Keyboard and accessibility

- [ ] Complete the sponsor path using only Tab, Shift+Tab, Enter, and Space.
- [ ] Confirm focus enters the gate, remains visible, and returns to a sensible
      control after cancel or completion.
- [ ] Confirm status/countdown/result changes are announced by the live region
      without repeatedly interrupting the user.
- [ ] Confirm sponsor and payment choices expose understandable accessible names,
      disabled states, and error text.
- [ ] Check the final UI at 200% zoom without losing the primary actions.
- Evidence note and tested browser/assistive technology: `TODO`

## Optional Base Sepolia payment proof

This path is optional for the sponsor-live release, but its public state must be
truthful.

- [ ] Classify payment evidence as exactly one of: `live public`,
      `recorded local prototype`, or `disabled — no proof submitted`: `TODO`
- [ ] Initiate wallet access only from a human click after Base Sepolia and
      0.01 testnet USDC terms are visible.
- [ ] Use a disposable testnet wallet and confirm the normalized receipt shows
      network, asset, amount, shortened transaction hash/explorer link, and time.
- [ ] Confirm the same request executes once and no raw payment payload, full
      wallet details, private key, or signature appears in evidence.
- [ ] If the hosted facilitator is not verified, disable payment in the public
      app and use only a same-release local clip with the persistent caption
      **recorded local prototype**.
- Evidence note or clip timestamp: `TODO`

## Draft, screenshots, video, and rights

- [ ] Confirm the title and one-line summary in
      [`devpost-submission.md`](../devpost-submission.md).
- [ ] Replace the README and Devpost public-app placeholders with the final URL.
- [ ] Capture all five images in [`screenshots.md`](./screenshots.md) from the
      final release and fill their capture metadata.
- [ ] Complete [`asset-rights.md`](./asset-rights.md); remove any unverified
      material and unrelated browser/profile information.
- [ ] Record the English demo from [`demo-video.md`](./demo-video.md), verify the
      exported and uploaded duration is below three minutes, and confirm any
      local payment clip is labeled accurately.
- [ ] Upload the video manually and record its public YouTube URL: `TODO`
- [ ] Confirm every public link from a signed-out browser.
- [ ] Check that no evidence contains tokens, signatures, keys, seed phrases,
      environment dumps, full private wallet details, or unrelated profiles.

## Devpost human sign-off

- [ ] Copy only fields present in the live official Devpost form.
- [ ] Confirm project, team/profile, repository, MIT license, live app, and
      public YouTube fields are complete and truthful.
- [ ] Review all text, media, links, and the final Devpost preview manually.
- [ ] Submit manually before the internal deadline.
- [ ] Open the resulting public project page and verify it is viewable.
- Public Devpost project URL after submission: `TODO`
- Human sign-off name/initials and UTC time: `TODO`

Do not check off Task 6 in `.kiro/specs/submission-readiness/tasks.md` until
every required item above is complete. No repository command performs the
final publication or submission.
