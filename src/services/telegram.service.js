const axios = require('axios');

async function sendTelegramMessage(text) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      console.log('⚠️ Telegram не настроен');
      return;
    }

    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    const response = await axios.post(url, {
      chat_id: chatId,
      text,
      disable_web_page_preview: true
    });

    console.log('✅ Telegram sent:', response.data?.ok);
  } catch (error) {
    console.error('❌ Telegram error:', error.response?.data || error.message);
  }
}

module.exports = { sendTelegramMessage };