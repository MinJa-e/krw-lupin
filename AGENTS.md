# krw-lupin delivery checks

- Before publishing code, run `npm run build`.
- Push changes to `main` only after those checks pass.
- After a push, wait for the GitHub Actions workflow `Build and verify deployment` to finish. It verifies the production build, waits for Render to serve the pushed commit, checks the Socket.IO handshake, and runs one Chromium smoke test on `https://krw-lupin-web.onrender.com/` for JavaScript errors, avatar detection, and the sit/stand pose.
- Report a deployment as verified only when that workflow succeeds. If it fails, inspect the action log and fix or report the failing check.
