const axios = require("axios");

function normalizePhone(phone = "") {
  return String(phone || "").replace(/\D/g, "");
}

function buildWhatsAppLink(phone = "") {
  const clean = normalizePhone(phone);
  if (!clean) return "";
  return `https://wa.me/${clean}`;
}

function buildCallLink(phone = "") {
  const clean = normalizePhone(phone);
  if (!clean) return "";
  return `tel:+${clean}`;
}

function escapeHtml(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildDirectionLabel(direction = "") {
  const value = String(direction || "").toLowerCase();

  if (value.includes("foundation")) return "Фундамент";
  if (value.includes("house")) return "Дом";
  if (value.includes("cottage")) return "Коттедж";
  if (value.includes("consultation")) return "Консультация";

  return direction || "Не указано";
}

function buildConstructionTelegramHtml(lead = {}) {
  const isFinal = lead.telegramType === "final";
  const phone = lead.phone || lead.whatsapp || "Не указано";
  const waLink = buildWhatsAppLink(phone);

  const title = isFinal
    ? "🏗️ <b>Новая заявка — Adil Qurulus</b>"
    : "🔥 <b>Новый вход — Adil Qurulus</b>";

  const phoneLine =
    phone && phone !== "Не указано"
      ? `<a href="${waLink}">${escapeHtml(phone)}</a>`
      : "Не указано";

  const lines = [
    title,
    "",
    `👤 <b>Имя:</b> ${escapeHtml(lead.name || "Не указано")}`,
    `☎️ <b>Телефон:</b> ${phoneLine}`,
    `💬 <b>WhatsApp:</b> ${escapeHtml(lead.whatsapp || "Не указано")}`,
    `📁 <b>Направление:</b> ${escapeHtml(buildDirectionLabel(lead.direction))}`,
    `📍 <b>Локация:</b> ${escapeHtml(lead.location || "Не указано")}`,
    `📐 <b>Размер:</b> ${escapeHtml(lead.size || "Не указано")}`,
  ];

  if (lead.plot && lead.plot !== "Не указано") {
    lines.push(`🧱 <b>Участок:</b> ${escapeHtml(lead.plot)}`);
  }

  if (lead.timing && lead.timing !== "Не указано") {
    lines.push(`⏳ <b>Сроки:</b> ${escapeHtml(lead.timing)}`);
  }

  if (!isFinal && lead.firstMessage) {
    lines.push(`🗨️ <b>Первое сообщение:</b> ${escapeHtml(lead.firstMessage)}`);
  }

  if (lead.projectDetails && lead.projectDetails !== "Не указано") {
    lines.push(`📝 <b>Комментарий:</b> ${escapeHtml(lead.projectDetails)}`);
  }

  lines.push("");
  lines.push(
    isFinal
      ? "✅ <b>Лид зафиксирован ботом</b>"
      : "👀 <b>Новый вход, желательно быстро подхватить</b>"
  );

  return lines.join("\n");
}

async function sendTelegramLead(lead = {}) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      console.log("⚠️ Construction Telegram not configured");
      return false;
    }

    const html = buildConstructionTelegramHtml(lead);
    const waLink = buildWhatsAppLink(lead.phone || lead.whatsapp);
    const callLink = buildCallLink(lead.phone || lead.whatsapp);

    const buttons = [];

    if (waLink) {
      buttons.push({
        text: "👉 Написать в WhatsApp",
        url: waLink,
      });
    }

    if (callLink) {
      buttons.push({
        text: "📞 Позвонить",
        url: callLink,
      });
    }

    const inline_keyboard = buttons.length ? [buttons] : undefined;

    await axios.post(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        chat_id: chatId,
        text: html,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: inline_keyboard ? { inline_keyboard } : undefined,
      },
      { timeout: 30000 }
    );

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