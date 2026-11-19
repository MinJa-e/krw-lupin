const baseUrl = (process.env.RENDER_BASE_URL || 'https://krw-lupin.onrender.com').replace(/\/+$/, '');
const expectedCommit = process.env.EXPECTED_COMMIT || '';
const timeoutMs = Number(process.env.DEPLOY_VERIFY_TIMEOUT_MS || 12 * 60 * 1000);
const pollIntervalMs = Number(process.env.DEPLOY_VERIFY_INTERVAL_MS || 10 * 1000);
const requestTimeoutMs = 10 * 1000;
const deadline = Date.now() + timeoutMs;
let lastError = 'Render health endpoint has not returned a response yet.';
let lastLogAt = 0;

async function checkDeployment() {
  const healthResponse = await fetch(`${baseUrl}/health`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(requestTimeoutMs)
  });

  if (!healthResponse.ok) {
    throw new Error(`GET /health returned HTTP ${healthResponse.status}`);
  }

  const health = await healthResponse.json();
  if (health.status !== 'ok' || health.service !== 'krw-lupin') {
    throw new Error(`Unexpected health response: ${JSON.stringify(health)}`);
  }

  if (expectedCommit && health.commit !== expectedCommit) {
    throw new Error(`Render is serving ${health.commit || 'an unknown commit'}; waiting for ${expectedCommit}`);
  }

  const socketUrl = new URL('/socket.io/', baseUrl);
  socketUrl.searchParams.set('EIO', '4');
  socketUrl.searchParams.set('transport', 'polling');
  socketUrl.searchParams.set('t', String(Date.now()));
  const socketResponse = await fetch(socketUrl, {
    cache: 'no-store',
    signal: AbortSignal.timeout(requestTimeoutMs)
  });

  if (!socketResponse.ok) {
    throw new Error(`Socket.IO handshake returned HTTP ${socketResponse.status}`);
  }

  const packet = await socketResponse.text();
  if (!packet.startsWith('0{"sid":')) {
    throw new Error(`Unexpected Socket.IO handshake: ${packet.slice(0, 160)}`);
  }

  return health;
}

console.log(`Checking Render deployment at ${baseUrl}`);
if (expectedCommit) console.log(`Waiting for commit ${expectedCommit}`);

while (Date.now() < deadline) {
  try {
    const health = await checkDeployment();
    console.log(`Deployment is healthy: commit=${health.commit || 'unknown'}, Socket.IO handshake=ok`);
    process.exit(0);
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
    if (Date.now() - lastLogAt >= 30 * 1000) {
      console.log(`Deployment is not ready: ${lastError}`);
      lastLogAt = Date.now();
    }
  }

  await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
}

console.error(`Deployment verification timed out after ${Math.round(timeoutMs / 1000)} seconds: ${lastError}`);
process.exit(1);
