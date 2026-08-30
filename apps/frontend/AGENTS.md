# Agent Instructions

## Test organization

Keep frontend tests and shared test setup under `test/`, mirroring the relevant `src/` subdirectory where useful. Name test files `*.test.ts` or `*.test.tsx`; do not colocate tests or test support files in `src/`.

## Chrome setup for WebMCP

WebMCP should work out of the box. If it does not:

1. Open `chrome://inspect/#remote-debugging` and enable remote debugging.
2. Open `chrome://flags/#enable-webmcp-testing`, set **WebMCP testing** to **Enabled**, and relaunch Chrome when prompted.
3. Reload the application and try the WebMCP tools again.
