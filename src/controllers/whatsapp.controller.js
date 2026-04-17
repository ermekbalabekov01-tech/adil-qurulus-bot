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

function buildClinicLead(from, session) {
  const data = session?.data || {};

  return {
    leadType: data.leadType || (data.intent === "training" ? "training" : "consultation"),
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
  };
}

function buildConstructionLead(from, session) {
  const data = session?.data || {};

  return {
    name: data.name || "Не указано",
    phone: data.phone || from,
    whatsapp: from,
    direction: data.intent || "Не указано",
    location: data.location || "Не указано",
    size: data.size || "Не указано",
    timing: data.timing || "Не указано",
    projectDetails: data.projectDetails || "Не указано",
  };
}

/* ---------------- finalize ---------------- */

async function finalizeLead({ projectKey, from, session }) {
  if (projectKey === "clinic") {
    const lead = buildClinicLead(from, session);

    const telegramOk = await safeCall(
      () => sendClinicTelegramLead(lead),
      "CLINIC TELEGRAM"
    );

    return { telegramOk: !!telegramOk };
  }

  const lead = buildConstructionLead(from, session);

  const telegramOk = await safeCall(
    () => sendTelegramLead(lead),
    "TELEGRAM"
  );

  const bitrixOk = await safeCall(
    () =>
      sendLeadToBitrix({
        name: lead.name,
        phone: lead.phone,
        comment: JSON.stringify(lead, null, 2),
      }),
    "BITRIX"
  );

  return {
    telegramOk: !!telegramOk,
    bitrixOk: !!bitrixOk,
  };
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

/* ---------------- webhook verify ---------------- */

function verifyWebhook(req, res) {
  try {
    const verifyToken =
      req.query["hub.verify_token"] || req.query.hub_verify_token;
    const mode = req.query["hub.mode"];
    const challenge = req.query["hub.challenge"];

    const validToken =
      process.env.VERIFY_TOKEN ||
      process.env.CLINIC_VERIFY_TOKEN ||
      process.env.CONSTRUCTION_VERIFY_TOKEN;

    if (mode === "subscribe" && verifyToken === validToken) {
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

/* ---------------- webhook handler ---------------- */

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
    console.log("❌ HANDLE WEBHOOK ERROR:", error.response?.data || error.message);
  }
}

module.exports = {
  verifyWebhook,
  handleWebhook,
};