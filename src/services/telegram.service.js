const axios = require("axios");

async function sendTelegramLead(lead = {}) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      console.log("⚠️ Construction Telegram not configured");
      return false;
    }

    const isFinal = lead.telegramType === "final";
    const header = isFinal
      ? "✅ ФИНАЛЬНАЯ ЗАЯВКА СТРОЙКА"
      : "🔥 НОВЫЙ ВХОД СТРОЙКА";

    const lines = [
      header,
      "",
      `Имя: ${lead.name || "Не указано"}`,
      `Телефон: ${lead.phone || "Не указано"}`,
      `WhatsApp: ${lead.whatsapp || "Не указано"}`,
      `Направление: ${lead.direction || "Не указано"}`,
      `Локация: ${lead.location || "Не указано"}`,
      `Площадь: ${lead.size || "Не указано"}`,
      `Участок: ${lead.plot || "Не указано"}`,
      `Сроки: ${lead.timing || "Не указано"}`,
      `Первое сообщение: ${lead.firstMessage || "Не указано"}`,
      `Комментарий: ${lead.projectDetails || "Не указано"}`,
    ];

    const text = lines.join("\n");

    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text,
    });

    console.log("✅ Construction Telegram lead sent");
    return true;
  } catch (error) {
    console.error("❌ Telegram error:", error.response?.data || error.message);
    return false;
  }
}

module.exports = {
  sendTelegramLead,
};