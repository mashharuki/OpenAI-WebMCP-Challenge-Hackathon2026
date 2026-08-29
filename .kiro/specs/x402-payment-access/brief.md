# Brief: x402-payment-access

## Problem

Users who value speed need an immediate paid path, but the current x402 weather demo has no browser payer UX and cannot expose private keys to the frontend.

## Current State

The Hono server currently protects `GET /weather` on both Base Sepolia and World Chain Sepolia. The facilitator exposes verify/settle, but there is no injected-wallet client or AdGate resource. The second network is unnecessary risk for the hackathon demo.

## Desired Outcome

A human can explicitly connect an injected wallet, review a small Base Sepolia testnet charge, approve the signature, and let the original premium request retry through verify/settle to a successful result.

## Approach

Retarget the existing x402 server configuration to the premium resource, delete the World Chain payment option, and add an EIP-1193/viem-compatible browser payer adapter. Base Sepolia (`eip155:84532`) is the only accepted network, using the x402 `exact` scheme and testnet USDC. Use the hosted testnet facilitator as the reliable deployment default, surface prerequisites before signing, and keep a clearly labeled recorded fallback for the video if testnet infrastructure is unavailable.

## Scope

- **In**: One Base Sepolia `exact` payment requirement; premium x402 route policy; strict CORS/OPTIONS and header exposure; no-store payment responses; injected-wallet connection and chain-ID enforcement; 402 parsing; signature/retry; settlement receipt; hosted facilitator health check; declined/insufficient-funds/wrong-network/unavailable states; integration tests with mocks.
- **Out**: Mainnet, custodial wallets, fiat purchase, wallet seed handling, auto-pay without human confirmation, and production accounting.

## Boundary Candidates

- Resource-server x402 policy and protected route.
- Browser payment adapter and confirmation UI.
- Facilitator compatibility/configuration validation.

## Out of Boundary

- Does not issue sponsor grants.
- Does not own the WebMCP tool lifecycle.

## Upstream / Downstream

- **Upstream**: adgate-contracts and existing facilitator APIs.
- **Downstream**: webmcp-gated-tool and submission-readiness.

## Existing Spec Touchpoints

- **Extends**: None.
- **Adjacent**: Existing `/weather` config, resourceServer setup, optional self-hosted facilitator network signers, and frontend API configuration.

## Constraints

Base Sepolia only; reject every other chain ID; no bundled private keys; payment requires an explicit user gesture/confirmation; never log signatures or wallet secrets; sponsor flow remains available when wallet/payment is unavailable. Price, network, and asset configuration must have one server-owned source of truth and the UI must render values received from the 402 requirement rather than hard-code them.
