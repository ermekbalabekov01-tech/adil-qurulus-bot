const axios = require("axios");

async function sendClinicTelegramLead(lead = {}) {
  try {
    const token = process.env.CLINIC_TELEGRAM_BOT_TOKEN;
    const chatId = process.env.CLINIC_TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      console.log("⚠️ Clinic Telegram not configured");
      return false;
    }

    const isFinal = lead.telegramType === "final";
    const header = isFinal
      ? "✅ ФИНАЛЬНАЯ ЗАЯВКА КЛИНИКА"
      : "🔥 НОВЫЙ ВХОД КЛИНИКА";

    const lines = [
      header,
      "",
      `Тип: ${lead.leadType || "consultation"}`,
      `Имя: ${lead.name || "Не указано"}`,
      `Телефон: ${lead.phone || "Не указано"}`,
      `WhatsApp: ${lead.whatsapp || "Не указано"}`,
      `Город: ${lead.city || "Не указано"}`,
      `Услуга: ${lead.service || "Не указано"}`,
      `День: ${lead.visitDay || "Не указано"}`,
      `Время: ${lead.visitTime || "Не указано"}`,
      `Фото: ${lead.photoStatus || "Не указано"}`,
      `Первое сообщение: ${lead.firstMessage || "Не указано"}`,
      `Комментарий: ${lead.projectDetails || "Не указано"}`,
    ];

    const text = lines.join("\n");

    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text,
    });

    console.log("✅ Clinic Telegram lead sent");
    return true;
  } catch (error) {
    console.error("❌ Clinic Telegram error:", error.response?.data || error.message);
    return false;
  }
}

module.exports = {
  sendClinicTelegramLead,
};