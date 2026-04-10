const axios = require('axios');

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildLeadText(lead = {}) {
  const lines = ['<b>🏗 Новая заявка — Adil Qurulus</b>', ''];

  if (lead.whatsapp) lines.push(`📞 <b>WhatsApp:</b> ${escapeHtml(lead.whatsapp)}`);
  if (lead.name) lines.push(`👤 <b>Имя:</b> ${escapeHtml(lead.name)}`);
  if (lead.phone) lines.push(`☎️ <b>Телефон:</b> ${escapeHtml(lead.phone)}`);
  if (lead.direction) lines.push(`📂 <b>Направление:</b> ${escapeHtml(lead.direction)}`);
  if (lead.houseStage) lines.push(`🏠 <b>Этап:</b> ${escapeHtml(lead.houseStage)}`);
  if (lead.location) lines.push(`📍 <b>Локация:</b> ${escapeHtml(lead.location)}`);
  if (lead.projectStatus) lines.push(`📐 <b>Проект:</b> ${escapeHtml(lead.projectStatus)}`);
  if (lead.size) lines.push(`📏 <b>Размер:</b> ${escapeHtml(lead.size)}`);
  if (lead.timing) lines.push(`⏳ <b>Сроки:</b> ${escapeHtml(lead.timing)}`);
  if (lead.budget) lines.push(`💰 <b>Бюджет:</b> ${escapeHtml(lead.budget)}`);
  if (lead.repairObject) lines.push(`🏢 <b>Объект:</b> ${escapeHtml(lead.repairObject)}`);
  if (lead.repairType) lines.push(`🛠 <b>Тип ремонта:</b> ${escapeHtml(lead.repairType)}`);
  if (lead.area) lines.push(`📐 <b>Площадь:</b> ${escapeHtml(lead.area)}`);
  if (lead.serviceType) lines.push(`🔧 <b>Услуга:</b> ${escapeHtml(lead.serviceType)}`);
  if (lead.scope) lines.push(`📝 <b>Объём работ:</b> ${escapeHtml(lead.scope)}`);
  if (lead.calcType) lines.push(`🧮 <b>Тип расчёта:</b> ${escapeHtml(lead.calcType)}`);
  if (lead.calcRequest) lines.push(`📋 <b>Запрос:</b> ${escapeHtml(lead.calcRequest)}`);

  lines.push('');
  lines.push('✅ <b>Лид зафиксирован ботом</b>');

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

    const response = await axios.post(
      url,
      {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Telegram sent:', response.data?.ok);
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