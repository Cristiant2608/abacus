import {
  normalizeExpenseAmount, parseQuickAccessURL, prepareExpense, profileKeyFor,
  QuickAccessQueue, quickAccessURL, ExpenseTemplate, canPresentQuickAccess,
} from '../quick-access';
import { initialSplit } from '../../models/transactions';

const scheme = 'abacus-personal';
const profile = profileKeyFor('https://firefly.example', 'person@example.com');
const template: ExpenseTemplate = {
  id: 'template-1',
  name: 'Coffee',
  profileKey: profile,
  split: {
    ...initialSplit(), amount: '4.50', description: 'Coffee', sourceName: 'Cash', tags: ['daily'], date: '2000-01-01',
  },
};

describe('expense links and requests', () => {
  test.each([
    [[], false], [['credentials'], false], [['dashboard'], true],
    [['dashboard', 'QuickAccessScreen'], true],
    [['dashboard', 'QuickExpenseScreen'], false],
    [['dashboard', 'TransactionCreateScreen', 'FilterScreen'], false],
    [['dashboard', 'ExpenseTemplateScreen'], false],
  ])('waits for authentication/editors while allowing the template list: %j', (names, expected) => {
    expect(canPresentQuickAccess((names as string[]).map((name) => ({ name })))).toBe(expected);
  });

  test.each(['0', '-1', 'NaN', 'Infinity', '1e3', '1.000,50', '1,000.50', '2abc', ''])('rejects an ambiguous or invalid amount: %s', (value) => {
    expect(() => normalizeExpenseAmount(value)).toThrow('quick_access_invalid_amount');
  });

  test('preserves decimal precision and accepts comma decimal input', () => {
    expect(normalizeExpenseAmount('12,3456')).toBe('12.3456');
    expect(normalizeExpenseAmount('50.00')).toBe('50.00');
  });

  test('round-trips unicode and query characters without changing the description', () => {
    const request = {
      action: 'expense' as const, amount: '2000.50', description: 'Café & pan + té?', templateId: template.id,
    };
    expect(parseQuickAccessURL(quickAccessURL(scheme, request), scheme)).toMatchObject(request);
  });

  test('ignores OAuth and other applications', () => {
    expect(parseQuickAccessURL(`${scheme}://redirect?code=private`, scheme)).toBeNull();
    expect(parseQuickAccessURL('https://example.com/quick/expense?v=1', scheme)).toBeNull();
    expect(parseQuickAccessURL('abacusfiiiapp://quick/expense?v=1', scheme)).toBeNull();
  });

  test.each([
    `${scheme}://quick/expense?v=2`, `${scheme}://quick/expense`,
    `${scheme}://quick/expense?v=1&v=1`, `${scheme}://quick/expense?v=1&token=secret`,
    `${scheme}://quick/expense?v=1&templateId=../other`, `${scheme}://quick/delete?v=1`,
    `${scheme}://quick/expense?v=1&description=%`, `${scheme}://quick/expense?v=1#fragment`,
  ])('rejects unsupported or malformed links: %s', (url) => {
    expect(() => parseQuickAccessURL(url, scheme)).toThrow('quick_access_invalid_link');
  });

  test('parses native intent query strings and encoded plus signs', () => {
    expect(parseQuickAccessURL(`${scheme}://quick/expense?v=1&description=Caf%C3%A9+%2B+pan`, scheme)?.description).toBe('Café + pan');
  });

  test('overrides only supplied values and starts the expense at the current date', () => {
    const result = prepareExpense({ action: 'expense', templateId: template.id, amount: '5,25' }, [template], profile);
    expect(result).toMatchObject({
      amount: '5.25', description: 'Coffee', sourceName: 'Cash', type: 'withdrawal',
    });
    expect(new Date(result.date).getFullYear()).toBe(new Date().getFullYear());
    result.tags.push('new');
    expect(template.split.tags).toEqual(['daily']);
  });

  test('does not resolve a deleted template or another account’s template', () => {
    expect(() => prepareExpense({ action: 'expense', templateId: template.id }, [], profile)).toThrow('quick_access_template_missing');
    expect(() => prepareExpense({ action: 'expense', templateId: template.id }, [template], 'another-profile')).toThrow('quick_access_template_missing');
  });

  test('retains pending requests until consumed and deduplicates cold-start delivery', () => {
    const queue = new QuickAccessQueue();
    const url = quickAccessURL(scheme, { action: 'expense', requestId: 'request-1' });
    expect(queue.enqueue(url, scheme, 1000)).toBe(true);
    expect(queue.enqueue(url, scheme, 1001)).toBe(false);
    expect(queue.shift()).toMatchObject({ requestId: 'request-1' });
    expect(queue.enqueue(url, scheme, 10000)).toBe(false);
    expect(queue.shift()).toBeUndefined();
  });

  test('allows a later explicit tap on a copied template link', () => {
    const queue = new QuickAccessQueue();
    const url = quickAccessURL(scheme, { action: 'expense', templateId: template.id });
    expect(queue.enqueue(url, scheme, 1000)).toBe(true);
    queue.shift();
    expect(queue.enqueue(url, scheme, 4000)).toBe(true);
  });
});
