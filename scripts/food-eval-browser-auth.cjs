const http = require('node:http');
const { randomBytes } = require('node:crypto');
const { authenticate } = require('./food-eval-auth.cjs');

// Loopback only. Credentials are submitted directly to the runner and never logged.
async function authenticateInBrowser(client, email, supabaseUrl, options = {}) {
  const nonce = randomBytes(32).toString('hex');
  let submit;
  let rejectInput;
  let pendingResponse;
  let submitted = false;
  const input = new Promise((resolve, reject) => { submit = resolve; rejectInput = reject; });
  // Attach a handler immediately; authentication can fail before asking for input.
  input.catch(() => {});
  let origin;
  const server = http.createServer(async (request, response) => {
    const send = (status, body) => {
      response.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'" });
      response.end(body);
    };
    if (request.headers.host !== new URL(origin).host) { send(403, 'Invalid host.'); return; }
    if (request.method === 'GET' && request.url === '/') {
      send(200, `<!doctype html><html lang="en"><meta charset="utf-8"><title>Cal AI photo test sign-in</title>
        <style>body{font:18px system-ui;max-width:640px;margin:70px auto;padding:24px}textarea{box-sizing:border-box;width:100%;font:16px system-ui;padding:12px}button{padding:12px 20px;margin-top:16px;font:inherit}p{line-height:1.6}</style>
        <h1>Sign in for the food photo tests</h1><p>Check the sign-in email sent by Cal AI. Copy the unused link address without opening it, or copy the verification code.</p>
        <form action="/verify" method="post"><input type="hidden" name="nonce" value="${nonce}">
        <label for="credential">Email sign-in link or code</label><textarea id="credential" name="credential" rows="4" required autocomplete="off"></textarea>
        <button type="submit">Verify and start the 14 photo tests</button></form>
        <p>This page runs on your computer. The test session stays in memory.</p></html>`);
      return;
    }
    if (request.method !== 'POST' || request.url !== '/verify') { send(404, 'Not found.'); return; }
    if (request.headers.origin !== origin || submitted) { send(403, 'Invalid or already submitted request.'); return; }
    try {
      let body = '';
      for await (const chunk of request) {
        body += chunk;
        if (body.length > 16000) { send(413, 'Input too large.'); return; }
      }
      const form = new URLSearchParams(body);
      if (form.get('nonce') !== nonce) { send(403, 'Invalid form.'); return; }
      submitted = true;
      pendingResponse = { send };
      submit(form.get('credential') || '');
    } catch {
      send(400, 'Could not read input.');
    }
  });
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(options.port ?? 8766, '127.0.0.1', resolve);
    });
    origin = `http://127.0.0.1:${server.address().port}`;
    const timeout = setTimeout(() => rejectInput(new Error('Sign-in timed out. Run the photo evaluation again.')), 15 * 60 * 1000);
    try {
      await authenticate(client, email, '', supabaseUrl, async () => {
        console.log(`Complete email sign-in locally: ${origin}`);
        return input;
      }, options);
      pendingResponse?.send(200, '<!doctype html><title>Cal AI tests started</title><h1>Signed in successfully</h1><p>The food photo tests are running. You can close this page.</p>');
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    pendingResponse?.send(400, '<!doctype html><title>Cal AI sign-in failed</title><h1>Sign-in failed</h1><p>Request a new sign-in email by restarting the photo test runner.</p>');
    throw error;
  } finally {
    await new Promise(resolve => server.close(resolve));
    server.closeIdleConnections();
  }
}

module.exports = { authenticateInBrowser };
