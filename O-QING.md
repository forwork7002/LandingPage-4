# Sinolife landing — yangilangan versiya

## Nima o‘zgardi

- Sahifa butunlay qayta yozildi: **mobil birinchi**, gorizontal siljish yo‘q, tugmalar 52–56 px,
  inputlar 17 px (iOS o‘zi zoom qilmaydi), iPhone’ning pastki chizig‘i uchun `safe-area` hisobga olingan.
- **Olib tashlandi:** «Qanday ichiladi», tarkib jadvali, dozalash, galereya, uzun mahsulot matnlari.
  Maqsad — mijozni operatorga ulash, saytda o‘qitib o‘tirish emas.
- **Qo‘shildi:** hero ichida forma (birinchi ekranda), pastda doimiy panel
  «Qo‘ng‘iroq / Buyurtma qoldirish», «15 daqiqa ichida qo‘ng‘iroq qilamiz» va’dasi,
  telefon maskasi `+998 XX XXX XX XX`, bot-filtr (honeypot), UTM/fbclid saqlash.
- **Narx** — ixtiyoriy. `CONFIG.price` bo‘sh bo‘lsa sahifada narx umuman ko‘rinmaydi va
  «narxni operator aytadi» deb yoziladi. To‘ldirsangiz — chiroyli blokda chiqadi.
- 4 ta papka = 4 xil dizayn, lekin bitta struktura: 1 — kakao/oltin, 2 — yorug‘ pushti,
  3 — dengiz (yashil-ko‘k), 4 — qorong‘i premium.

## Sahifa sozlamalari

`public/index.html` oxiridagi `CONFIG` bloki:

```js
var CONFIG = {
  leadEndpoint: '/api/lead',
  phone:        '+998555004656',
  phoneDisplay: '55 500 46 56',
  instagram:    'https://instagram.com/sinolifeuz',
  telegram:     'https://t.me/sinolife_manager',
  productName:  'Sinolife Collagen 10 000 mg',
  price:        '',          // '249 000' — bo'sh bo'lsa narx ko'rsatilmaydi
  oldPrice:     '',          // '349 000'
  priceTag:     '',          // 'Aksiya -30%'
  pixelId:      ''           // Meta Pixel ID
};
```

Mijozlar fikri (`.voice` bloklari) — hozircha namuna. Haqiqiylari bilan almashtiring.

## Bitrix24 — sayt so‘rovi qayerga tushadi

Endi **lid emas, sdelka** yaratiladi:

```
Sdelkalar → voronka "Регистрация" → bosqich "Веб-сайт (лид)"
```

Ishlash tartibi:

1. Mijoz formani yuboradi.
2. Server telefon bo‘yicha mavjud kontaktni qidiradi (`crm.duplicate.findbycomm`).
   Topilsa — o‘sha kontaktga bog‘laydi va izohga «takroriy murojaat» deb yozadi.
   Topilmasa — yangi kontakt ochadi.
3. `crm.deal.add` bilan sdelka yaratadi: `CATEGORY_ID` = Регистрация, `STAGE_ID` = Веб-сайт (лид),
   `SOURCE_ID=WEB`, sarlavha `Sayt Collagen — Ism`, izohda ism, telefon, sahifa, UTM, IP, qurilma.

Voronka va bosqich **nomi bo‘yicha avtomatik topiladi** — ID larni qo‘lda kiritish shart emas.

### O‘rnatish

1. Bitrix24 da webhook oching: CRM → Разработчикам → Другое → **Входящий вебхук**, huquq: `CRM`.
2. `start.sh` ichida webhookni yozing:

```bash
export BITRIX_WEBHOOK="https://obey.bitrix24.kz/rest/1/SIZNING_KODINGIZ/"
export BITRIX_DEAL_CATEGORY_NAME="Регистрация"
export BITRIX_DEAL_STAGE_NAME="Веб-сайт"
export ADMIN_KEY="uzoq-tasodifiy-kalit"
```

3. Ishga tushiring:

```bash
cp sinolife-landing.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now sinolife-landing
journalctl -u sinolife-landing -f
```

Log’da shunday chiqishi kerak:

```
[bitrix] voronka "Регистрация" (ID 7) → bosqich "Веб-сайт (лид)" (C7:NEW)
```

### Agar nom bo‘yicha topilmasa

Brauzerda oching:

```
http://SERVER:3000/api/bitrix/stages?key=SIZNING_ADMIN_KEY
```

Barcha voronkalar va bosqichlar ID si bilan chiqadi. Keraklisini `start.sh` ga yozing:

```bash
export BITRIX_DEAL_CATEGORY_ID="7"
export BITRIX_DEAL_STAGE_ID="C7:NEW"
```

### Tekshirish

```bash
curl -X POST http://SERVER:3000/api/lead \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test","phone":"998901234567","product":"Collagen"}'
```

`{"ok":true,"id":12345}` qaytsa — Bitrix24 da sdelka paydo bo‘lgan.

## Boshqa sozlamalar (`start.sh`)

| O‘zgaruvchi | Ma’nosi |
|---|---|
| `BITRIX_ASSIGNED_BY` | mas’ul xodim ID (bo‘sh — webhook egasi) |
| `BITRIX_DEAL_TITLE` | sarlavha shabloni, `{name}` `{phone}` `{product}` |
| `BITRIX_DEAL_AMOUNT` | sdelka summasi, masalan `249000` |
| `BITRIX_CREATE_CONTACT=0` | kontakt yaratmaslik |
| `BITRIX_EXTRA_FIELDS` | qo‘shimcha maydonlar JSON: `{"UF_CRM_...":"..."}` |
| `ALLOWED_ORIGIN` | sayt boshqa domenda bo‘lsa CORS |

## Statik hosting (GitHub Pages) haqida

`public/` papkasini statik joylasangiz sayt ochiladi, lekin **forma ishlamaydi** —
`/api/lead` uchun `server.js` kerak. Bunday holda `CONFIG.leadEndpoint` ga
serveringizning to‘liq manzilini yozing (`https://api.sinolife.uz/api/lead`) va
`start.sh` da `ALLOWED_ORIGIN` ni oching.
