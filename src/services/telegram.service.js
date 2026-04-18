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

function buildConstructionHeader(lead = {}) {
  return lead.telegramType === "final"
    ? "✅ <b>ФИНАЛЬНАЯ ЗАЯВКА — СТРОЙКА</b>"
    : "🔥 <b>НОВЫЙ ВХОД — СТРОЙКА</b>";
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

  const lines = [
    buildConstructionHeader(lead),
    "",
    "🏗️ <b>Проект:</b> Adil Qurulus",
    `👤 <b>Имя:</b> ${escapeHtml(lead.name || "Не указано")}`,
    `📞 <b>Телефон:</b> ${escapeHtml(lead.phone || lead.whatsapp || "Не указано")}`,
    `💬 <b>WhatsApp:</b> ${escapeHtml(lead.whatsapp || "Не указано")}`,
    `📌 <b>Направление:</b> ${escapeHtml(buildDirectionLabel(lead.direction))}`,
    `📍 <b>Локация:</b> ${escapeHtml(lead.location || "Не указано")}`,
    `📐 <b>Площадь:</b> ${escapeHtml(lead.size || "Не указано")}`,
    `🧱 <b>Участок:</b> ${escapeHtml(lead.plot || "Не указано")}`,
    `⏳ <b>Сроки:</b> ${escapeHtml(lead.timing || "Не указано")}`,
  ];

  if (!isFinal) {
    lines.push(`🗨️ <b>Первое сообщение:</b> ${escapeHtml(lead.firstMessage || "Не указано")}`);
  }

  lines.push(`📝 <b>Комментарий:</b> ${escapeHtml(lead.projectDetails || "Не указано")}`);
  lines.push("");
  lines.push(
    isFinal
      ? "⚡ <b>Приоритет:</b> клиент дошёл до финала, нужен быстрый контакт."
      : "👀 <b>Приоритет:</b> новый вход, желательно быстро подхватить."
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