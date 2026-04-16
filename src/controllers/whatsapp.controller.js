const axios = require("axios");
const { routeMessage } = require("../router");
const { sendTelegramLead } = require("../services/telegram.service");
const { sendClinicTelegramLead } = require("../services/telegramClinic.service");
const { sendLeadToBitrix } = require("../services/bitrix.service");

const sessions = new Map();

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

  const fallbackProject = process.env.DEFAULT_PROJECT || "construction";

  if (fallbackProject === "clinic") {
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

function isPricingIntent(text) {
  const t = String(text || "").trim().toLowerCase();

  return (
    t.includes("сколько") ||
    t.includes("стоимость") ||
    t.includes("цена") ||
    t.includes("расчет") ||
    t.includes("расчёт") ||
    t.includes("посчитать") ||
    t.includes("смета") ||
    t.includes("баға") ||
    t.includes("есеп") ||
    t.includes("құны")
  );
}

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

async function finalizeLead({ projectKey, from, session }) {
  if (projectKey === "clinic") {
    const lead = {
      name: session.data?.name || "Не указано",
      phone: session.data?.phone || from,
      whatsapp: from,
      city: session.data?.location || session.data?.city || "Не указано",
      service:
        session.data?.projectDetails ||
        session.data?.service ||
        session.data?.serviceTitle ||
        session.data?.intent ||
        "Не указано",
      hadConsultation: session.data?.hadConsultation || "Не указано",
      photoStatus: session.data?.size || session.data?.photoStatus || "Не указано",
      visitTime: session.data?.timing || session.data?.visitTime || "Не указано",
    };

    const telegramOk = await sendClinicTelegramLead(lead);

    console.log("📦 FINALIZE CLINIC LEAD:", {
      telegramOk,
      lead,
    });

    return { telegramOk, bitrixOk: true };
  }

  const lead = {
    name: session.data?.name || "Не указано",
    phone: session.data?.phone || from,
    whatsapp: from,
    direction: session.data?.intent || "Не указано",
    location: session.data?.location || "Не указано",
    projectStatus: session.data?.projectDetails || "Не указано",
    size: session.data?.size || "Не указано",
    calcRequest:
      isPricingIntent(session.data?.projectDetails || "") ? "Запросил расчёт" : "",
  };

  const bitrixComment = [
    `Направление: ${lead.direction}`,
    `Локация: ${lead.location}`,
    `Детали: ${lead.projectStatus}`,
    `Размер: ${lead.size}`,
    lead.calcRequest ? `Статус: ${lead.calcRequest}` : "",
    `WhatsApp: ${lead.whatsapp}`,
  ]
    .filter(Boolean)
    .join("\n");

  const telegramOk = await sendTelegramLead(lead);
  const bitrixOk = await sendLeadToBitrix({
    name: lead.name,
    phone: lead.phone,
    comment: bitrixComment,
  });

  console.log("📦 FINALIZE CONSTRUCTION LEAD:", {
    telegramOk,
    bitrixOk,
    lead,
  });

  return { telegramOk, bitrixOk };
}

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
    } = getProjectConfig(phoneNumberId);

    if (!accessToken || !currentPhoneNumberId) {
      console.error("❌ Missing accessToken or phoneNumberId", {
        incomingPhoneNumberId: phoneNumberId,
        projectKey,
        hasAccessToken: Boolean(accessToken),
        hasPhoneNumberId: Boolean(currentPhoneNumberId),
      });
      return;
    }

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
    } else if (type === "image") {
      text = "[image]";
    } else if (type === "document") {
      text = "[document]";
    } else {
      text = `[${type}]`;
    }

    console.log("📩 PROJECT:", projectKey);
    console.log("📩 FROM:", from);
    console.log("📩 TEXT:", text);

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
    const reply = result.reply || "";
    const nextStep = result.nextStep || session.step || "start";
    const nextMode = result.mode || session.mode || "scenario";
    const nextLanguage = result.language || session.language || null;
    const nextData = result.data || session.data || {};

    const updated = updateSession(projectKey, from, {
      step: nextStep,
      mode: nextMode,
      language: nextLanguage,
      data: nextData,
    });

    if (nextStep === "completed" && !updated.leadSent) {
      await finalizeLead({
        projectKey,
        from,
        session: updated,
      });

      updateSession(projectKey, from, {
        leadSent: true,
      });
    }

    if (!reply) return;

    await delay(getTypingDelay(reply));

    await sendWhatsAppMessage({
      accessToken,
      phoneNumberId: currentPhoneNumberId,
      to: from,
      body: reply,
    });
  } catch (error) {
    console.error("❌ handleWebhook error:", error.response?.data || error.message);
  }
}

module.exports = {
  verifyWebhook,
  handleWebhook,
};