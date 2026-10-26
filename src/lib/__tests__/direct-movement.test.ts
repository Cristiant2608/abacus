import saveDirectMovement from '../direct-movement';
import { ExpenseTemplate, QuickAccessRequest } from '../quick-access';
import { initialSplit } from '../../models/transactions';

const profile = 'profile-one';
const template: ExpenseTemplate = {
  id: 'template-1',
  name: 'Coffee',
  profileKey: profile,
  split: {
    ...initialSplit(), amount: '3.125', description: 'Coffee', sourceId: 1, sourceName: 'Cash',
  },
};
const request = (): QuickAccessRequest => ({
  action: 'expense',
  operation: 'save',
  templateId: template.id,
  requestId: 'record-1',
  expiresAt: Date.now() + 60000,
});
const services = () => ({
  claim: jest.fn().mockResolvedValue(true),
  currentProfile: () => profile,
  post: jest.fn().mockResolvedValue({ data: { id: '42' } }),
});

test.each(['withdrawal', 'deposit', 'transfer'])('directly saves a complete %s with a receipt, without mutating the template', async (kind) => {
  const item = {
    ...template,
    split: {
      ...template.split, type: kind, destinationId: 2, destinationName: 'Bank',
    },
  };
  const api = services();
  expect(await saveDirectMovement(request(), [item], profile, api)).toBe('42');
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(api.post.mock.calls[0][0]).toMatchObject({ transactions: [{ type: kind, amount: '3.125', external_id: 'record-1' }] });
  expect(item.split.amount).toBe('3.125');
});

test('public prepare links cannot execute a direct save', async () => {
  const api = services();
  await expect(saveDirectMovement({ ...request(), operation: undefined }, [template], profile, api)).rejects.toThrow('quick_access_expired');
  expect(api.post).not.toHaveBeenCalled();
});

test.each([
  { amount: '' }, { amount: '0' }, { description: '' },
  { sourceId: undefined },
  { type: 'deposit', destinationId: undefined, destinationName: '' },
  { type: 'transfer', destinationId: 1, destinationName: 'Cash' },
])('rejects incomplete or invalid data before claiming or sending: %j', async (fields) => {
  const api = services();
  await expect(saveDirectMovement(request(), [{ ...template, split: { ...template.split, ...fields } }], profile, api)).rejects.toThrow();
  expect(api.claim).not.toHaveBeenCalled();
  expect(api.post).not.toHaveBeenCalled();
});

test('does not send an expired, cancelled or already claimed native request', async () => {
  const api = services();
  await expect(saveDirectMovement({ ...request(), expiresAt: Date.now() - 1 }, [template], profile, api)).rejects.toThrow('quick_access_expired');
  api.claim.mockResolvedValue(false);
  await expect(saveDirectMovement(request(), [template], profile, api)).rejects.toThrow('quick_access_expired');
  expect(api.post).not.toHaveBeenCalled();
});

test('does not use a template from another account', async () => {
  const api = services();
  await expect(saveDirectMovement(request(), [{ ...template, profileKey: 'other' }], profile, api)).rejects.toThrow('quick_access_template_missing');
  expect(api.post).not.toHaveBeenCalled();
});

test('rechecks the active account after the asynchronous native claim', async () => {
  const api = services();
  let selected = profile;
  api.currentProfile = () => selected;
  api.claim.mockImplementation(async () => { selected = 'other'; return true; });
  await expect(saveDirectMovement(request(), [template], profile, api)).rejects.toThrow('quick_access_session_changed');
  expect(api.post).not.toHaveBeenCalled();
});

test('does not automatically retry an uncertain network result', async () => {
  const api = services();
  api.post.mockRejectedValue(new Error('network interrupted'));
  await expect(saveDirectMovement(request(), [template], profile, api)).rejects.toThrow('network interrupted');
  expect(api.post).toHaveBeenCalledTimes(1);
});

test('does not report success without a transaction ID from Firefly', async () => {
  const api = services();
  api.post.mockResolvedValue({});
  await expect(saveDirectMovement(request(), [template], profile, api)).rejects.toThrow('quick_access_save_error');
});
