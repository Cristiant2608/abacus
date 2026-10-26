/* Firefly API wire fields intentionally use snake_case. */
/* eslint-disable camelcase */
export type FinanceSplit = {
  transaction_journal_id?: string; type: string; amount: string; currency_code?: string; currencyCode?: string;
  category_name?: string; categoryName?: string; description?: string; date?: string;
};
export type FinanceGroup = { id: string; attributes: { transactions: FinanceSplit[] } };
export type CurrencySummary = { currency: string; income: string; spent: string; balance: string; uncategorized: string; categories: Record<string, string> };

/** Decimal strings stay exact across aggregation, including currencies with >2 decimals. */
export function addMoney(left: string, right: string): string {
  const parse = (value: string) => {
    if (!/^-?\d+(?:\.\d+)?$/.test(value) || value.length > 100) throw new Error('Invalid monetary amount');
    const [integer, fraction = ''] = value.split('.');
    return { units: BigInt(integer + fraction), scale: fraction.length };
  };
  const a = parse(left); const b = parse(right);
  const scale = Math.max(a.scale, b.scale);
  const units = a.units * (BigInt(10) ** BigInt(scale - a.scale)) + b.units * (BigInt(10) ** BigInt(scale - b.scale));
  const digits = (units < 0 ? -units : units).toString().padStart(scale + 1, '0');
  const text = scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}`.replace(/\.?0+$/, '') : digits;
  return `${units < 0 ? '-' : ''}${text}`;
}

export const negateMoney = (value: string) => (value.startsWith('-') ? value.slice(1) : `-${value}`);

export function summarizeMovements(groups: FinanceGroup[]) {
  const currencies: Record<string, CurrencySummary> = Object.create(null);
  let uncategorizedCount = 0;
  const seen = new Set<string>();
  groups.forEach((group) => {
    if (seen.has(group.id)) return;
    seen.add(group.id);
    group.attributes.transactions.forEach((split) => {
      if (!['deposit', 'withdrawal'].includes(split.type)) return;
      const code = split.currency_code || split.currencyCode;
      if (!code) throw new Error('Missing transaction currency');
      const amount = addMoney('0', split.amount).replace(/^-/, '');
      const row = currencies[code] || {
        currency: code, income: '0', spent: '0', balance: '0', uncategorized: '0', categories: Object.create(null),
      };
      if (split.type === 'deposit') row.income = addMoney(row.income, amount);
      else {
        row.spent = addMoney(row.spent, amount);
        const category = split.category_name || split.categoryName;
        if (category) row.categories[category] = addMoney(row.categories[category] || '0', amount);
        else { row.uncategorized = addMoney(row.uncategorized, amount); uncategorizedCount += 1; }
      }
      row.balance = addMoney(row.income, negateMoney(row.spent));
      currencies[code] = row;
    });
  });
  return { currencies: Object.values(currencies).sort((a, b) => a.currency.localeCompare(b.currency)), uncategorizedCount };
}

export function formatExactMoney(currency: string, value: string, locale = 'es-CO'): string {
  const normalized = addMoney('0', value);
  const [integer, fraction = ''] = normalized.replace(/^-/, '').split('.');
  const decimals = new Intl.NumberFormat(locale, { style: 'currency', currency }).resolvedOptions().minimumFractionDigits;
  const formattedFraction = fraction.padEnd(decimals, '0');
  const separator = new Intl.NumberFormat(locale).formatToParts(1.1).find((part) => part.type === 'decimal')?.value || '.';
  const grouped = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(BigInt(integer));
  return `${currency} ${normalized.startsWith('-') ? '-' : ''}${grouped}${formattedFraction ? separator + formattedFraction : ''}`;
}

export async function fetchEveryPage<T>(load: (page: number) => Promise<{ data: T[]; meta?: { pagination?: { total_pages?: number; totalPages?: number } } }>): Promise<T[]> {
  const records: T[] = [];
  let page = 1;
  let total = 1;
  do {
    // eslint-disable-next-line no-await-in-loop
    const response = await load(page);
    if (!Array.isArray(response.data)) throw new Error('Invalid Firefly response');
    const count = response.meta?.pagination?.total_pages ?? response.meta?.pagination?.totalPages;
    if (!Number.isInteger(count) || count < page || count > 10000) throw new Error('Invalid Firefly pagination');
    total = count;
    records.push(...response.data);
    page += 1;
  } while (page <= total);
  return records;
}
