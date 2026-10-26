import { refreshAsync } from 'expo-auth-session';
import { replaceAccessToken } from '../oauth';
import refreshCredential from '../refresh-credential';

jest.mock('expo-auth-session', () => ({ refreshAsync: jest.fn() }));
jest.mock('../oauth', () => ({ discovery: (url: string) => ({ tokenEndpoint: `${url}/oauth/token` }), replaceAccessToken: jest.fn() }));
const credential = {
  email: 'user@example.com', backendURL: 'https://firefly.example', accessToken: 'old', refreshToken: 'refresh', oauthClientId: 'client',
};

beforeEach(() => jest.clearAllMocks());

test('coalesces concurrent refreshes and persists the rotated token once', async () => {
  (refreshAsync as jest.Mock).mockResolvedValue({
    accessToken: 'new', refreshToken: 'rotated', issuedAt: 100, expiresIn: 3600,
  });
  const result = await Promise.all([refreshCredential(credential), refreshCredential(credential)]);
  expect(refreshAsync).toHaveBeenCalledTimes(1);
  expect(replaceAccessToken).toHaveBeenCalledTimes(1);
  expect(result[0]).toBe(result[1]);
  expect(result[0].refreshToken).toBe('rotated');
});

test('keeps the previous refresh token when the server does not rotate it', async () => {
  (refreshAsync as jest.Mock).mockResolvedValue({ accessToken: 'new' });
  expect((await refreshCredential(credential)).refreshToken).toBe('refresh');
});

test('clears a failed refresh and isolates users', async () => {
  (refreshAsync as jest.Mock).mockRejectedValueOnce(new Error('unavailable')).mockResolvedValue({ accessToken: 'new' });
  await expect(refreshCredential(credential)).rejects.toThrow('unavailable');
  await Promise.all([refreshCredential(credential), refreshCredential({ ...credential, email: 'other@example.com' })]);
  expect(refreshAsync).toHaveBeenCalledTimes(3);
});
