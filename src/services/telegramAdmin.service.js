const axios = require("axios");

async function sendTelegramAdmin(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  console.log("TOKEN:", token ? "есть" : "нет");
  console.log("CHAT_ID:", chatId || "нет");

  if (!token || !chatId) {
    console.log("❌ Telegram admin env missing");
    return;
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    const response = await axios.post(
      url,
      {
        chat_id: chatId,
        text,
        parse_mode: "HTML",
      },
      {
        timeout: 30000,
      }
    );

    console.log("✅ Telegram admin message sent");
    console.log("TELEGRAM RESPONSE:", response.data);
  } catch (err) {
    console.error(
      "❌ Telegram admin error:",
      err.response?.data || err.message || err
    );
  }
}

module.exports = { sendTelegramAdmin };