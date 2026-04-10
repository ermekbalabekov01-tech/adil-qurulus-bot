const axios = require('axios');

async function sendLeadToBitrix(data) {
  try {
    const webhook = process.env.BITRIX_WEBHOOK;

    if (!webhook) {
      console.log('❌ Нет BITRIX_WEBHOOK');
      return false;
    }

    const url = `${webhook}crm.lead.add.json`;

    const response = await axios.post(url, {
      fields: {
        TITLE: 'Заявка с WhatsApp',
        NAME: data.name || 'Не указано',
        PHONE: data.phone
          ? [{ VALUE: data.phone, VALUE_TYPE: 'WORK' }]
          : [],
        COMMENTS: data.comment || 'Без комментария'
      }
    });

    console.log('✅ Лид отправлен в Bitrix:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Ошибка Bitrix:', error.response?.data || error.message);
    return false;
  }
}

module.exports = { sendLeadToBitrix };