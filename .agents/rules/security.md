# Security Rules

## Input Validation

- Validate ALL external inputs at system boundaries (API endpoints, form submissions, URL params)
- Use zod schemas for runtime validation
- Never trust client-side validation alone
- Sanitize HTML output to prevent XSS

## Secrets

- Never hardcode secrets, API keys, or passwords
- Use environment variables for all sensitive values
- Never log secrets, tokens, or passwords
- Never include secrets in error messages or stack traces

## Authentication & Authorization

- Check authentication on every protected route
- Check authorization (permissions) after authentication
- Use constant-time comparison for token validation
- Implement rate limiting on auth endpoints

## Database

- Always use parameterized queries (never string concatenation)
- Apply least-privilege principle for DB connections
- Validate and sanitize all user inputs before queries
- Use transactions for multi-step operations

## Dependencies

- Audit dependencies regularly (`npm audit`)
- Pin dependency versions in production
- Review new dependencies before adding (check maintainership, download stats, known vulnerabilities)

## HTTP

- Set security headers (CSP, HSTS, X-Frame-Options)
- Use HTTPS everywhere
- Validate redirect URLs to prevent open redirects
- Set appropriate CORS policies