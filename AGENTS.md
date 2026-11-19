# krw-lupin delivery checks

- Before publishing code, run `npm run build`, `npm run build:e2e`, and `npm run test:e2e`.
- Push changes to `main` only after those checks pass.
- After a push, wait for the GitHub Actions workflow `Build and verify deployment` to finish. It verifies the production build, checks the sit pose progress in Chromium, waits for Render to serve the pushed commit, checks the Socket.IO handshake, and smoke-tests `https://krw-lupin-web.onrender.com/` in Chromium.
- Report a deployment as verified only when that workflow succeeds. If it fails, inspect the action log and fix or report the failing check.
