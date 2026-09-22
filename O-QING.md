# Sinolife Collagen — premium landing (oq, brend apelsin rangida)

`public/` — sayt. `server.js` — forma → Bitrix24 (Регистрация → Веб-сайт (лид)).

## Tez sozlash — `public/index.html` oxiridagi CONFIG

- `leadEndpoint` — Cloudflare Worker yoki server manzili (`https://xxx.workers.dev`)
- `price`, `oldPrice`, `priceTag` — bo'sh bo'lsa narx ko'rsatilmaydi
- `beforeAfter` — oldin/keyin rasmlar (`public/img/ba/` ga qo'ying, qarang `img/ba/O-QING.txt`)
- `pixelId` — Meta Pixel

## Matnlarni o'zgartirish

Hammasi `public/index.html` ichida, oddiy HTML. Mijoz fikrlari (`.ts` bloklari) — namuna,
haqiqiylari bilan almashtiring.

## Bitrix24

`cloudflare-worker.js` (chatda berilgan) — serversiz variant, yoki `server.js` + `start.sh` — o'z serveringizda.
Ikkalasi ham voronka/bosqichni nomi bo'yicha o'zi topadi, telefon bo'yicha dublikat kontaktni tekshiradi.
