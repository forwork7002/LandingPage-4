/**
 * Sinolife Collagen landing — server
 *
 * Nima qiladi:
 *   1) public/ papkasidagi saytni beradi
 *   2) POST /api/lead  → Bitrix24 ga lead (crm.lead.add) yaratadi
 *
 * Kutubxona kerak emas. Node 18+ (fetch bor).
 *
 * Muhit o‘zgaruvchilari (start.sh ichida):
 *   PORT                 — port (standart 3000)
 *   BITRIX_WEBHOOK       — MAJBURIY. Kiruvchi webhook, masalan:
 *                          https://sizningkompaniya.bitrix24.ru/rest/1/abcdef123456/
 *   BITRIX_SOURCE_ID     — lead manbasi (standart WEB)
 *   BITRIX_STATUS_ID     — lead stadiyasi, masalan NEW (ixtiyoriy)
 *   BITRIX_ASSIGNED_BY   — mas’ul xodim ID (ixtiyoriy)
 *   BITRIX_EXTRA_FIELDS  — qo‘shimcha maydonlar JSON ko‘rinishida, masalan
 *                          {"UF_CRM_1700000000":"Collagen"} (ixtiyoriy)
 *   ALLOWED_ORIGIN       — sayt boshqa domenda bo‘lsa, CORS uchun (ixtiyoriy)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, 'public');
const WEBHOOK = (process.env.BITRIX_WEBHOOK || '').trim();
const SOURCE_ID = process.env.BITRIX_SOURCE_ID || 'WEB';
const STATUS_ID = process.env.BITRIX_STATUS_ID || '';
const ASSIGNED_BY = process.env.BITRIX_ASSIGNED_BY || '';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '';
let EXTRA_FIELDS = {};
try { EXTRA_FIELDS = JSON.parse(process.env.BITRIX_EXTRA_FIELDS || '{}'); } catch (e) { console.error('BITRIX_EXTRA_FIELDS JSON emas — e’tiborsiz qoldirildi'); }

if (!WEBHOOK) console.warn('DIQQAT: BITRIX_WEBHOOK berilmagan — buyurtmalar Bitrix24 ga yozilmaydi (faqat konsolga chiqadi).');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.mp4': 'video/mp4', '.webm': 'video/webm'
};

/* --- Oddiy rate-limit: bir IP dan 10 daqiqada 5 ta buyurtma --- */
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  if (arr.length >= 5) { hits.set(ip, arr); return true; }
  arr.push(now); hits.set(ip, arr);
  return false;
}
setInterval(() => { const now = Date.now(); for (const [ip, arr] of hits) if (!arr.some((t) => now - t < 10 * 60 * 1000)) hits.delete(ip); }, 60 * 1000).unref();

function send(res, code, body, headers) {
  const h = Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, headers || {});
  if (ALLOWED_ORIGIN) { h['Access-Control-Allow-Origin'] = ALLOWED_ORIGIN; h['Access-Control-Allow-Headers'] = 'Content-Type'; h['Access-Control-Allow-Methods'] = 'POST, OPTIONS'; }
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

function clean(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max); }

async function createLead(body, ip, ua) {
  const name = clean(body.name, 60);
  const phone = '+' + String(body.phone || '').replace(/\D/g, '');
  const now = new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent' });

  const comments = [
    `Manba: sayt (Sinolife Collagen landing)`,
    `Vaqt: ${now}`,
    body.page ? `Sahifa: ${clean(body.page, 500)}` : '',
    body.referrer ? `Referrer: ${clean(body.referrer, 300)}` : '',
    `IP: ${ip}`,
    ua ? `Qurilma: ${clean(ua, 200)}` : ''
  ].filter(Boolean).join('\n');

  const fields = Object.assign({
    TITLE: `Sayt Collagen: ${name} ${phone}`,
    NAME: name,
    PHONE: [{ VALUE: phone, VALUE_TYPE: 'WORK' }],
    SOURCE_ID: SOURCE_ID,
    SOURCE_DESCRIPTION: 'Sinolife Collagen landing',
    COMMENTS: comments,
    UTM_SOURCE: clean(body.utm_source, 100),
    UTM_MEDIUM: clean(body.utm_medium, 100),
    UTM_CAMPAIGN: clean(body.utm_campaign, 200),
    UTM_CONTENT: clean(body.utm_content, 200),
    UTM_TERM: clean(body.utm_term, 200)
  }, EXTRA_FIELDS);
  if (STATUS_ID) fields.STATUS_ID = STATUS_ID;
  if (ASSIGNED_BY) fields.ASSIGNED_BY_ID = ASSIGNED_BY;

  if (!WEBHOOK) { console.log('[lead — Bitrix yo‘q]', JSON.stringify(fields)); return { id: 0 }; }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(WEBHOOK.replace(/\/?$/, '/') + 'crm.lead.add.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields, params: { REGISTER_SONET_EVENT: 'Y' } }),
      signal: ctrl.signal
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || data.error) throw new Error(data.error_description || data.error || `HTTP ${r.status}`);
    return { id: data.result };
  } finally { clearTimeout(timer); }
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
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': cache });
    fs.createReadStream(filePath).pipe(res);
  });
}

http.createServer(async (req, res) => {
  const url = (req.url || '/').split('?')[0];
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';

  if (url === '/api/lead') {
    if (req.method === 'OPTIONS') return send(res, 204, '');
    if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'method' });
    let body;
    try { body = await readJson(req, 10 * 1024); } catch (e) { return send(res, 400, { ok: false, error: 'bad request' }); }

    if (body.website) return send(res, 200, { ok: true, id: 0 });               // bot (honeypot)
    const name = clean(body.name, 60);
    const digits = String(body.phone || '').replace(/\D/g, '');
    if (name.length < 2) return send(res, 400, { ok: false, error: 'name' });
    if (!/^998\d{9}$/.test(digits)) return send(res, 400, { ok: false, error: 'phone' });
    if (rateLimited(ip)) return send(res, 429, { ok: false, error: 'rate' });

    try {
      const { id } = await createLead(body, ip, req.headers['user-agent']);
      console.log(`[lead] #${id} ${name} +${digits} ${body.utm_source || ''}`);
      return send(res, 200, { ok: true, id });
    } catch (e) {
      console.error('[lead ERROR]', e.message);
      return send(res, 502, { ok: false, error: 'bitrix' });
    }
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { ok: false });
  return serveStatic(req, res);
}).listen(PORT, () => console.log(`Sinolife landing → http://localhost:${PORT}  (Bitrix: ${WEBHOOK ? 'ulangan' : 'YO‘Q'})`));
