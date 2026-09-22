# GitHub'ga joylash va jonli link olish

## 0. Muhim: sayt va forma ikki xil narsa

| Nima | Qayerda ishlaydi |
|---|---|
| Sayt ko‘rinishi (dizayn, rasm, matn) | GitHub Pages — bepul, `https://...github.io/...` |
| Forma → Bitrix24 sdelka | **faqat `server.js` turgan serverda** (DigitalOcean) |

GitHub Pages — statik hosting, u Node ishlata olmaydi. Shuning uchun ikki yo‘l bor:

- **A yo‘l (tavsiya):** hammasini o‘z serveringizda (domen bilan) ishlatasiz — forma ham, sayt ham bitta joyda.
- **B yo‘l:** sayt Pages'da, forma serveringizdagi API'ga boradi (quyida sozlash bor).

---

## A yo‘l — hammasi o‘z serveringizda (eng sodda, forma 100% ishlaydi)

Har bir landing uchun alohida port. Serverda (root):

```bash
cd /root
mkdir -p sinolife-1 && cd sinolife-1
# zip'ni shu yerga yuklang va oching
unzip -o LandingPage-1-main-YANGI.zip
nano start.sh          # BITRIX_WEBHOOK va ADMIN_KEY ni yozing, PORT=3001
cp sinolife-landing.service /etc/systemd/system/sinolife-1.service
nano /etc/systemd/system/sinolife-1.service   # WorkingDirectory=/root/sinolife-1
systemctl daemon-reload && systemctl enable --now sinolife-1
journalctl -u sinolife-1 -n 30 --no-pager
```

Log'da quyidagi chiqsa — Bitrix ulangan:

```
[bitrix] voronka "Регистрация" (ID 7) → bosqich "Веб-сайт (лид)" (C7:NEW)
```

Keyin nginx orqali domen ulang:

```nginx
server {
    server_name collagen.sinolife.uz;
    location / { proxy_pass http://127.0.0.1:3001; proxy_set_header Host $host; }
}
```

```bash
certbot --nginx -d collagen.sinolife.uz
```

Tayyor — `https://collagen.sinolife.uz` jonli link, forma ham ishlaydi.

---

## B yo‘l — GitHub Pages

### 1. Fayllarni repo'ga yuklash

Kompyuteringizda, har bir repo uchun (misol: LandingPage-1):

```bash
git clone https://github.com/forwork7002/LandingPage-1.git
cd LandingPage-1

# eski fayllarni o'chirib, yangi zip ichidagilarni ko'chiring
rm -rf public index.html img fonts server.js start.sh
unzip -o ~/Downloads/LandingPage-1-main-YANGI.zip -d .

git add -A
git commit -m "Yangi mobil-birinchi landing + Bitrix24 sdelka integratsiyasi"
git push origin main
```

Qolgan uchtasi ham xuddi shunday: `Landingpage-2`, `LandingPage-3`, `LandingPage-4`.

### 2. Pages'ni yoqish

Har bir repo'da: **Settings → Pages → Source: Deploy from a branch → Branch: `gh-pages` / `(root)` → Save**

`push` qilgandan keyin `.github/workflows/pages.yml` avtomatik ishlaydi va `gh-pages`
branchini yaratadi. Actions tabida yashil belgi chiqishini kuting (1–2 daqiqa).

### 3. Jonli linklar

```
https://forwork7002.github.io/LandingPage-1/
https://forwork7002.github.io/Landingpage-2/
https://forwork7002.github.io/LandingPage-3/
https://forwork7002.github.io/LandingPage-4/
```

### 4. Formani ishlatish (majburiy qadam)

Pages'da `/api/lead` yo‘q. Shuning uchun `public/index.html` ichidagi `CONFIG` da
serveringizning to‘liq manzilini yozing:

```js
leadEndpoint: 'https://api.sinolife.uz/api/lead',
```

Va serverdagi `start.sh` da o‘sha domenga ruxsat bering:

```bash
export ALLOWED_ORIGIN="https://forwork7002.github.io"
```

Aks holda forma "Yuborib bo‘lmadi, qo‘ng‘iroq qiling" deb xato beradi.

---

## Tekshirish ro‘yxati

- [ ] `journalctl` da `[bitrix] voronka ... → bosqich ...` qatori bor
- [ ] `curl -X POST .../api/lead -d '{"name":"Test","phone":"998901234567"}'` → `{"ok":true,"id":...}`
- [ ] Bitrix24 → Sdelkalar → Регистрация → «Веб-сайт (лид)» da test sdelka paydo bo‘ldi
- [ ] Telefondan saytni ochib, formani to‘ldirib ko‘rdingiz
- [ ] `CONFIG.price` — narx ko‘rsatiladimi yoki yo‘qmi, hal qildingiz
- [ ] Otzivlar haqiqiylari bilan almashtirildi
