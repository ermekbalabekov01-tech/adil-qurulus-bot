const axios = require("axios");

function normalizePhone(phone = "") {
  return String(phone).replace(/\D/g, "");
}

function buildWhatsAppLink(phone = "") {
  const clean = normalizePhone(phone);
  if (!clean) return "";
  return `https://wa.me/${clean}`;
}

function buildClinicTelegramText(lead = {}) {
  const leadType = lead.leadType || "consultation";

  if (leadType === "training") {
    return [
      "🎓 НОВАЯ ЗАЯВКА — ОБУЧЕНИЕ",
      "",
      `👤 Имя: ${lead.name || "Не указано"}`,
      `📱 Телефон: ${lead.phone || lead.whatsapp || "Не указано"}`,
      `📍 Город: ${lead.city || lead.location || "Не указано"}`,
      `📝 Интерес: ${lead.service || lead.projectDetails || "Не указано"}`,
      `💬 WhatsApp: ${lead.whatsapp || "Не указано"}`,
      "",
      "⚡ Нужна быстрая обратная связь по обучению",
    ].join("\n");
  }

  return [
    "🌿 НОВАЯ ЗАЯВКА — КЛИНИКА",
    "",
    `👤 Имя: ${lead.name || "Не указано"}`,
    `📱 Телефон: ${lead.phone || lead.whatsapp || "Не указано"}`,
    `📍 Город: ${lead.city || lead.location || "Не указано"}`,
    `💉 Услуга: ${lead.service || lead.projectDetails || "Не указано"}`,
    `🖼 Фото: ${lead.photoStatus || "Не указано"}`,
    `📅 Дата: ${lead.visitDay || "Не указано"}`,
    `⏰ Время: ${lead.visitTime || lead.preferredTime || "Не указано"}`,
    `💬 WhatsApp: ${lead.whatsapp || "Не указано"}`,
    "",
    "⚡ Предварительная запись оформлена, нужно подтверждение",
  ].join("\n");
}

async function sendClinicTelegramLead(lead = {}) {
  try {
    const token = process.env.CLINIC_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.CLINIC_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      console.log("⚠️ Clinic Telegram not configured");
      return false;
    }

    const text = buildClinicTelegramText(lead);
    const waLink = buildWhatsAppLink(lead.phone || lead.whatsapp);

    const inline_keyboard = waLink
      ? [
          [
            {
              text: "Открыть WhatsApp",
              url: waLink,
            },
          ],
        ]
      : undefined;

    await axios.post(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        chat_id: chatId,
        text,
        reply_markup: inline_keyboard ? { inline_keyboard } : undefined,
        disable_web_page_preview: true,
      },
      {
        timeout: 30000,
      }
    );

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