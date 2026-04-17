const axios = require('axios');

function formatWhatsAppLink(phone) {
  if (!phone) return '';
  const clean = String(phone).replace(/\D/g, '');
  return `https://wa.me/${clean}`;
}

async function sendClinicTelegramLead(data) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      console.log('❌ TELEGRAM ENV нет');
      return;
    }

    const waLink = formatWhatsAppLink(data.phone);

    const text = `
🔥 <b>НОВАЯ ЗАЯВКА (КЛИНИКА)</b>

👤 <b>Клиент:</b> ${data.name || '—'}
📱 <b>Телефон:</b> ${data.phone || '—'}
📍 <b>Город:</b> ${data.city || '—'}

💉 <b>Услуга:</b> ${data.service || '—'}

📅 <b>Дата:</b> ${data.date || '—'}
⏰ <b>Время:</b> ${data.time || '—'}

🖼 <b>Фото:</b> ${data.photo ? 'есть' : 'нет'}

${waLink ? `👉 <a href="${waLink}">Написать в WhatsApp</a>` : ''}

━━━━━━━━━━━━━━━
⚡ Быстро обработать заявку
`;

    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    });

    console.log('✅ Telegram отправлено');
  } catch (e) {
    console.log('❌ Telegram error:', e?.response?.data || e.message);
  }
}

module.exports = {
  sendClinicTelegramLead
};