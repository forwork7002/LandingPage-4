#!/bin/bash
# Sinolife Collagen landing — ishga tushirish skripti (systemd shu faylni chaqiradi)

export PORT=80

# Bitrix24 → CRM → Разработчикам → Другое → Входящий вебхук (huquq: CRM)
export BITRIX_WEBHOOK="https://SIZNING-DOMEN.bitrix24.ru/rest/1/XXXXXXXXXXXXXXXX/"

# Ixtiyoriy:
# export BITRIX_SOURCE_ID=WEB
# export BITRIX_STATUS_ID=NEW
# export BITRIX_ASSIGNED_BY=1
# export BITRIX_EXTRA_FIELDS='{"UF_CRM_1700000000":"Collagen"}'
# export ALLOWED_ORIGIN="https://sinolife.uz"

cd /root/sinolife-landing
exec node server.js
