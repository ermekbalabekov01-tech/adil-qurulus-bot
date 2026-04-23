const axios = require("axios");
const { routeMessage } = require("../router");
const {
  sendTelegramLead,
} = require("../services/telegram.service");
const {
  sendClinicTelegramLead,
} = require("../services/telegramClinic.service");
const { sendLeadToBitrix } = require("../services/bitrix.service");

const sessions = new Map();
const processedMessages = new Set();

/* ---------------- helpers ---------------- */

function normalizePhone(phone) {
  return String(phone || "").replace(/\D/g, "");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getTypingDelay(text = "") {
  const len = String(text || "").length;
  if (len <= 80) return 900;
  if (len <= 170) return 1400;
  if (len <= 320) return 2200;
  return 2800;
}

function cleanText(text = "") {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[ʼ'`]/g, "")
    .replace(/\s+/g, " ");
}

function escapeHtml(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getProjectConfig(phoneNumberId) {
  const constructionId = String(process.env.CONSTRUCTION_PHONE_NUMBER_ID || "");
  const clinicId = String(process.env.CLINIC_PHONE_NUMBER_ID || "");

  if (String(phoneNumberId) === constructionId) {
    return {
      projectKey: "construction",
      accessToken: process.env.CONSTRUCTION_ACCESS_TOKEN,
      phoneNumberId: process.env.CONSTRUCTION_PHONE_NUMBER_ID,
      telegramToken:
        process.env.TELEGRAM_BOT_TOKEN || process.env.CONSTRUCTION_TELEGRAM_BOT_TOKEN,
      telegramChatId:
        process.env.TELEGRAM_CHAT_ID || process.env.CONSTRUCTION_TELEGRAM_CHAT_ID,
    };
  }

  if (String(phoneNumberId) === clinicId) {
    return {
      projectKey: "clinic",
      accessToken: process.env.CLINIC_ACCESS_TOKEN,
      phoneNumberId: process.env.CLINIC_PHONE_NUMBER_ID,
      telegramToken:
        process.env.CLINIC_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN,
      telegramChatId:
        process.env.CLINIC_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID,
    };
  }

  return {
    projectKey: "construction",
    accessToken: process.env.CONSTRUCTION_ACCESS_TOKEN,
    phoneNumberId: process.env.CONSTRUCTION_PHONE_NUMBER_ID,
    telegramToken:
      process.env.TELEGRAM_BOT_TOKEN || process.env.CONSTRUCTION_TELEGRAM_BOT_TOKEN,
    telegramChatId:
      process.env.TELEGRAM_CHAT_ID || process.env.CONSTRUCTION_TELEGRAM_CHAT_ID,
  };
}

function getSession(projectKey, phone) {
  const key = `${projectKey}:${normalizePhone(phone)}`;

  if (!sessions.has(key)) {
    sessions.set(key, {
      step: "start",
      mode: "scenario",
      language: null,
      data: {},
      warmLeadSent: false,
      finalLeadSent: false,
      entryTelegramSent: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  return sessions.get(key);
}

function updateSession(projectKey, phone, patch = {}) {
  const key = `${projectKey}:${normalizePhone(phone)}`;
  const current = getSession(projectKey, phone);

  const next = {
    ...current,
    ...patch,
    data: {
      ...(current.data || {}),
      ...(patch.data || {}),
    },
    updatedAt: new Date().toISOString(),
  };

  sessions.set(key, next);
  return next;
}

function resetSession(projectKey, phone) {
  const key = `${projectKey}:${normalizePhone(phone)}`;

  const fresh = {
    step: "start",
    mode: "scenario",
    language: null,
    data: {},
    warmLeadSent: false,
    finalLeadSent: false,
    entryTelegramSent: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  sessions.set(key, fresh);
  return fresh;
}

function isGreetingReset(text = "") {
  const t = cleanText(text);

  const resetWords = [
    "здравствуйте",
    "здраствуйте",
    "привет",
    "добрый день",
    "добрый вечер",
    "доброе утро",
    "сәлем",
    "салем",
    "салам",
    "сәлеметсіз бе",
    "hello",
    "hi",
  ];

  return resetWords.some((w) => t === w || t.startsWith(`${w} `));
}

function isConstructionAdMessage(text = "") {
  const t = cleanText(text);

  return (
    t === "дом" ||
    t === "коттедж" ||
    t === "консультация" ||
    t === "расчет фундамента" ||
    t === "расчёт фундамента" ||
    t === "фундамент" ||
    t === "строительство дома" ||
    t === "строительство коттеджа" ||
    t === "үй салу" ||
    t === "коттедж салу" ||
    t === "фундамент есебі" ||
    t === "кеңес алу" ||
    t.includes("расчет") ||
    t.includes("расчёт") ||
    t.includes("стоимость") ||
    t.includes("фундамента") ||
    t.includes("сориентировать")
  );
}

function isClinicAdMessage(text = "") {
  const t = cleanText(text);

  return (
    t.includes("можно узнать об этом подробнее") ||
    t.includes("можно узнать подробнее") ||
    t.includes("расскажите подробнее") ||
    t.includes("хочу узнать подробнее") ||
    t === "подробнее"
  );
}

async function safeCall(fn, label) {
  try {
    const res = await fn();
    console.log(`✅ ${label} OK`);
    return res;
  } catch (e) {
    console.log(`❌ ${label} ERROR:`, e.response?.data || e.message);
    return false;
  }
}

/* ---------------- telegram live feed ---------------- */

async function sendRawTelegramMessage({
  token,
  chatId,
  text,
  inline_keyboard,
}) {
  if (!token || !chatId || !text) return false;

  try {
    await axios.post(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: inline_keyboard ? { inline_keyboard } : undefined,
      },
      { timeout: 30000 }
    );

    return true;
  } catch (error) {
    console.log("❌ RAW TG ERROR:", error.response?.data || error.message);
    return false;
  }
}

function buildWhatsAppLink(phone = "") {
  const clean = normalizePhone(phone);
  if (!clean) return "";
  return `https://wa.me/${clean}`;
}

async function sendTelegramEntry({
  projectKey,
  telegramToken,
  telegramChatId,
  firstMessage,
  phone,
}) {
  const waLink = buildWhatsAppLink(phone);
  const title =
    projectKey === "clinic"
      ? "🔥 <b>Новый вход — Dr.Aitimbetova</b>"
      : "🔥 <b>Новый вход — Adil Qurulus</b>";

  const text = [
    title,
    "",
    "<b>📩 Первое сообщение:</b>",
    escapeHtml(firstMessage || "—"),
    "",
    `<b>📱 WhatsApp:</b> ${escapeHtml(phone || "—")}`,
  ].join("\n");

  const inline_keyboard = waLink
    ? [[{ text: "👉 Написать в WhatsApp", url: waLink }]]
    : undefined;

  return sendRawTelegramMessage({
    token: telegramToken,
    chatId: telegramChatId,
    text,
    inline_keyboard,
  });
}

async function sendTelegramConversation({
  projectKey,
  telegramToken,
  telegramChatId,
  clientText,
  botText,
  phone,
}) {
  const waLink = buildWhatsAppLink(phone);
  const title =
    projectKey === "clinic"
      ? "💬 <b>Переписка — Dr.Aitimbetova</b>"
      : "💬 <b>Переписка — Adil Qurulus</b>";

  const text = [
    title,
    "",
    "<b>👤 Клиент:</b>",
    escapeHtml(clientText || "—"),
    "",
    "<b>🤖 Бот:</b>",
    escapeHtml(botText || "—"),
    "",
    `<b>📱 WhatsApp:</b> ${escapeHtml(phone || "—")}`,
  ].join("\n");

  const inline_keyboard = waLink
    ? [[{ text: "👉 Написать в WhatsApp", url: waLink }]]
    : undefined;

  return sendRawTelegramMessage({
    token: telegramToken,
    chatId: telegramChatId,
    text,
    inline_keyboard,
  });
}

/* ---------------- lead builders ---------------- */

function buildClinicLead(from, session = {}, incomingText = "") {
  const data = session?.data || {};

  return {
    telegramType: "warm",
    leadType:
      data.leadType ||
      (data.intent === "training" ? "training" : "consultation"),
    name: data.name || "Не указано",
    phone: data.phone || from,
    whatsapp: from,
    city: data.city || data.location || "Не указано",
    location: data.location || data.city || "Не указано",
    service: data.service || data.projectDetails || data.intent || "Не указано",
    projectDetails: data.projectDetails || data.service || "Не указано",
    photoStatus: data.photoStatus || "Не указано",
    visitDay: data.visitDay || data.timing || "Не указано",
    visitTime: data.visitTime || data.preferredTime || "Не указано",
    firstMessage: incomingText || "Не указано",
  };
}

function buildConstructionLead(from, session = {}, incomingText = "") {
  const data = session?.data || {};

  return {
    telegramType: "warm",
    name: data.name || "Не указано",
    phone: data.phone || from,
    whatsapp: from,
    direction: data.intent || "Не указано",
    location: data.location || "Не указано",
    size: data.size || "Не указано",
    plot: data.plot || "Не указано",
    timing: data.timing || "Не указано",
    projectDetails: data.projectDetails || "Не указано",
    firstMessage: incomingText || "Не указано",
  };
}

/* ---------------- final lead sending ---------------- */

async function sendFinalLead({ projectKey, from, session }) {
  if (projectKey === "clinic") {
    const lead = buildClinicLead(from, session);

    return safeCall(
      () =>
        sendClinicTelegramLead({
          ...lead,
          telegramType: "final",
        }),
      "CLINIC FINAL LEAD"
    );
  }

  const lead = buildConstructionLead(from, session);

  const tg = await safeCall(
    () =>
      sendTelegramLead({
        ...lead,
        telegramType: "final",
      }),
    "CONSTRUCTION FINAL TELEGRAM"
  );

  const bitrixComment = [
    `Направление: ${lead.direction || "Не указано"}`,
    `Локация: ${lead.location || "Не указано"}`,
    `Размер: ${lead.size || lead.plot || "Не указано"}`,
    `Сроки: ${lead.timing || "Не указано"}`,
    `WhatsApp: ${lead.whatsapp || "Не указано"}`,
    lead.projectDetails ? `Комментарий: ${lead.projectDetails}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const bitrix = await safeCall(
    () =>
      sendLeadToBitrix({
        name: lead.name || "Не указано",
        phone: lead.phone || from,
        comment: bitrixComment,
      }),
    "BITRIX FINAL"
  );

  return { tg, bitrix };
}

/* ---------------- whatsapp api ---------------- */

async function sendWhatsAppMessage({ accessToken, phoneNumberId, to, body }) {
  const url = `https://graph.facebook.com/v23.0/${phoneNumberId}/messages`;

  await axios.post(
    url,
    {
      messaging_product: "whatsapp",
      to: normalizePhone(to),
      type: "text",
      text: { body },
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );
}

async function markMessageAsRead({ accessToken, phoneNumberId, messageId }) {
  if (!messageId) return;

  const url = `https://graph.facebook.com/v23.0/${phoneNumberId}/messages`;

  await axios.post(
    url,
    {
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );
}

/* ---------------- webhook handlers ---------------- */

async function verifyWebhook(req, res) {
  try {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    const allowedTokens = [
      process.env.VERIFY_TOKEN,
      process.env.CONSTRUCTION_VERIFY_TOKEN,
      process.env.CLINIC_VERIFY_TOKEN,
    ].filter(Boolean);

    if (mode === "subscribe" && allowedTokens.includes(token)) {
      console.log("✅ WEBHOOK VERIFIED");
      return res.status(200).send(challenge);
    }

    return res.sendStatus(403);
  } catch (error) {
    console.error("❌ verifyWebhook error:", error.message);
    return res.sendStatus(500);
  }
}

async function handleWebhook(req, res) {
  try {
    res.sendStatus(200);

    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    if (!value) return;

    if (value.statuses) {
      console.log("ℹ️ STATUS EVENT:", JSON.stringify(value.statuses, null, 2));
      return;
    }

    const message = value?.messages?.[0];
    if (!message) return;

    const phoneNumberId = value?.metadata?.phone_number_id;
    const from = message.from;
    const messageId = message.id;
    const type = message.type;

    const {
      projectKey,
      accessToken,
      phoneNumberId: currentPhoneNumberId,
      telegramToken,
      telegramChatId,
    } = getProjectConfig(phoneNumberId);

    if (!accessToken || !currentPhoneNumberId) {
      console.error("❌ Missing accessToken or phoneNumberId");
      return;
    }

    if (processedMessages.has(messageId)) {
      console.log("♻️ DUPLICATE SKIP:", messageId);
      return;
    }
    processedMessages.add(messageId);

    let text = "";

    if (type === "text") {
      text = message.text?.body || "";
    } else if (type === "interactive") {
      text =
        message.interactive?.button_reply?.title ||
        message.interactive?.list_reply?.title ||
        "";
    } else if (type === "button") {
      text = message.button?.text || "";
    } else {
      text = `[${type}]`;
    }

    console.log("📩 PROJECT:", projectKey);
    console.log("📩 FROM:", from);
    console.log("📩 TEXT:", text);

    await markMessageAsRead({
      accessToken,
      phoneNumberId: currentPhoneNumberId,
      messageId,
    });

    let session = getSession(projectKey, from);

    /* --- reset on new greeting --- */
    if (isGreetingReset(text)) {
      console.log("♻️ RESET SESSION BY GREETING");
      session = resetSession(projectKey, from);
    }

    /* --- reset on ad entry --- */
    const adReset =
      (projectKey === "construction" && isConstructionAdMessage(text)) ||
      (projectKey === "clinic" && isClinicAdMessage(text));

    if (adReset && (!session.language || session.step === "start")) {
      console.log("🚀 RESET SESSION BY AD MESSAGE");
      session = resetSession(projectKey, from);
    }

    /* --- telegram: new entry --- */
    if (!session.entryTelegramSent) {
      await safeCall(
        () =>
          sendTelegramEntry({
            projectKey,
            telegramToken,
            telegramChatId,
            firstMessage: text,
            phone: from,
          }),
        "TELEGRAM ENTRY"
      );

      session = updateSession(projectKey, from, {
        entryTelegramSent: true,
      });
    }

    /* --- route --- */
    const routed = await routeMessage({
      text,
      session,
      projectType: projectKey,
    });

    const result = routed?.result || {};

    const updated = updateSession(projectKey, from, {
      step: result.nextStep || session.step,
      mode: result.mode || session.mode,
      language: result.language || session.language,
      data: result.data || session.data,
    });

    /* --- final lead --- */
    if (updated.step === "completed" && !updated.finalLeadSent) {
      console.log("🚀 SEND FINAL LEAD");

      await sendFinalLead({
        projectKey,
        from,
        session: updated,
      });

      updateSession(projectKey, from, { finalLeadSent: true });
    }

    if (!result.reply) {
      console.log("⚠️ EMPTY REPLY");
      return;
    }

    await delay(getTypingDelay(result.reply));

    await sendWhatsAppMessage({
      accessToken,
      phoneNumberId: currentPhoneNumberId,
      to: from,
      body: result.reply,
    });

    /* --- telegram: conversation log --- */
    await safeCall(
      () =>
        sendTelegramConversation({
          projectKey,
          telegramToken,
          telegramChatId,
          clientText: text,
          botText: result.reply,
          phone: from,
        }),
      "TELEGRAM CONVERSATION"
    );
  } catch (error) {
    console.error("❌ handleWebhook error:", error.response?.data || error.message);
  }
}

module.exports = {
  verifyWebhook,
  handleWebhook,
};