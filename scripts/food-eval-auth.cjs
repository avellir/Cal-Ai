const readline = require('node:readline/promises');

async function verifyEmailInput(client, email, input, supabaseUrl) {
  const value = input.trim();
  if (/^\d{6,8}$/.test(value)) return client.auth.verifyOtp({ email, token: value, type: 'email' });
  let link;
  try { link = new URL(value); } catch { throw new Error('Paste the email sign-in link or verification code.'); }
  const tokenHash = link.searchParams.get('token_hash') || link.searchParams.get('token');
  if (!tokenHash) throw new Error('Copy the unused sign-in link directly from your email.');
  if (link.origin !== new URL(supabaseUrl).origin || link.pathname !== '/auth/v1/verify') {
    throw new Error('The sign-in link must belong to the configured Supabase project.');
  }
  const type = link.searchParams.get('type');
  if (!['magiclink', 'email', 'signup'].includes(type)) throw new Error('Use the sign-in email requested by this runner.');
  return client.auth.verifyOtp({ token_hash: tokenHash, type: type === 'signup' ? 'signup' : 'email' });
}

async function authenticate(client, email, password, supabaseUrl, ask, options = {}) {
  if (password) {
    const response = await client.auth.signInWithPassword({ email, password });
    if (response.error || !response.data?.session) throw new Error('Password sign-in failed. Remove FOOD_EVAL_PASSWORD to use email sign-in.');
    return;
  }
  const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: options.shouldCreateUser === true } });
  if (error) throw new Error(`Could not send sign-in email (${error.code || 'unknown'}, status ${error.status || 'unknown'}). Check the account and email settings.`);
  console.log('Sign-in email sent. Copy the link address without opening it, or use the code if provided.');
  const input = await ask('Paste the sign-in link or code here (local terminal only): ');
  const response = await verifyEmailInput(client, email, input, supabaseUrl);
  if (response.error || !response.data?.session) throw new Error('Email verification failed. The link/code may have expired or already been used.');
}

async function authenticateInteractive(client, email, password, supabaseUrl, options = {}) {
  if (!password && !process.stdin.isTTY) throw new Error('Run in an interactive terminal to complete email sign-in.');
  const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
  try { await authenticate(client, email, password, supabaseUrl, question => prompt.question(question), options); }
  finally { prompt.close(); }
}

module.exports = { authenticate, authenticateInteractive, verifyEmailInput };
