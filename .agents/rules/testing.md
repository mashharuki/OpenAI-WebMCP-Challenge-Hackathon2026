# Testing Conventions

## Structure

- Test files next to source: `foo.ts` → `foo.test.ts`
- Use `describe` for grouping, `it` for individual cases
- Name tests as: `it('should <expected behavior> when <condition>')`

## What to Test

- Happy path: expected inputs produce expected outputs
- Edge cases: empty inputs, boundary values, null/undefined
- Error cases: invalid inputs, network failures, timeouts
- Integration points: API calls, DB queries (use mocks)

## What NOT to Test

- Implementation details (private methods, internal state)
- Third-party library internals
- Trivial getters/setters

## Mocking

- Mock at module boundaries, not internal functions
- Prefer dependency injection over module mocking
- Reset mocks in `beforeEach` or `afterEach`
- Use `vi.fn()` (Vitest) or `jest.fn()` for spy/stub

## Test Data

- Use factory functions for test data, not raw objects
- Keep test data minimal: only set fields relevant to the test
- Never use production data or real credentials in tests