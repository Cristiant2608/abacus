import * as SecureStore from 'expo-secure-store';
import { replaceAccessToken } from '../oauth';

jest.mock('expo-auth-session', () => ({ makeRedirectUri: () => 'test://redirect' }));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn() }));

const original = {
  email: 'one@example.com', backendURL: 'https://firefly.example', accessToken: 'old-access', refreshToken: 'old-refresh',
};
const other = { ...original, email: 'other@example.com', accessToken: 'other-access' };

test('persists rotated access and refresh tokens against the original credential', async () => {
  (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify([original, other]));
  await replaceAccessToken({ ...original, accessToken: 'new-access', refreshToken: 'new-refresh' }, original.refreshToken);
  const saved = JSON.parse((SecureStore.setItemAsync as jest.Mock).mock.calls.at(-1)[1]);
  expect(saved[0]).toMatchObject({ accessToken: 'new-access', refreshToken: 'new-refresh' });
  expect(saved[1]).toEqual(other);
});

test('keeps the old refresh token when the provider does not rotate it', async () => {
  (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify([original]));
  await replaceAccessToken({ ...original, accessToken: 'new-access', refreshToken: undefined }, original.refreshToken);
  const saved = JSON.parse((SecureStore.setItemAsync as jest.Mock).mock.calls.at(-1)[1]);
  expect(saved[0].refreshToken).toBe('old-refresh');
});
