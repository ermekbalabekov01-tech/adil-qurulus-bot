const axios = require("axios");
const { routeMessage } = require("../router");
const { sendTelegramLead } = require("../services/telegram.service");
const { sendClinicTelegramLead } = require("../services/telegramClinic.service");
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

function getProjectConfig(phoneNumberId) {
  const constructionId = String(process.env.CONSTRUCTION_PHONE_NUMBER_ID || "");
  const clinicId = String(process.env.CLINIC_PHONE_NUMBER_ID || "");

  if (String(phoneNumberId) === constructionId) {
    return {
      projectKey: "construction",
      accessToken: process.env.CONSTRUCTION_ACCESS_TOKEN,
      phoneNumberId: process.env.CONSTRUCTION_PHONE_NUMBER_ID,
    };
  }

  if (String(phoneNumberId) === clinicId) {
    return {
      projectKey: "clinic",
      accessToken: process.env.CLINIC_ACCESS_TOKEN,
      phoneNumberId: process.env.CLINIC_PHONE_NUMBER_ID,
    };
  }

  return {
    projectKey: "construction",
    accessToken: process.env.CONSTRUCTION_ACCESS_TOKEN,
    phoneNumberId: process.env.CONSTRUCTION_PHONE_NUMBER_ID,
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
      leadSent: false,
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
  };

  sessions.set(key, next);
  return next;
}

/* ---------------- retry ---------------- */

async function safeCall(fn, label) {
  try {
    const res = await fn();
    console.log(`✅ ${label} OK`);
    return true;
  } catch (e) {
    console.log(`❌ ${label} ERROR:`, e.response?.data || e.message);
    return false;
  }
}

/* ---------------- finalize ---------------- */

async function finalizeLead({ projectKey, from, session }) {
  if (projectKey === "clinic") {
    const lead = {
      name: session.data?.name || "Не указано",
      phone: session.data?.phone || from,
      whatsapp: from,
    };

    const ok = await safeCall(
      () => sendClinicTelegramLead(lead),
      "CLINIC TELEGRAM"
    );

    return { telegramOk: ok };
  }

  const lead = {
    name: session.data?.name || "Не указано",
    phone: session.data?.phone || from,
    whatsapp: from,
    direction: session.data?.intent || "Не указано",
    location: session.data?.location || "Не указано",
    size: session.data?.size || "Не указано",
  };

  const tg = await safeCall(
    () => sendTelegramLead(lead),
    "TELEGRAM"
  );

  const bitrix = await safeCall(
    () =>
      sendLeadToBitrix({
        name: lead.name,
        phone: lead.phone,
        comment: JSON.stringify(lead, null, 2),
      }),
    "BITRIX"
  );

  return { telegramOk: tg, bitrixOk: bitrix };
}

/* ---------------- api ---------------- */

async function sendWhatsAppMessage({ accessToken, phoneNumberId, to, body }) {
  await axios.post(
    `https://graph.facebook.com/v23.0/${phoneNumberId}/messages`,
    {
      messaging_product: "whatsapp",
      to: normalizePhone(to),
      type: "text",
      text: { body },
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
}

async function markMessageAsRead({ accessToken, phoneNumberId, messageId }) {
  if (!messageId) return;

  await axios.post(
    `https://graph.facebook.com/v23.0/${phoneNumberId}/messages`,
    {
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
}

/* ---------------- webhook ---------------- */

async function handleWebhook(req, res) {
  try {
    res.sendStatus(200);

    const value = req.body?.entry?.[0]?.changes?.[0]?.value;
    if (!value?.messages) return;

    const message = value.messages[0];
    const from = message.from;
    const messageId = message.id;

    if (processedMessages.has(messageId)) {
      console.log("♻️ DUPLICATE SKIP");
      return;
    }
    processedMessages.add(messageId);

    const phoneNumberId = value.metadata.phone_number_id;

    const {
      projectKey,
      accessToken,
      phoneNumberId: currentPhoneNumberId,
    } = getProjectConfig(phoneNumberId);

    let text = message.text?.body || "[media]";

    console.log("📩", projectKey, from, text);

    const session = getSession(projectKey, from);

    await markMessageAsRead({
      accessToken,
      phoneNumberId: currentPhoneNumberId,
      messageId,
    });

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

    if (updated.step === "completed" && !updated.leadSent) {
      console.log("🚀 SEND LEAD");

      await finalizeLead({
        projectKey,
        from,
        session: updated,
      });

      updateSession(projectKey, from, { leadSent: true });
    }

    if (!result.reply) return;

    await delay(getTypingDelay(result.reply));

    await sendWhatsAppMessage({
      accessToken,
      phoneNumberId: currentPhoneNumberId,
      to: from,
      body: result.reply,
    });
  } catch (error) {
    console.log("❌ ERROR:", error.response?.data || error.message);
  }
}

module.exports = { handleWebhook };