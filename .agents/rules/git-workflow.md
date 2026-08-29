# Git Workflow

## Branching

- `main` is always deployable
- Feature branches: `feat/<ticket-id>-<short-description>`
- Bug fixes: `fix/<ticket-id>-<short-description>`
- Never push directly to `main`

## Commits

- Follow Conventional Commits: `type(scope): description`
- Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `ci`
- Keep commits atomic: one logical change per commit
- Write commit messages in imperative mood: "add feature" not "added feature"

## Pull Requests

- Keep PRs small (under 400 lines of diff when possible)
- Write a clear description: what, why, and how to test
- Link related issues
- Request review from at least one team member
- Squash merge to main

## Code Review

- Review for correctness, readability, and security
- Check test coverage for new code
- Verify no secrets or sensitive data in diff
- Look for performance implications