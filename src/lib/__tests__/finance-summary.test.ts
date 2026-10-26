import {
  addMoney, fetchEveryPage, FinanceGroup, formatExactMoney, summarizeMovements,
} from '../finance-summary';

test('decimal aggregation never passes through floating point or truncates sub-cent amounts', () => {
  expect(addMoney('0.1', '0.2')).toBe('0.3');
  expect(addMoney('9007199254740993.00000001', '0.00000002')).toBe('9007199254740993.00000003');
  expect(addMoney('-0.2', '0.1')).toBe('-0.1');
  expect(addMoney('100.000', '0')).toBe('100');
  expect(() => addMoney('NaN', '0')).toThrow();
});

test('separates currencies, ignores transfers and counts uncategorized expense splits', () => {
  const group: FinanceGroup = {
    id: '1',
    attributes: {
      transactions: [
        { type: 'deposit', amount: '2.00', currency_code: 'USD' },
        {
          type: 'withdrawal', amount: '0.1', currency_code: 'USD', category_name: 'Food',
        },
        { type: 'withdrawal', amount: '0.2', currency_code: 'USD' },
        { type: 'transfer', amount: '500', currency_code: 'USD' },
        {
          type: 'withdrawal', amount: '2000', currency_code: 'COP', category_name: '__proto__',
        },
      ],
    },
  };
  const summary = summarizeMovements([group, group]);
  expect(summary.uncategorizedCount).toBe(1);
  expect(summary.currencies.find((row) => row.currency === 'USD')).toEqual(expect.objectContaining({
    income: '2', spent: '0.3', balance: '1.7', uncategorized: '0.2',
  }));
  const { categories } = summary.currencies.find((row) => row.currency === 'COP');
  expect(Object.getOwnPropertyDescriptor(categories, '__proto__').value).toBe('2000');
});

test('never assigns a default currency to a malformed response', () => {
  expect(() => summarizeMovements([{ id: '1', attributes: { transactions: [{ type: 'withdrawal', amount: '10' }] } }])).toThrow('currency');
});

test('formats large decimal values and small fractions without numeric rounding', () => {
  expect(formatExactMoney('USD', '9007199254740993.00000001', 'en-US')).toBe('USD 9,007,199,254,740,993.00000001');
  expect(formatExactMoney('EUR', '-1.1', 'es-ES')).toBe('EUR -1,10');
  expect(formatExactMoney('JPY', '100', 'en-US')).toBe('JPY 100');
  expect(formatExactMoney('KWD', '1.1', 'en-US')).toBe('KWD 1.100');
});

test('fetches every page including more than 500 records', async () => {
  const load = jest.fn(async (page: number) => ({ data: Array.from({ length: 100 }, (_, index) => (page - 1) * 100 + index), meta: { pagination: { total_pages: 6 } } }));
  const records = await fetchEveryPage(load);
  expect(records).toHaveLength(600);
  expect(records[599]).toBe(599);
  expect(load).toHaveBeenCalledTimes(6);
});

test('formats exactly with Hermes iOS limitations: no formatToParts or Intl BigInt support', () => {
  const Original = Intl.NumberFormat;
  const spy = jest.spyOn(Intl, 'NumberFormat').mockImplementation((locale, options) => {
    const formatter = new Original(locale, options);
    return {
      format: (value: number) => {
        if (typeof value !== 'number') throw new Error('Intl BigInt unsupported');
        return formatter.format(value);
      },
      resolvedOptions: () => formatter.resolvedOptions(),
    } as Intl.NumberFormat;
  });
  try {
    expect(formatExactMoney('USD', '9007199254740993.00000001', 'en-US')).toBe('USD 9,007,199,254,740,993.00000001');
    expect(formatExactMoney('INR', '123456789.12', 'en-IN')).toBe('INR 12,34,56,789.12');
    expect(formatExactMoney('EUR', '-123456789.1', 'es-ES')).toBe('EUR -123.456.789,10');
  } finally { spy.mockRestore(); }
});

test('does not return a partial snapshot after a page fails or pagination is missing', async () => {
  await expect(fetchEveryPage(async (page) => {
    if (page === 2) throw new Error('network');
    return { data: [1], meta: { pagination: { total_pages: 2 } } };
  })).rejects.toThrow('network');
  await expect(fetchEveryPage(async () => ({ data: [1] }))).rejects.toThrow('pagination');
});
