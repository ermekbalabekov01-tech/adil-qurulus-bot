const axios = require('axios');

function buildLeadText(lead = {}) {
  const lines = ['🏗 Новая заявка — Adil Qurulus', ''];

  if (lead.whatsapp) lines.push(`WhatsApp: ${lead.whatsapp}`);
  if (lead.name) lines.push(`Имя: ${lead.name}`);
  if (lead.phone) lines.push(`Телефон: ${lead.phone}`);
  if (lead.direction) lines.push(`Направление: ${lead.direction}`);
  if (lead.houseStage) lines.push(`Этап: ${lead.houseStage}`);
  if (lead.location) lines.push(`Локация: ${lead.location}`);
  if (lead.projectStatus) lines.push(`Проект: ${lead.projectStatus}`);
  if (lead.size) lines.push(`Размер: ${lead.size}`);
  if (lead.timing) lines.push(`Сроки: ${lead.timing}`);
  if (lead.budget) lines.push(`Бюджет: ${lead.budget}`);
  if (lead.repairObject) lines.push(`Объект: ${lead.repairObject}`);
  if (lead.repairType) lines.push(`Тип ремонта: ${lead.repairType}`);
  if (lead.area) lines.push(`Площадь: ${lead.area}`);
  if (lead.serviceType) lines.push(`Услуга: ${lead.serviceType}`);
  if (lead.scope) lines.push(`Объём работ: ${lead.scope}`);
  if (lead.calcType) lines.push(`Тип расчёта: ${lead.calcType}`);
  if (lead.calcRequest) lines.push(`Запрос: ${lead.calcRequest}`);

  return lines.join('\n');
}

async function sendTelegramMessage(text) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    console.log('📨 Telegram chat_id:', chatId);
    console.log('📨 Telegram token exists:', !!token);

    if (!token || !chatId) {
      console.log('⚠️ Telegram не настроен');
      return false;
    }

    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    const response = await axios.post(url, {
      chat_id: chatId,
      text,
      disable_web_page_preview: true
    });

    console.log('✅ Telegram sent:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Telegram error:', error.response?.data || error.message);
    return false;
  }
}

async function sendTelegramLead(lead = {}) {
  const text = buildLeadText(lead);
  return sendTelegramMessage(text);
}

module.exports = {
  sendTelegramMessage,
  sendTelegramLead
};