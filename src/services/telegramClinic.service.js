const axios = require("axios");

function normalizePhone(phone = "") {
  return String(phone || "").replace(/\D/g, "");
}

function buildWhatsAppLink(phone = "") {
  const clean = normalizePhone(phone);
  if (!clean) return "";
  return `https://wa.me/${clean}`;
}

function escapeHtml(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildClinicHeader(lead = {}) {
  return lead.telegramType === "final"
    ? "✅ <b>ФИНАЛЬНАЯ ЗАЯВКА — КЛИНИКА</b>"
    : "🔥 <b>НОВЫЙ ВХОД — КЛИНИКА</b>";
}

function buildClinicLeadTypeLabel(lead = {}) {
  const leadType = lead.leadType || "consultation";

  if (leadType === "training") return "Обучение";
  if (leadType === "incoming_interest") return "Первичный интерес";
  return "Консультация / процедура";
}

function buildClinicTelegramHtml(lead = {}) {
  const isFinal = lead.telegramType === "final";
  const leadTypeLabel = buildClinicLeadTypeLabel(lead);

  const lines = [
    buildClinicHeader(lead),
    "",
    "🌸 <b>Клиника:</b> Dr.Aitimbetova",
    `📂 <b>Тип:</b> ${escapeHtml(leadTypeLabel)}`,
    `👤 <b>Имя:</b> ${escapeHtml(lead.name || "Не указано")}`,
    `📞 <b>Телефон:</b> ${escapeHtml(lead.phone || lead.whatsapp || "Не указано")}`,
    `💬 <b>WhatsApp:</b> ${escapeHtml(lead.whatsapp || "Не указано")}`,
    `🏙️ <b>Город:</b> ${escapeHtml(lead.city || lead.location || "Не указано")}`,
    `💎 <b>Услуга:</b> ${escapeHtml(lead.service || lead.projectDetails || "Не указано")}`,
  ];

  if (lead.leadType === "training") {
    lines.push(`🎓 <b>Интерес:</b> ${escapeHtml(lead.projectDetails || "Не указано")}`);
  } else {
    lines.push(`📷 <b>Фото:</b> ${escapeHtml(lead.photoStatus || "Не указано")}`);
    lines.push(`📅 <b>Дата:</b> ${escapeHtml(lead.visitDay || "Не указано")}`);
    lines.push(`🕐 <b>Время:</b> ${escapeHtml(lead.visitTime || lead.preferredTime || "Не указано")}`);
  }

  if (!isFinal) {
    lines.push(`🗨️ <b>Первое сообщение:</b> ${escapeHtml(lead.firstMessage || "Не указано")}`);
  }

  lines.push(`📝 <b>Комментарий:</b> ${escapeHtml(lead.projectDetails || "Не указано")}`);
  lines.push("");
  lines.push(
    isFinal
      ? "⚡ <b>Приоритет:</b> клиент дошёл до финала, нужно быстро подтвердить запись."
      : "👀 <b>Приоритет:</b> новый вход, желательно быстро подхватить."
  );

  return lines.join("\n");
}

async function sendClinicTelegramLead(lead = {}) {
  try {
    const token =
      process.env.CLINIC_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
    const chatId =
      process.env.CLINIC_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      console.log("⚠️ Clinic Telegram not configured");
      return false;
    }

    const html = buildClinicTelegramHtml(lead);
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
        text: html,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: inline_keyboard ? { inline_keyboard } : undefined,
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