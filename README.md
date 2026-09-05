# Sinolife Collagen — landing page

```
sinolife-landing/
├─ server.js                 Node 18+ server: public/ ni beradi + POST /api/lead → Bitrix24 (crm.lead.add)
├─ start.sh                  muhit o‘zgaruvchilari (BITRIX_WEBHOOK va h.k.) + node server.js
├─ sinolife-landing.service  systemd xizmati (/root/sinolife-landing uchun)
└─ public/
   ├─ index.html             sahifa (CSS/JS ichida)
   ├─ img/                   mahsulot suratlari; img/story/ — hikoya boblari; img/gallery/ — galereya uchun kichik nusxalar
   │   └─ cut/               shaffof fonli elementlar: jar.webp (hero dagi banka), kakao, apelsin, barg, tomchi
   ├─ fonts/                 Jost + Cormorant Garamond (SIL OFL), o‘z serverdan yuklanadi
   └─ frames/                hero skroll-animatsiya uchun PNG kadrlar (ixtiyoriy)
```

## Serverga o‘rnatish (DigitalOcean, root)

```bash
cd /root && unzip sinolife-landing.zip
nano /root/sinolife-landing/start.sh          # BITRIX_WEBHOOK ni yozing
cp /root/sinolife-landing/sinolife-landing.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now sinolife-landing
systemctl status sinolife-landing             # tekshirish
```

Bitrix24 webhook: CRM → Разработчикам → Другое → Входящий вебхук (huquq: CRM).

## Sahifa sozlamalari — `public/index.html` ichidagi `CONFIG`

- `leadEndpoint` — standart `/api/lead` (shu server). Sayt boshqa domenda bo‘lsa to‘liq URL yozing va
  `start.sh` da `ALLOWED_ORIGIN` ni oching.
- `phone`, `phoneDisplay`, `telegram`, `instagram`, `workHours` — kontaktlar.
- `pixelId` — Meta Pixel ID (bo‘sh qolsa yuklanmaydi). Forma yuborilganda `Lead` eventi ketadi.
- `heroFrames` — skroll-animatsiya. Kadrlarni `public/frames/frame_0001.png …` ko‘rinishida joylab,
  `count` ga kadrlar sonini yozing (masalan 120). `count: 0` — statik banka. `aspect` — kadrlar nisbati
  (masalan `'4/5'`); kadrlar shaffof (PNG alpha) yoki oq fonli bo‘lsa ham ishlaydi.

## Hikoya (5 ta bob)

`<section class="story">` ichida 5 ta `<figure class="chapter">` bor. Har bir bob — `img/story/` dagi surat
(kesilmaydi, to‘liq ko‘rinadi) + `chapter__statement` (katta jumla) + `chapter__text`. Bobning `style`
atributida: `--bg` (fon gradienti — suratning rangiga moslangan), `--accent` (raqam va nuqta rangi),
`--fg` (matn rangi, faqat och fonda kerak). Bob qo‘shsangiz/olib tashlasangiz, JS o‘zi sanaydi.

## Hero ("Orbit")

Banka `img/cut/jar.webp` — shaffof fonli surat. Boshqa mahsulot surati qo‘ymoqchi bo‘lsangiz, xuddi shunday
shaffof PNG/WebP tayyorlab, shu nom bilan almashtiring. Atrofidagi 9 ta element (`.orb`) JS bilan ellips bo‘ylab
aylanadi: `index.html` dagi `orbit()` funksiyasida tezlik (`t * 0.00010`) va ellips o‘lchamlari (`a`, `b`) sozlanadi.

## Forma serverga nimani yuboradi (POST /api/lead, JSON)

`name`, `phone` (+998XXXXXXXXX), `product`, `page`, `referrer`, `sent_at`, `utm_source`, `utm_medium`,
`utm_campaign`, `utm_content`, `utm_term`, `fbclid`, `gclid`. Server javobi `{ "ok": true, "id": <lead id> }`.
