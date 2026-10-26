import axios from 'axios';
import { getCredentials } from '../oauth';
import refreshCredential from '../refresh-credential';
import fireflyReader from '../firefly-read';
import { profileKeyFor } from '../quick-access';
import transactionPayload from '../transaction-payload';
import { initialSplit } from '../../models/transactions';

jest.mock('axios', () => ({ defaults: { headers: { Authorization: 'Bearer old' } }, get: jest.fn() }));
jest.mock('../oauth', () => ({ getCredentials: jest.fn() }));
jest.mock('../refresh-credential', () => ({ __esModule: true, default: jest.fn() }));
const credential = {
  backendURL: 'https://firefly.example', email: 'user@example.com', accessToken: 'old', refreshToken: 'refresh',
};
const profile = profileKeyFor(credential.backendURL, credential.email);

beforeEach(() => {
  jest.clearAllMocks();
  axios.defaults.headers.Authorization = 'Bearer old';
  (getCredentials as jest.Mock).mockResolvedValue([credential]);
  (refreshCredential as jest.Mock).mockResolvedValue({ ...credential, accessToken: 'new' });
});

test('retries only a 401 read once with the fresh token', async () => {
  (axios.get as jest.Mock).mockRejectedValueOnce({ response: { status: 401 } }).mockResolvedValue({ data: { data: [] } });
  const read = fireflyReader(credential.backendURL, profile, 'Bearer old', () => true);
  await read('/api/v1/transactions');
  expect(axios.get).toHaveBeenCalledTimes(2);
  expect(axios.get).toHaveBeenLastCalledWith('https://firefly.example/api/v1/transactions', expect.objectContaining({ headers: { Authorization: 'Bearer new' } }));
});

test('does not retry a server error or overwrite another session during refresh', async () => {
  (axios.get as jest.Mock).mockRejectedValue({ response: { status: 500 } });
  const read = fireflyReader(credential.backendURL, profile, 'Bearer old', () => true);
  await expect(read('/api/v1/transactions')).rejects.toEqual({ response: { status: 500 } });
  expect(refreshCredential).not.toHaveBeenCalled();
  (axios.get as jest.Mock).mockRejectedValue({ response: { status: 401 } });
  let active = true;
  (refreshCredential as jest.Mock).mockImplementation(async () => {
    active = false;
    axios.defaults.headers.Authorization = 'Bearer other';
    return { ...credential, accessToken: 'new' };
  });
  const currentRead = fireflyReader(credential.backendURL, profile, 'Bearer old', () => active);
  await expect(currentRead('/api/v1/transactions')).rejects.toThrow('session_changed');
  expect(axios.defaults.headers.Authorization).toBe('Bearer other');
});

test('normal transaction payloads preserve decimal strings and foreign amounts', () => {
  const body = transactionPayload([{ ...initialSplit(), amount: '9007199254740993,00000001', foreignAmount: '0,00000003' }]);
  expect(body.transactions[0].amount).toBe('9007199254740993.00000001');
  expect(body.transactions[0].foreign_amount).toBe('0.00000003');
});
