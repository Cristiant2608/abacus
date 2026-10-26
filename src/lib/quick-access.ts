import { initialSplit, TransactionSplitType } from '../models/transactions';

export type ExpenseTemplate = {
  id: string
  name: string
  profileKey: string
  split: TransactionSplitType
};

export type QuickAccessRequest = {
  action: 'expense' | 'templates'
  templateId?: string
  amount?: string
  description?: string
  requestId?: string
};

export const profileKeyFor = (backendURL: string, email: string) => JSON.stringify([
  backendURL.trim().replace(/\/+$/, ''), email.trim().toLowerCase(),
]);

export const normalizeExpenseAmount = (value: string): string => {
  const amount = value.trim().replace(',', '.');
  if (!/^\d+(?:\.\d+)?$/.test(amount) || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    throw new Error('quick_access_invalid_amount');
  }
  return amount;
};

export function parseQuickAccessURL(url: string, scheme: string): QuickAccessRequest | null {
  // OAuth callbacks and unrelated links must never enter the capture flow.
  if (!url.startsWith(`${scheme}://quick/`)) return null;
  // React Native's built-in URL implementation only parses HTTP host/path
  // getters correctly. Parse this deliberately small custom-scheme format
  // directly so the same contract works on Hermes and in Node tests.
  const match = url.slice(`${scheme}://quick/`.length).match(/^(expense|templates)\?([^#]+)$/);
  if (!match || url.length > 4096) throw new Error('quick_access_invalid_link');
  const action = match[1] as QuickAccessRequest['action'];
  const params = new Map<string, string>();
  const allowed = ['v', 'templateId', 'amount', 'description', 'requestId'];
  match[2].split('&').forEach((part) => {
    const separator = part.indexOf('=');
    if (separator < 1) throw new Error('quick_access_invalid_link');
    let key: string;
    let value: string;
    try {
      key = decodeURIComponent(part.slice(0, separator).replace(/\+/g, ' '));
      value = decodeURIComponent(part.slice(separator + 1).replace(/\+/g, ' '));
    } catch { throw new Error('quick_access_invalid_link'); }
    if (!allowed.includes(key) || params.has(key) || value.length > 500) {
      throw new Error('quick_access_invalid_link');
    }
    params.set(key, value);
  });
  if (params.get('v') !== '1') throw new Error('quick_access_invalid_link');
  const templateId = params.get('templateId') || undefined;
  if (templateId && !/^[a-zA-Z0-9-]{1,64}$/.test(templateId)) throw new Error('quick_access_invalid_link');
  const amount = params.get('amount');
  return {
    action,
    templateId,
    ...(amount !== undefined && { amount: normalizeExpenseAmount(amount) }),
    ...(params.has('description') && { description: params.get('description') }),
    requestId: params.get('requestId') || undefined,
  };
}

export function quickAccessURL(scheme: string, request: QuickAccessRequest): string {
  const query = ['v=1'];
  ['templateId', 'amount', 'description', 'requestId'].forEach((key) => {
    if (request[key] !== undefined) query.push(`${key}=${encodeURIComponent(request[key])}`);
  });
  return `${scheme}://quick/${request.action}?${query.join('&')}`;
}

export function prepareExpense(
  request: QuickAccessRequest,
  templates: ExpenseTemplate[],
  profileKey: string,
): TransactionSplitType {
  const template = request.templateId ? templates.find((item) => item.id === request.templateId && item.profileKey === profileKey) : null;
  if (request.templateId && !template) throw new Error('quick_access_template_missing');
  return {
    ...initialSplit(),
    ...template?.split,
    tags: [...(template?.split.tags || [])],
    type: 'withdrawal',
    date: new Date(),
    ...(request.amount !== undefined && { amount: normalizeExpenseAmount(request.amount) }),
    ...(request.description !== undefined && { description: request.description }),
  };
}

export class QuickAccessQueue {
  private pending: QuickAccessRequest[] = [];

  private seen = new Set<string>();

  private lastURL = '';

  private lastReceived = 0;

  enqueue(url: string, scheme: string, now = Date.now()): boolean {
    const request = parseQuickAccessURL(url, scheme);
    if (!request) return false;
    if ((request.requestId && this.seen.has(request.requestId)) || (url === this.lastURL && now - this.lastReceived < 1500)) return false;
    this.lastURL = url;
    this.lastReceived = now;
    if (request.requestId) {
      this.seen.add(request.requestId);
      if (this.seen.size > 100) this.seen.delete(this.seen.values().next().value);
    }
    // Only retain a small number of explicit user requests in memory.
    this.pending = [...this.pending.slice(-4), request];
    return true;
  }

  shift(): QuickAccessRequest | undefined {
    return this.pending.shift();
  }
}
