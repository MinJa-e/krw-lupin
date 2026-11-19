# krw-lupin delivery checks

- Before publishing code, run `npm run build`, `npm run build:e2e`, and `npm run test:e2e`.
- Push changes to `main` only after those checks pass.
- After a push, wait for the GitHub Actions workflow `Build and verify deployment` to finish. It verifies the production build, checks the sit/stand controls in Chromium, waits for Render to serve the pushed commit, and checks the Socket.IO handshake.
- Report a deployment as verified only when that workflow succeeds. If it fails, inspect the action log and fix or report the failing check.
- To run the browser smoke check against the deployed frontend, set the GitHub repository variable `KRW_LUPIN_FRONTEND_URL` to its public URL. Until that is configured, the workflow checks the built client locally and verifies the Render server separately.
