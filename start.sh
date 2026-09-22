#!/bin/bash
# Sinolife landing — ishga tushirish skripti (systemd shu faylni chaqiradi)

export PORT=3000

# Bitrix24 → CRM → Разработчикам → Другое → Входящий вебхук
# Huquqlar: CRM (crm). Manzil oxirida "/" bo'lsin.
export BITRIX_WEBHOOK="https://obey.bitrix24.kz/rest/1/XXXXXXXXXXXXXXXX/"

# Sdelka qayerga tushadi — NOM bo'yicha avtomatik topiladi:
export BITRIX_DEAL_CATEGORY_NAME="Регистрация"
export BITRIX_DEAL_STAGE_NAME="Веб-сайт"

# Agar nom bo'yicha topilmasa, ID larni qo'lda yozing.
# ID larni bilish uchun: ADMIN_KEY ni to'ldiring va brauzerda oching:
#   http://SERVER:3000/api/bitrix/stages?key=SIZNING_KALIT
# export BITRIX_DEAL_CATEGORY_ID="7"
# export BITRIX_DEAL_STAGE_ID="C7:NEW"

export BITRIX_SOURCE_ID="WEB"
export BITRIX_DEAL_TITLE="Sayt Collagen — {name}"
export ADMIN_KEY="ozgartiring-bu-kalitni"

# Ixtiyoriy:
# export BITRIX_ASSIGNED_BY=1
# export BITRIX_DEAL_AMOUNT=249000
# export BITRIX_CURRENCY=UZS
# export BITRIX_CREATE_CONTACT=1
# export BITRIX_EXTRA_FIELDS='{"UF_CRM_1700000000":"Collagen"}'
# export ALLOWED_ORIGIN="https://sinolife.uz"

cd "$(dirname "$0")"
exec node server.js
