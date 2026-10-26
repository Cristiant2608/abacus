const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

function runtime(respond) {
  const values = new Map();
  const calls = [];
  class Request {
    constructor(url) { this.url = url; }

    async loadString() {
      calls.push(this.url);
      const result = await respond(this.url);
      this.response = { statusCode: result.status || 200 };
      return JSON.stringify(result.body);
    }
  }
  const context = vm.createContext({
    Request,
    Keychain: { contains: (key) => values.has(key), get: (key) => values.get(key), set: (key, value) => values.set(key, value), remove: (key) => values.delete(key) },
  });
  vm.runInContext(`${fs.readFileSync('integrations/scriptable/abacus-widget.js', 'utf8')}\nglobalThis.api = {cachedSnapshot, fetchSnapshot, periodFor};`, context);
  return { api: context.api, values, calls };
}

const connection = { server: 'https://firefly.example', token: 'test-only' };
const group = (id, currency, amount, type = 'withdrawal') => ({ id, attributes: { transactions: [{ currency_code: currency, amount, type }] } });

test('standalone widget traverses all pages and excludes transfers with exact totals', async () => {
  const app = runtime(async (url) => ({ body: { data: url.endsWith('page=1') ? [group('1', 'USD', '0.1')] : [group('2', 'USD', '0.2'), group('3', 'EUR', '8'), group('4', 'USD', '1000', 'transfer')], meta: { pagination: { total_pages: 2 } } } }));
  const result = await app.api.fetchSnapshot(connection, 'monthly');
  assert.equal(app.calls.length, 2);
  assert.equal(result.currencies.find((row) => row.currency === 'USD').spent, '0.3');
  assert.equal(result.currencies.length, 2);
});

test('offline fallback requires a complete snapshot for the same period', async () => {
  let failing = false;
  const app = runtime(async () => {
    if (failing) throw new Error('network');
    return { body: { data: [group('1', 'COP', '2500')], meta: { pagination: { total_pages: 1 } } } };
  });
  await app.api.cachedSnapshot(connection, 'monthly');
  const key = 'AbacusWidget.Snapshot.monthly';
  const old = JSON.parse(app.values.get(key));
  old.updatedAt = Date.now() - 3600000;
  app.values.set(key, JSON.stringify(old));
  failing = true;
  const result = await app.api.cachedSnapshot(connection, 'monthly');
  assert.equal(result.offline, true);
  assert.equal(result.data.currencies[0].spent, '2500');
  old.data.range.start = '2000-01-01';
  app.values.set(key, JSON.stringify(old));
  await assert.rejects(app.api.cachedSnapshot(connection, 'monthly'), /network/);
});

test('revoked tokens never silently fall back to cached balances', async () => {
  const app = runtime(async () => ({ status: 401, body: { message: 'Unauthorized' } }));
  app.values.set('AbacusWidget.Snapshot.monthly', JSON.stringify({ updatedAt: Date.now() - 3600000, data: { range: app.api.periodFor('monthly') } }));
  await assert.rejects(app.api.cachedSnapshot(connection, 'monthly'), (error) => error.status === 401);
});

test('an incomplete page never replaces the last complete snapshot', async () => {
  const app = runtime(async (url) => {
    if (url.endsWith('page=2')) throw new Error('interrupted');
    return { body: { data: [group('1', 'USD', '1')], meta: { pagination: { total_pages: 2 } } } };
  });
  await assert.rejects(app.api.cachedSnapshot(connection, 'monthly'), /interrupted/);
  assert.equal(app.values.size, 0);
});
