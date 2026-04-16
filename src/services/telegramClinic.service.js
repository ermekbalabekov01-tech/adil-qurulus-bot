const axios = require("axios");

async function sendClinicTelegramLead(lead = {}) {
  try {
    const token = process.env.CLINIC_TELEGRAM_BOT_TOKEN;
    const chatId = process.env.CLINIC_TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      console.log("⚠️ Clinic Telegram not configured");
      console.log("TOKEN:", token);
      console.log("CHAT_ID:", chatId);
      return false;
    }

    const text = `
🌿 Новая заявка по клинике

Имя: ${lead.name || "Не указано"}
Телефон: ${lead.phone || lead.whatsapp || "Не указано"}
Город: ${lead.city || "Не указано"}
Услуга: ${lead.service || "Не указано"}
Консультация: ${lead.hadConsultation || "Не указано"}
Фото: ${lead.photoStatus || "Не указано"}
Когда: ${lead.visitTime || "Не указано"}
WhatsApp: ${lead.whatsapp || "Не указано"}
`;

    const res = await axios.post(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        chat_id: chatId,
        text,
      }
    );

    console.log("✅ SENT:", res.data);
    return true;

  } catch (error) {
    console.error("❌ ERROR:");
    console.error(error.response?.data || error.message);
    return false;
  }
}

module.exports = { sendClinicTelegramLead };