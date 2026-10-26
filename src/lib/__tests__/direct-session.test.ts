import axios from 'axios';
import { refreshAsync } from 'expo-auth-session';
import { store } from '../../store';
import { getCredentials, isTokenFresh, replaceAccessToken } from '../oauth';
import directSession from '../direct-session';
import { profileKeyFor } from '../quick-access';
import transactionPayload from '../transaction-payload';
import { initialSplit } from '../../models/transactions';

jest.mock('expo-auth-session', () => ({ refreshAsync: jest.fn() }));
jest.mock('../oauth', () => ({
  discovery: (url: string) => ({ tokenEndpoint: `${url}/oauth/token` }),
  getCredentials: jest.fn(),
  isTokenFresh: jest.fn(),
  replaceAccessToken: jest.fn(),
}));
jest.mock('../../store', () => ({ store: { getState: jest.fn(), dispatch: { configuration: { apiPost: jest.fn() } } } }));

const credential = {
  email: 'one@example.com', backendURL: 'https://firefly.example', accessToken: 'old-access', refreshToken: 'old-refresh', oauthClientId: 'client-one',
};
const profile = profileKeyFor(credential.backendURL, credential.email);
let selectedProfile: string;
const body = () => transactionPayload([initialSplit()]);

beforeEach(() => {
  jest.clearAllMocks();
  selectedProfile = profile;
  axios.defaults.headers.Authorization = 'Bearer old-access';
  (getCredentials as jest.Mock).mockResolvedValue([credential]);
  (isTokenFresh as jest.Mock).mockReturnValue(true);
  (store.getState as jest.Mock).mockImplementation(() => ({ quickAccess: { profileKey: selectedProfile }, configuration: { backendURL: credential.backendURL } }));
  (store.dispatch.configuration.apiPost as unknown as jest.Mock).mockResolvedValue({ data: { id: '42' } });
});

test('binds direct posting to the selected credential and an explicit timeout', async () => {
  const post = await directSession(profile);
  await post(body());
  expect(store.dispatch.configuration.apiPost).toHaveBeenCalledWith(expect.objectContaining({
    config: { headers: { Authorization: 'Bearer old-access' }, timeout: 20000 },
  }));
  expect(refreshAsync).not.toHaveBeenCalled();
});

test('matches the active token when multiple credentials belong to the same user', async () => {
  (getCredentials as jest.Mock).mockResolvedValue([{ ...credential, accessToken: 'revoked-token' }, credential]);
  const post = await directSession(profile);
  await post(body());
  expect(store.dispatch.configuration.apiPost).toHaveBeenCalledWith(expect.objectContaining({ config: expect.objectContaining({ headers: { Authorization: 'Bearer old-access' } }) }));
});

test('persists token rotation and uses the fresh token for the direct request', async () => {
  (isTokenFresh as jest.Mock).mockReturnValue(false);
  (refreshAsync as jest.Mock).mockResolvedValue({
    accessToken: 'fresh-access', refreshToken: 'fresh-refresh', issuedAt: 1000, expiresIn: 3600,
  });
  const post = await directSession(profile);
  await post(body());
  expect(replaceAccessToken).toHaveBeenCalledWith(expect.objectContaining({ refreshToken: 'fresh-refresh' }), 'old-refresh');
  expect(store.dispatch.configuration.apiPost).toHaveBeenCalledWith(expect.objectContaining({ config: expect.objectContaining({ headers: { Authorization: 'Bearer fresh-access' } }) }));
});

test('a profile switch during refresh neither sends a transaction nor overwrites the newly selected token', async () => {
  (isTokenFresh as jest.Mock).mockReturnValue(false);
  (refreshAsync as jest.Mock).mockImplementation(async () => {
    selectedProfile = 'other-profile';
    axios.defaults.headers.Authorization = 'Bearer other-token';
    return { accessToken: 'fresh-old-profile-token', refreshToken: 'fresh-refresh' };
  });
  const post = await directSession(profile);
  expect(() => post(body())).toThrow('quick_access_session_changed');
  expect(axios.defaults.headers.Authorization).toBe('Bearer other-token');
  expect(store.dispatch.configuration.apiPost).not.toHaveBeenCalled();
});

test('does not send when the active credential is unavailable', async () => {
  (getCredentials as jest.Mock).mockResolvedValue([]);
  await expect(directSession(profile)).rejects.toThrow('quick_access_auth_required');
  expect(store.dispatch.configuration.apiPost).not.toHaveBeenCalled();
});
