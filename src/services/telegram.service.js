const axios = require("axios");

/* ================= HELPERS ================= */

function normalizePhone(phone = "") {
  return String(phone || "").replace(/\D/g, "");
}

function buildWhatsAppLink(phone = "") {
  const clean = normalizePhone(phone);
  return clean ? `https://wa.me/${clean}` : "";
}

function buildCallLink(phone = "") {
  const clean = normalizePhone(phone);
  return clean ? `tel:+${clean}` : "";
}

function escapeHtml(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* ================= SEND ================= */

async function sendTelegramMessage({ text, phone }) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.log("⚠️ Telegram not configured");
    return false;
  }

  const wa = buildWhatsAppLink(phone);
  const call = buildCallLink(phone);

  const buttons = [];

  if (wa) buttons.push({ text: "💬 WhatsApp", url: wa });
  if (call) buttons.push({ text: "📞 Позвонить", url: call });

  try {
    await axios.post(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        reply_markup: buttons.length ? { inline_keyboard: [buttons] } : undefined,
      }
    );

    return true;
  } catch (e) {
    console.log("❌ TG ERROR:", e.response?.data || e.message);
    return false;
  }
}

/* ================= TYPES ================= */

// 🔥 1. НОВЫЙ ВХОД
async function sendTelegramNewLead({ firstMessage, phone }) {
  return sendTelegramMessage({
    phone,
    text: `
🔥 <b>Новый вход — Adil Qurulus</b>

📩 <b>Сообщение:</b>
${escapeHtml(firstMessage)}

📱 ${escapeHtml(phone || "Не указано")}
`,
  });
}

// 💬 2. ПЕРЕПИСКА
async function sendTelegramConversation({ clientText, botText, phone }) {
  return sendTelegramMessage({
    phone,
    text: `
💬 <b>Переписка</b>

👤 <b>Клиент:</b>
${escapeHtml(clientText)}

🤖 <b>Бот:</b>
${escapeHtml(botText)}

📱 ${escapeHtml(phone || "—")}
`,
  });
}

// ✅ 3. ФИНАЛ
async function sendTelegramLead(lead = {}) {
  return sendTelegramMessage({
    phone: lead.phone,
    text: `
🏗️ <b>Новая заявка — Adil Qurulus</b>

👤 <b>Имя:</b> ${escapeHtml(lead.name)}
☎️ <b>Телефон:</b> ${escapeHtml(lead.phone)}
📍 <b>Локация:</b> ${escapeHtml(lead.location)}
📐 <b>Размер:</b> ${escapeHtml(lead.size)}
⏳ <b>Сроки:</b> ${escapeHtml(lead.timing)}
📁 <b>Тип:</b> ${escapeHtml(lead.direction)}

📝 <b>Комментарий:</b>
${escapeHtml(lead.projectDetails)}
`,
  });
}

module.exports = {
  sendTelegramLead,
  sendTelegramNewLead,
  sendTelegramConversation,
};