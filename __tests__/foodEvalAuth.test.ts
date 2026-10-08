// The evaluation helper runs directly in Node as CommonJS.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { authenticate, verifyEmailInput } = require('../scripts/food-eval-auth.cjs');

const project = 'https://test.supabase.co';
const session = { access_token: 'test-token' };
function setup() {
  return { auth: {
    signInWithOtp: jest.fn().mockResolvedValue({ error: null }),
    signInWithPassword: jest.fn().mockResolvedValue({ data: { session }, error: null }),
    verifyOtp: jest.fn().mockResolvedValue({ data: { session }, error: null }),
  } };
}

it('signs in an existing passwordless user with a copied email link', async () => {
  const client = setup();
  const ask = jest.fn().mockResolvedValue(`${project}/auth/v1/verify?token=example-hash&type=magiclink`);
  await authenticate(client, 'test@example.com', '', project, ask);
  expect(client.auth.signInWithOtp).toHaveBeenCalledWith({ email: 'test@example.com', options: { shouldCreateUser: false } });
  expect(client.auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'example-hash', type: 'email' });
  expect(client.auth.signInWithPassword).not.toHaveBeenCalled();
});

it('supports a code when the email includes one', async () => {
  const client = setup();
  await verifyEmailInput(client, 'test@example.com', '123456', project);
  expect(client.auth.verifyOtp).toHaveBeenCalledWith({ email: 'test@example.com', token: '123456', type: 'email' });
});

it('allows account creation only when explicitly requested and verifies signup links', async () => {
  const client = setup();
  await authenticate(client, 'test@example.com', '', project,
    async () => `${project}/auth/v1/verify?token=example-hash&type=signup`,
    { shouldCreateUser: true });
  expect(client.auth.signInWithOtp).toHaveBeenCalledWith({ email: 'test@example.com', options: { shouldCreateUser: true } });
  expect(client.auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'example-hash', type: 'signup' });
});

it('rejects recovery links without changing authentication credentials', async () => {
  const client = setup();
  await expect(verifyEmailInput(client, 'test@example.com', `${project}/auth/v1/verify?token=example-hash&type=recovery`, project)).rejects.toThrow('sign-in email');
  expect(client.auth.verifyOtp).not.toHaveBeenCalled();
});

it('rejects links from another project before verification', async () => {
  const client = setup();
  await expect(verifyEmailInput(client, 'test@example.com', 'https://other.supabase.co/auth/v1/verify?token=secret&type=magiclink', project)).rejects.toThrow('configured Supabase');
  expect(client.auth.verifyOtp).not.toHaveBeenCalled();
});

it('does not accept verification without a session', async () => {
  const client = setup();
  client.auth.verifyOtp.mockResolvedValue({ data: { session: null }, error: null });
  await expect(authenticate(client, 'test@example.com', '', project, async () => '123456')).rejects.toThrow('verification failed');
});

it('stops before prompting when the email request fails', async () => {
  const client = setup();
  const ask = jest.fn();
  client.auth.signInWithOtp.mockResolvedValue({ error: { message: 'Rate limited' } });
  await expect(authenticate(client, 'test@example.com', '', project, ask)).rejects.toThrow('Could not send');
  expect(ask).not.toHaveBeenCalled();
});
