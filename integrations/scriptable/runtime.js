/* eslint-disable */
// Host: Scriptable for iOS. Generated together with the tested finance core.
const connectionKey = 'AbacusWidget.Connection.v1';
const supportedModes = ['daily', 'monthly', 'yearly', 'categories', 'accounts', 'uncategorized', 'trend'];

async function configureConnection() {
  const previous = Keychain.contains(connectionKey) ? JSON.parse(Keychain.get(connectionKey)) : {};
  const alert = new Alert();
  alert.title = 'Conectar Firefly III';
  alert.message = 'Las credenciales se guardan solo en el llavero de Scriptable. Crea el token en Firefly → Opciones → Perfil → OAuth. Deja el token vacío para conservar el actual.';
  alert.addTextField('https://firefly.example', previous.server || '');
  alert.addSecureTextField('Token personal', '');
  alert.addAction('Guardar');
  alert.addCancelAction('Cancelar');
  if (await alert.presentAlert() < 0) return previous;
  const server = alert.textFieldValue(0).trim().replace(/\/+$/, '');
  const match = server.match(/^(https?):\/\/([^/?#@]+)(\/[^?#]*)?$/i);
  if (!match) throw new Error('Introduce una dirección HTTPS válida, sin usuario ni contraseña.');
  const host = match[2].replace(/:\d+$/, '').toLowerCase();
  const local = /^(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(host) || host.endsWith('.local');
  if (match[1].toLowerCase() !== 'https' && !local) throw new Error('HTTP solo está permitido para un servidor de la red local.');
  const token = alert.textFieldValue(1).trim() || (previous.server === server ? previous.token : '');
  if (!token) throw new Error('Falta el token personal de Firefly.');
  const connection = { server, token, hidden: Boolean(previous.hidden) };
  Keychain.set(connectionKey, JSON.stringify(connection));
  // Never reuse another server/user's cached financial snapshot after changing credentials.
  supportedModes.forEach(mode => { const key = 'AbacusWidget.Snapshot.' + mode; if (Keychain.contains(key)) Keychain.remove(key); });
  return connection;
}

function localDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function periodFor(mode, previous = false) {
  const now = new Date();
  if (mode === 'daily') return { start: localDate(now), end: localDate(now) };
  const year = now.getFullYear();
  if (mode === 'yearly') return { start: `${year}-01-01`, end: `${year}-12-31` };
  const month = now.getMonth() - (previous ? 1 : 0);
  const start = new Date(year, month, 1);
  // Compare the same elapsed days, avoiding a full previous month vs partial current month.
  const end = new Date(year, month, Math.min(now.getDate(), new Date(year, month + 1, 0).getDate()));
  return { start: localDate(start), end: localDate(end) };
}

async function fetchSnapshot(connection, mode) {
  async function get(path) {
    const request = new Request(connection.server + path);
    request.timeoutInterval = 20;
    request.headers = { Authorization: 'Bearer ' + connection.token, Accept: 'application/vnd.api+json' };
    const raw = await request.loadString();
    const status = request.response.statusCode;
    if (status < 200 || status >= 300) { const error = new Error('Firefly HTTP ' + status); error.status = status; throw error; }
    return JSON.parse(raw);
  }
  const range = periodFor(mode);
  if (mode === 'accounts') {
    const accounts = await AbacusFinance.fetchEveryPage(page => get('/api/v1/accounts?type=asset&limit=100&page=' + page));
    const totals = Object.create(null);
    const rows = accounts.filter(account => account.attributes.active).map(account => {
      const a = account.attributes;
      if (!a.currency_code) throw new Error('Cuenta sin divisa.');
      const amount = AbacusFinance.addMoney('0', a.current_balance);
      totals[a.currency_code] = AbacusFinance.addMoney(totals[a.currency_code] || '0', amount);
      return { label: a.name, currency: a.currency_code, amount };
    });
    return { range, currencies: Object.keys(totals).sort().map(currency => ({ currency, balance: totals[currency] })), rows };
  }
  async function movements(period) {
    return AbacusFinance.fetchEveryPage(page => get(`/api/v1/transactions?start=${period.start}&end=${period.end}&limit=100&page=${page}`));
  }
  const groups = await movements(range);
  const snapshot = { range, ...AbacusFinance.summarizeMovements(groups) };
  if (mode === 'trend') snapshot.previous = AbacusFinance.summarizeMovements(await movements(periodFor(mode, true))).currencies;
  return snapshot;
}

async function cachedSnapshot(connection, mode) {
  const key = 'AbacusWidget.Snapshot.' + mode;
  const range = periodFor(mode);
  let cached;
  if (Keychain.contains(key)) { try { cached = JSON.parse(Keychain.get(key)); } catch (_) {} }
  const samePeriod = cached && cached.data.range.start === range.start && cached.data.range.end === range.end;
  if (samePeriod && Date.now() - cached.updatedAt < 15 * 60 * 1000) return { ...cached, offline: false };
  try {
    const data = await fetchSnapshot(connection, mode);
    const result = { data, updatedAt: Date.now() };
    Keychain.set(key, JSON.stringify(result));
    return { ...result, offline: false };
  } catch (error) {
    // A revoked token must not silently look like an ordinary offline refresh.
    if ([401, 403, 422].includes(error.status)) throw error;
    if (samePeriod) return { ...cached, offline: true };
    throw error;
  }
}

function makeWidget(connection, mode, state) {
  const widget = new ListWidget();
  widget.setPadding(16, 16, 16, 16);
  widget.backgroundColor = Color.dynamic(new Color('#F6F7FA'), new Color('#18191C'));
  widget.url = 'abacus-personal://quick/templates?v=1';
  const small = config.widgetFamily === 'small';
  const limit = small ? 0 : config.widgetFamily === 'large' ? 6 : 2;
  const currencyLimit = small ? 1 : config.widgetFamily === 'large' ? 4 : 2;
  function text(value, size = 13, bold = false, secondary = false) {
    const line = widget.addText(String(value));
    line.font = bold ? Font.boldSystemFont(size) : Font.systemFont(size);
    line.textColor = secondary ? Color.gray() : Color.dynamic(Color.black(), Color.white());
    line.lineLimit = 1;
    line.minimumScaleFactor = 0.7;
    return line;
  }
  const money = (currency, value) => connection.hidden ? '••••' : AbacusFinance.formatExactMoney(currency, value);
  const titles = { daily: 'Hoy', monthly: 'Este mes', yearly: 'Este año', accounts: 'Saldos de cuentas', categories: 'Gastos por categoría', uncategorized: 'Sin categoría', trend: 'Comparación mensual' };
  text('ABACUS · ' + titles[mode], 12, true, true);
  widget.addSpacer(8);
  const data = state.data;
  const field = mode === 'uncategorized' ? 'uncategorized' : mode === 'accounts' ? 'balance' : 'spent';
  const currencies = data.currencies.slice(0, currencyLimit);
  currencies.forEach(currency => {
    text(money(currency.currency, currency[field]), small ? 19 : 23, true);
    if (mode === 'trend') {
      const previous = data.previous.find(row => row.currency === currency.currency);
      text('Anterior: ' + money(currency.currency, previous ? previous.spent : '0'), 11, false, true);
    } else if (!small && !['accounts', 'categories', 'uncategorized'].includes(mode)) {
      text('Ingresos ' + money(currency.currency, currency.income) + ' · Neto ' + money(currency.currency, currency.balance), 11, false, true);
    }
    widget.addSpacer(4);
  });
  if (!currencies.length) text('Sin movimientos', 18, true);
  if (data.currencies.length > currencies.length) text(`+${data.currencies.length - currencies.length} divisas`, 11, false, true);
  if (!small && mode === 'accounts') data.rows.slice(0, limit).forEach(row => text(row.label + '  ' + money(row.currency, row.amount), 12));
  if (!small && mode === 'categories') {
    const rows = data.currencies.flatMap(row => Object.entries(row.categories).map(([name, amount]) => ({ name, amount, currency: row.currency })));
    rows.sort((a, b) => { if (a.currency !== b.currency) return a.currency.localeCompare(b.currency); const delta = AbacusFinance.addMoney(a.amount, AbacusFinance.negateMoney(b.amount)); return delta === '0' ? 0 : delta.startsWith('-') ? 1 : -1; });
    rows.slice(0, limit).forEach(row => text(row.name + '  ' + money(row.currency, row.amount), 12));
  }
  if (mode === 'uncategorized') text(`${data.uncategorizedCount} gastos pendientes de clasificar`, 12);
  widget.addSpacer();
  text(`${data.range.start} — ${data.range.end}`, 10, false, true);
  text((state.offline ? 'Sin conexión · ' : 'Actualizado · ') + new Date(state.updatedAt).toLocaleTimeString(), 10, false, true);
  widget.refreshAfterDate = new Date(Date.now() + (state.offline ? 30 : 60) * 60 * 1000);
  return widget;
}

async function main() {
  let connection = Keychain.contains(connectionKey) ? JSON.parse(Keychain.get(connectionKey)) : null;
  let mode = String(args.widgetParameter || 'monthly').trim().toLowerCase();
  if (!supportedModes.includes(mode)) mode = 'monthly';
  if (config.runsInApp) {
    const menu = new Alert(); menu.title = 'Abacus · Widgets';
    menu.message = 'Elige un resumen. Al añadir el widget, usa su nombre como parámetro: ' + supportedModes.join(', ') + '.';
    menu.addAction('Configurar conexión'); menu.addAction(connection && connection.hidden ? 'Mostrar importes' : 'Ocultar importes');
    supportedModes.forEach(value => menu.addAction(value)); menu.addCancelAction('Cancelar');
    const choice = await menu.presentSheet();
    if (choice < 0) return;
    if (choice === 0) connection = await configureConnection();
    else if (choice === 1 && connection) { connection.hidden = !connection.hidden; Keychain.set(connectionKey, JSON.stringify(connection)); }
    else if (choice >= 2) mode = supportedModes[choice - 2];
  }
  if (!connection || !connection.token) throw new Error('Ejecuta el script en Scriptable para configurar Firefly.');
  const state = await cachedSnapshot(connection, mode);
  const widget = makeWidget(connection, mode, state);
  if (config.runsInWidget) Script.setWidget(widget); else await widget.presentMedium();
}

if (typeof ListWidget !== 'undefined') {
  main().catch(async error => {
    const widget = new ListWidget();
    widget.addText('Abacus · No disponible').font = Font.boldSystemFont(16);
    widget.addSpacer(8);
    const message = error.status === 401 || error.status === 403 ? 'Revisa el token en Scriptable.' : 'Revisa la conexión y la configuración en Scriptable.';
    widget.addText(message).font = Font.systemFont(12);
    widget.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);
    if (config.runsInWidget) Script.setWidget(widget); else { const alert = new Alert(); alert.title = 'Abacus'; alert.message = error.message; alert.addAction('Aceptar'); await alert.presentAlert(); }
  }).finally(() => Script.complete());
}
