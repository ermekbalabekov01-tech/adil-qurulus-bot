const axios = require('axios');

async function sendTelegramMessage(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.log('⚠️ Telegram не настроен');
    return;
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  await axios.post(url, {
    chat_id: chatId,
    text,
    disable_web_page_preview: true
  });
}

module.exports = { sendTelegramMessage };