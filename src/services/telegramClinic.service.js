const axios = require("axios");

async function sendClinicTelegramLead(lead = {}) {
  try {
    const token = process.env.CLINIC_TELEGRAM_BOT_TOKEN;
    const chatId = process.env.CLINIC_TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      console.log("⚠️ Clinic Telegram not configured");
      return false;
    }

    const leadType = lead.leadType || "consultation";

    const lines =
      leadType === "training"
        ? [
            "🎓 Новая заявка по обучению",
            "",
            `Имя: ${lead.name || "Не указано"}`,
            `Телефон: ${lead.phone || lead.whatsapp || "Не указано"}`,
            `Город: ${lead.city || lead.location || "Не указано"}`,
            `Интерес: ${lead.service || lead.projectDetails || "Не указано"}`,
            `WhatsApp: ${lead.whatsapp || "Не указано"}`,
          ]
        : [
            "🌿 Новая заявка по клинике",
            "",
            "Тип: Консультация / процедура",
            `Имя: ${lead.name || "Не указано"}`,
            `Телефон: ${lead.phone || lead.whatsapp || "Не указано"}`,
            `Город: ${lead.city || lead.location || "Не указано"}`,
            `Услуга: ${lead.service || lead.projectDetails || "Не указано"}`,
            `Фото: ${lead.photoStatus || "Не указано"}`,
            `Дата: ${lead.visitDay || "Не указано"}`,
            `Время: ${lead.visitTime || lead.preferredTime || "Не указано"}`,
            `WhatsApp: ${lead.whatsapp || "Не указано"}`,
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