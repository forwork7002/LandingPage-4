/**
 * Sinolife landing — server
 *
 * 1) public/ papkasidagi saytni beradi
 * 2) POST /api/lead → Bitrix24 da SDELKA (crm.deal.add) yaratadi:
 *      voronka  : "Регистрация"        (BITRIX_DEAL_CATEGORY_NAME)
 *      bosqich  : "Веб-сайт (лид)"     (BITRIX_DEAL_STAGE_NAME)
 *    Telefon bo'yicha mavjud kontakt qidiriladi (crm.duplicate.findbycomm).
 *    Topilsa — o'sha kontaktga bog'lanadi, topilmasa — yangi kontakt ochiladi.
 *
 * Kutubxona kerak emas. Node 18+.
 *
 * MUHIT O'ZGARUVCHILARI (start.sh ichida):
 *   PORT                        port (standart 3000)
 *   BITRIX_WEBHOOK              MAJBURIY. Masalan:
 *                               https://obey.bitrix24.kz/rest/1/XXXXXXXXXXXXXXXX/
 *   BITRIX_DEAL_CATEGORY_NAME   voronka nomi (standart "Регистрация")
 *   BITRIX_DEAL_STAGE_NAME      bosqich nomi (standart "Веб-сайт")
 *   BITRIX_DEAL_CATEGORY_ID     nom bo'yicha topilmasa — ID ni qo'lda yozing
 *   BITRIX_DEAL_STAGE_ID        masalan C7:NEW  (qo'lda yozish uchun)
 *   BITRIX_SOURCE_ID            manba (standart WEB)
 *   BITRIX_ASSIGNED_BY          mas'ul xodim ID (ixtiyoriy)
 *   BITRIX_DEAL_TITLE           sarlavha shabloni (standart "Sayt Collagen — {name}")
 *   BITRIX_DEAL_AMOUNT          summa, masalan 249000 (ixtiyoriy)
 *   BITRIX_CREATE_CONTACT       0 — kontakt yaratmaslik (standart 1)
 *   BITRIX_EXTRA_FIELDS         qo'shimcha maydonlar JSON: {"UF_CRM_...":"..."}
 *   ADMIN_KEY                   /api/bitrix/stages?key=... diagnostikasi uchun
 *   ALLOWED_ORIGIN              sayt boshqa domenda bo'lsa CORS uchun
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, 'public');
const WEBHOOK = (process.env.BITRIX_WEBHOOK || '').trim().replace(/\/?$/, '/');

const CAT_NAME = process.env.BITRIX_DEAL_CATEGORY_NAME || 'Регистрация';
const STAGE_NAME = process.env.BITRIX_DEAL_STAGE_NAME || 'Веб-сайт';
const CAT_ID_ENV = (process.env.BITRIX_DEAL_CATEGORY_ID || '').trim();
const STAGE_ID_ENV = (process.env.BITRIX_DEAL_STAGE_ID || '').trim();

const SOURCE_ID = process.env.BITRIX_SOURCE_ID || 'WEB';
const ASSIGNED_BY = (process.env.BITRIX_ASSIGNED_BY || '').trim();
const TITLE_TPL = process.env.BITRIX_DEAL_TITLE || 'Сайт Collagen — {name}';
const AMOUNT = (process.env.BITRIX_DEAL_AMOUNT || '').trim();
const CREATE_CONTACT = process.env.BITRIX_CREATE_CONTACT !== '0';
const ADMIN_KEY = (process.env.ADMIN_KEY || '').trim();
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '';

let EXTRA_FIELDS = {};
try { EXTRA_FIELDS = JSON.parse(process.env.BITRIX_EXTRA_FIELDS || '{}'); }
catch (e) { console.error('BITRIX_EXTRA_FIELDS JSON emas — e\'tiborsiz qoldirildi'); }

if (!WEBHOOK || WEBHOOK === '/') {
  console.warn('DIQQAT: BITRIX_WEBHOOK berilmagan — buyurtmalar faqat konsolga yoziladi.');
}

/* ------------------------------------------------------------------ */
/* Bitrix REST chaqiruvi                                               */
/* ------------------------------------------------------------------ */
async function bx(method, params) {
  if (!WEBHOOK || WEBHOOK === '/') throw new Error('no-webhook');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(WEBHOOK + method + '.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params || {}),
      signal: ctrl.signal
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || data.error) {
      throw new Error(method + ': ' + (data.error_description || data.error || 'HTTP ' + r.status));
    }
    return data.result;
  } finally { clearTimeout(timer); }
}

const norm = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]/g, '');

/* ---- voronka va bosqichni nom bo'yicha topish (bir marta, keshlanadi) ---- */
let routeCache = null;

async function listCategories() {
  try {
    const r = await bx('crm.category.list', { entityTypeId: 2 });
    const arr = (r && r.categories) || [];
    if (arr.length) return arr.map((c) => ({ id: String(c.id), name: c.name }));
  } catch (e) { /* eski portallarda bo'lmasligi mumkin */ }
  const r2 = await bx('crm.dealcategory.list', { order: { SORT: 'ASC' } });
  const arr2 = Array.isArray(r2) ? r2 : [];
  const out = arr2.map((c) => ({ id: String(c.ID), name: c.NAME }));
  if (!out.some((c) => c.id === '0')) out.unshift({ id: '0', name: 'Общее' });
  return out;
}

async function listStages(catId) {
  const entity = String(catId) === '0' ? 'DEAL_STAGE' : 'DEAL_STAGE_' + catId;
  const r = await bx('crm.status.list', { filter: { ENTITY_ID: entity }, order: { SORT: 'ASC' } });
  return (Array.isArray(r) ? r : []).map((s) => ({ id: s.STATUS_ID, name: s.NAME }));
}

async function resolveRoute() {
  if (routeCache) return routeCache;

  if (CAT_ID_ENV && STAGE_ID_ENV) {
    routeCache = { categoryId: CAT_ID_ENV, stageId: STAGE_ID_ENV, how: 'env' };
    return routeCache;
  }

  const cats = await listCategories();
  let cat = cats.find((c) => norm(c.name) === norm(CAT_NAME))
         || cats.find((c) => norm(c.name).includes(norm(CAT_NAME)));
  if (CAT_ID_ENV) cat = cats.find((c) => c.id === CAT_ID_ENV) || { id: CAT_ID_ENV, name: '(ID orqali)' };
  if (!cat) throw new Error('Voronka topilmadi: "' + CAT_NAME + '". Mavjudlari: ' + cats.map((c) => c.id + '=' + c.name).join(', '));

  const stages = await listStages(cat.id);
  let st = STAGE_ID_ENV
    ? stages.find((s) => s.id === STAGE_ID_ENV) || { id: STAGE_ID_ENV, name: '(ID orqali)' }
    : (stages.find((s) => norm(s.name) === norm(STAGE_NAME))
    || stages.find((s) => norm(s.name).includes(norm(STAGE_NAME))));
  if (!st) throw new Error('Bosqich topilmadi: "' + STAGE_NAME + '". Mavjudlari: ' + stages.map((s) => s.id + '=' + s.name).join(', '));

  routeCache = { categoryId: cat.id, stageId: st.id, how: 'name', categoryName: cat.name, stageName: st.name };
  console.log(`[bitrix] voronka "${cat.name}" (ID ${cat.id}) → bosqich "${st.name}" (${st.id})`);
  return routeCache;
}

/* ------------------------------------------------------------------ */
/* Kontakt: telefon bo'yicha qidirib, bo'lmasa yaratamiz               */
/* ------------------------------------------------------------------ */
async function findOrCreateContact(name, phone) {
  let contactId = 0, existed = false;
  try {
    const dup = await bx('crm.duplicate.findbycomm', { entity_type: 'CONTACT', type: 'PHONE', values: [phone] });
    const ids = (dup && dup.CONTACT) || [];
    if (ids.length) { contactId = Number(ids[0]); existed = true; }
  } catch (e) { console.warn('[bitrix] dublikat qidirish ishlamadi:', e.message); }

  if (!contactId && CREATE_CONTACT) {
    try {
      contactId = Number(await bx('crm.contact.add', {
        fields: {
          NAME: name,
          PHONE: [{ VALUE: phone, VALUE_TYPE: 'MOBILE' }],
          SOURCE_ID: SOURCE_ID,
          SOURCE_DESCRIPTION: 'Sinolife landing',
          OPENED: 'Y',
          TYPE_ID: 'CLIENT'
        },
        params: { REGISTER_SONET_EVENT: 'N' }
      }));
    } catch (e) { console.warn('[bitrix] kontakt yaratilmadi:', e.message); }
  }
  return { contactId, existed };
}

/* ------------------------------------------------------------------ */
/* Sdelka yaratish                                                     */
/* ------------------------------------------------------------------ */
function clean(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
}

async function createDeal(body, ip, ua) {
  const name = clean(body.name, 60);
  const phone = '+' + String(body.phone || '').replace(/\D/g, '');
  const now = new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent' });

  if (!WEBHOOK || WEBHOOK === '/') {
    console.log('[lead — Bitrix ulanmagan]', name, phone, body.page || '');
    return { id: 0, contactId: 0 };
  }

  const route = await resolveRoute();
  const { contactId, existed } = await findOrCreateContact(name, phone);

  const comments = [
    'Manba: sayt (' + clean(body.product, 120) + ')',
    'Ism: ' + name,
    'Telefon: ' + phone,
    'Vaqt: ' + now,
    body.place ? 'Forma: ' + clean(body.place, 40) : '',
    existed ? 'DIQQAT: shu raqamli kontakt allaqachon bor edi (takroriy murojaat)' : '',
    body.page ? 'Sahifa: ' + clean(body.page, 500) : '',
    body.referrer ? 'Referrer: ' + clean(body.referrer, 300) : '',
    'IP: ' + ip,
    ua ? 'Qurilma: ' + clean(ua, 200) : ''
  ].filter(Boolean).join('\n');

  const fields = Object.assign({
    TITLE: TITLE_TPL.replace('{name}', name).replace('{phone}', phone).replace('{product}', clean(body.product, 80)),
    CATEGORY_ID: route.categoryId,
    STAGE_ID: route.stageId,
    SOURCE_ID: SOURCE_ID,
    SOURCE_DESCRIPTION: 'Sinolife landing',
    COMMENTS: comments,
    OPENED: 'Y',
    UTM_SOURCE: clean(body.utm_source, 100),
    UTM_MEDIUM: clean(body.utm_medium, 100),
    UTM_CAMPAIGN: clean(body.utm_campaign, 200),
    UTM_CONTENT: clean(body.utm_content, 200),
    UTM_TERM: clean(body.utm_term, 200)
  }, EXTRA_FIELDS);

  if (contactId) fields.CONTACT_ID = contactId;
  if (ASSIGNED_BY) fields.ASSIGNED_BY_ID = ASSIGNED_BY;
  if (AMOUNT) { fields.OPPORTUNITY = AMOUNT; fields.CURRENCY_ID = process.env.BITRIX_CURRENCY || 'UZS'; }

  const id = await bx('crm.deal.add', { fields, params: { REGISTER_SONET_EVENT: 'Y' } });

  /* Telefonni sdelkaga ham yozib qo'yamiz — operator kartadan ko'radi */
  try {
    await bx('crm.timeline.comment.add', {
      fields: { ENTITY_ID: id, ENTITY_TYPE: 'deal', COMMENT: 'Saytdan: ' + name + ' — ' + phone }
    });
  } catch (e) { /* ixtiyoriy */ }

  return { id, contactId, existed };
}

/* ------------------------------------------------------------------ */
/* HTTP                                                                */
/* ------------------------------------------------------------------ */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.mp4': 'video/mp4', '.webm': 'video/webm'
};

const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  if (arr.length >= 5) { hits.set(ip, arr); return true; }
  arr.push(now); hits.set(ip, arr);
  return false;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, arr] of hits) if (!arr.some((t) => now - t < 10 * 60 * 1000)) hits.delete(ip);
}, 60 * 1000).unref();

function send(res, code, body, headers) {
  const h = Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, headers || {});
  if (ALLOWED_ORIGIN) {
    h['Access-Control-Allow-Origin'] = ALLOWED_ORIGIN;
    h['Access-Control-Allow-Headers'] = 'Content-Type';
    h['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
  }
  res.writeHead(code, h);
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

function readJson(req, limit) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > limit) { reject(new Error('too large')); req.destroy(); } });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch (e) { reject(new Error('bad json')); } });
    req.on('error', reject);
  });
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.normalize(path.join(PUBLIC_DIR, urlPath));
  if (!filePath.startsWith(PUBLIC_DIR)) return send(res, 403, 'Forbidden', { 'Content-Type': 'text/plain' });
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'Not found', { 'Content-Type': 'text/plain' });
    const ext = path.extname(filePath).toLowerCase();
    const cache = ext === '.html' ? 'no-cache' : 'public, max-age=2592000';
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': cache
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

http.createServer(async (req, res) => {
  const url = (req.url || '/').split('?')[0];
  const query = new URLSearchParams((req.url || '').split('?')[1] || '');
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';

  /* Diagnostika: voronka va bosqichlar ro'yxati */
  if (url === '/api/bitrix/stages') {
    if (!ADMIN_KEY || query.get('key') !== ADMIN_KEY) return send(res, 403, { ok: false, error: 'key' });
    try {
      const cats = await listCategories();
      const withStages = [];
      for (const c of cats) withStages.push({ id: c.id, name: c.name, stages: await listStages(c.id) });
      let route = null;
      try { route = await resolveRoute(); } catch (e) { route = { error: e.message }; }
      return send(res, 200, { ok: true, route, categories: withStages });
    } catch (e) {
      return send(res, 502, { ok: false, error: e.message });
    }
  }

  if (url === '/healthz') return send(res, 200, { ok: true, bitrix: !!WEBHOOK && WEBHOOK !== '/' });

  if (url === '/api/lead') {
    if (req.method === 'OPTIONS') return send(res, 204, '');
    if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'method' });

    let body;
    try { body = await readJson(req, 10 * 1024); }
    catch (e) { return send(res, 400, { ok: false, error: 'bad request' }); }

    if (body.website) return send(res, 200, { ok: true, id: 0 });   // honeypot — bot
    const name = clean(body.name, 60);
    const digits = String(body.phone || '').replace(/\D/g, '');
    if (name.length < 2) return send(res, 400, { ok: false, error: 'name' });
    if (!/^998\d{9}$/.test(digits)) return send(res, 400, { ok: false, error: 'phone' });
    if (rateLimited(ip)) return send(res, 429, { ok: false, error: 'rate' });

    try {
      const r = await createDeal(body, ip, req.headers['user-agent']);
      console.log(`[deal] #${r.id} ${name} +${digits} kontakt:${r.contactId}${r.existed ? ' (takroriy)' : ''} ${body.utm_source || ''}`);
      return send(res, 200, { ok: true, id: r.id });
    } catch (e) {
      console.error('[deal ERROR]', e.message);
      routeCache = null;   // keyingi urinishda voronkani qaytadan aniqlaydi
      return send(res, 502, { ok: false, error: 'bitrix' });
    }
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { ok: false });
  return serveStatic(req, res);
}).listen(PORT, () => {
  console.log(`Sinolife landing → http://localhost:${PORT}  (Bitrix: ${WEBHOOK && WEBHOOK !== '/' ? 'ulangan' : 'YO‘Q'})`);
  if (WEBHOOK && WEBHOOK !== '/') {
    resolveRoute().catch((e) => console.error('[bitrix] voronka aniqlanmadi:', e.message));
  }
});
