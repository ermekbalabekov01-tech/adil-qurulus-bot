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
      warmLeadSent: false,
      finalLeadSent: false,
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

/* ---------------- lead builders ---------------- */

function buildClinicLead(from, session = {}, incomingText = "") {
  const data = session?.data || {};

  return {
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
    photoStatus: data.photoStatus || data.size || "Не указано",
    visitDay: data.visitDay || data.timing || "Не указано",
    visitTime: data.visitTime || data.preferredTime || "Не указано",
    firstMessage: incomingText || "Не указано",
  };
}

function buildConstructionLead(from, session = {}, incomingText = "") {
  const data = session?.data || {};

  return {
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

/* ---------------- telegram events ---------------- */

async function sendWarmLead({ projectKey, from, session, incomingText }) {
  if (projectKey === "clinic") {
    const lead = buildClinicLead(from, session, incomingText);

    return safeCall(
      () =>
        sendClinicTelegramLead({
          ...lead,
          telegramType: "warm",
          leadType:
            lead.leadType === "training" ? "training" : "incoming_interest",
          projectDetails: incomingText || lead.projectDetails,
          service: lead.service || "Первичный интерес",
        }),
      "CLINIC WARM LEAD"
    );
  }

  const lead = buildConstructionLead(from, session, incomingText);

  return safeCall(
    () =>
      sendTelegramLead({
        ...lead,
        telegramType: "warm",
        direction: lead.direction || "Первичный интерес",
        projectDetails: incomingText || lead.projectDetails,
      }),
    "CONSTRUCTION WARM LEAD"
  );
}

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

  const bitrix = await safeCall(
    () =>
      sendLeadToBitrix({
        name: lead.name,
        phone: lead.phone,
        comment: JSON.stringify(lead, null, 2),
      }),
    "BITRIX FINAL"
  );

  return { tg, bitrix };
}

/* ---------------- whatsapp api ---------------- */

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

/* ---------------- verify webhook ---------------- */

function verifyWebhook(req, res) {
  try {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    const verifyToken =
      process.env.VERIFY_TOKEN ||
      process.env.CLINIC_VERIFY_TOKEN ||
      process.env.CONSTRUCTION_VERIFY_TOKEN;

    if (mode === "subscribe" && token === verifyToken) {
      console.log("✅ WEBHOOK VERIFIED");
      return res.status(200).send(challenge);
    }

    console.log("❌ WEBHOOK VERIFY FAILED");
    return res.sendStatus(403);
  } catch (error) {
    console.log("❌ VERIFY ERROR:", error.message);
    return res.sendStatus(500);
  }
}

/* ---------------- main webhook ---------------- */

async function handleWebhook(req, res) {
  try {
    res.sendStatus(200);

    const value = req.body?.entry?.[0]?.changes?.[0]?.value;
    if (!value) return;
    if (!value.messages || !value.messages.length) return;

    const message = value.messages[0];
    const from = message.from;
    const messageId = message.id;

    if (!from || !messageId) return;

    if (processedMessages.has(messageId)) {
      console.log("♻️ DUPLICATE SKIP:", messageId);
      return;
    }
    processedMessages.add(messageId);

    const phoneNumberId = value?.metadata?.phone_number_id;
    const {
      projectKey,
      accessToken,
      phoneNumberId: currentPhoneNumberId,
    } = getProjectConfig(phoneNumberId);

    const text =
      message?.text?.body ||
      message?.button?.text ||
      message?.interactive?.button_reply?.title ||
      message?.interactive?.list_reply?.title ||
      "[media]";

    console.log("📩 PROJECT:", projectKey);
    console.log("📩 FROM:", from);
    console.log("📩 TEXT:", text);

    const session = getSession(projectKey, from);

    await safeCall(
      () =>
        markMessageAsRead({
          accessToken,
          phoneNumberId: currentPhoneNumberId,
          messageId,
        }),
      "MARK AS READ"
    );

    /* 1. СРАЗУ отправляем в телеграм первое касание */
    if (!session.warmLeadSent) {
      await sendWarmLead({
        projectKey,
        from,
        session,
        incomingText: text,
      });

      updateSession(projectKey, from, { warmLeadSent: true });
    }

    /* 2. Роутинг */
    const freshSession = getSession(projectKey, from);

    const routed = await routeMessage({
      text,
      session: freshSession,
      projectType: projectKey,
    });

    const result = routed?.result || {};

    const updated = updateSession(projectKey, from, {
      step: result.nextStep || freshSession.step,
      mode: result.mode || freshSession.mode,
      language: result.language || freshSession.language,
      data: result.data || freshSession.data,
    });

    /* 3. После дожима ещё раз отправляем финальную заявку */
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

    await safeCall(
      () =>
        sendWhatsAppMessage({
          accessToken,
          phoneNumberId: currentPhoneNumberId,
          to: from,
          body: result.reply,
        }),
      "SEND WHATSAPP MESSAGE"
    );
  } catch (error) {
    console.log(
      "❌ HANDLE WEBHOOK ERROR:",
      error.response?.data || error.message
    );
  }
}

module.exports = {
  verifyWebhook,
  handleWebhook,
};