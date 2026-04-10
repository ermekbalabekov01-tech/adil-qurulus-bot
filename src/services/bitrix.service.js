const axios = require('axios');

function normalizePhone(phone = '') {
  return String(phone).replace(/\D/g, '');
}

async function sendLeadToBitrix(data) {
  try {
    const webhook = process.env.BITRIX_WEBHOOK;

    if (!webhook) {
      console.log('❌ Нет BITRIX_WEBHOOK');
      return false;
    }

    const url = `${webhook}crm.lead.add.json`;

    const payload = {
      fields: {
        TITLE: 'Заявка с WhatsApp',
        NAME: data.name || 'Не указано',
        PHONE: data.phone
          ? [{ VALUE: normalizePhone(data.phone), VALUE_TYPE: 'WORK' }]
          : [],
        COMMENTS: data.comment || 'Без комментария'
      }
    };

    console.log('📤 BITRIX PAYLOAD:', JSON.stringify(payload, null, 2));

    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ BITRIX SENT:', response.data);
    return true;
  } catch (error) {
    console.error('❌ BITRIX ERROR:', error.response?.data || error.message);
    return false;
  }
}

module.exports = { sendLeadToBitrix };