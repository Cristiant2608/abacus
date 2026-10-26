import {
  ExpenseTemplate, prepareMovement, QuickAccessRequest, validateMovement,
} from './quick-access';
import transactionPayload from './transaction-payload';

type DirectMovementServices = {
  claim: (requestId: string) => Promise<boolean>
  currentProfile: () => string
  post: (body: ReturnType<typeof transactionPayload>) => Promise<unknown>
};

export default async function saveDirectMovement(
  request: QuickAccessRequest,
  templates: ExpenseTemplate[],
  profileKey: string,
  services: DirectMovementServices,
): Promise<string> {
  if (request.operation !== 'save' || !request.templateId || !request.requestId || !request.expiresAt || request.expiresAt <= Date.now()) {
    throw new Error('quick_access_expired');
  }
  const split = prepareMovement(request, templates, profileKey);
  validateMovement(split, true);
  if (services.currentProfile() !== profileKey) throw new Error('quick_access_session_changed');
  if (!(await services.claim(request.requestId))) throw new Error('quick_access_expired');
  // Recheck after the asynchronous claim. A profile switch must never redirect
  // a queued financial operation into the newly selected account.
  if (services.currentProfile() !== profileKey) throw new Error('quick_access_session_changed');
  const response = await services.post(transactionPayload([split], '', request.requestId)) as { data?: { id?: string | number } };
  const id = response?.data?.id;
  if (id === undefined || id === null || String(id) === '') throw new Error('quick_access_save_error');
  return String(id);
}
