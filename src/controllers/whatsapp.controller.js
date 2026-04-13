const axios = require("axios");

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

function normalizePhone(phone) {
  return String(phone || "").replace(/\D/g, "");
}

function cleanText(text) {
  return String(text || "").trim().toLowerCase();
}

function isMuslimGreeting(text) {
  const t = cleanText(text)
    .replace(/[ʼ'`]/g, "")
    .replace(/\s+/g, " ");

  return (
    t.includes("ассаляму алейкум") ||
    t.includes("ассаламу алейкум") ||
    t.includes("ассалам алейкум") ||
    t.includes("ассаламагалейкум") ||
    t.includes("ассаламуагалейкум") ||
    t.includes("асаламу алейкум") ||
    t.includes("асаламалейкум") ||
    t.includes("салам алейкум") ||
    t.includes("саламалейкум") ||
    t.includes("assalamu alaikum") ||
    t.includes("assalamu alaykum") ||
    t.includes("salam alaikum")
  );
}

function isGreeting(text) {
  const t = cleanText(text);

  return (
    t.includes("привет") ||
    t.includes("здравствуйте") ||
    t.includes("здраствуйте") ||
    t.includes("добрый день") ||
    t.includes("добрый вечер") ||
    t.includes("салам") ||
    t.includes("сәлем") ||
    t.includes("салем") ||
    t.includes("hello") ||
    t.includes("hi")
  );
}

function getGreetingReply(projectKey, text) {
  if (isMuslimGreeting(text)) {
    if (projectKey === "construction") {
      return "Ва алейкум ассалам 🤝\n\nAdil Qurulus на связи.\nНапишите коротко, что вас интересует: дом, коттедж или фундамент — и я сразу сориентирую.";
    }

    return "Ва алейкум ассалам 🤝\n\nЗдравствуйте! Напишите, пожалуйста, чем могу помочь.";
  }

  if (isGreeting(text)) {
    if (projectKey === "construction") {
      return "Здравствуйте! 👋\n\nAdil Qurulus на связи.\nНапишите коротко, что вас интересует: дом, коттедж, фундамент или консультация.";
    }

    return "Здравствуйте! 👋\n\nНапишите, пожалуйста, чем могу помочь.";
  }

  return null;
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

    if (!value) {
      console.log("ℹ️ EMPTY WEBHOOK");
      return;
    }

    if (value.statuses) {
      console.log("ℹ️ STATUS EVENT:", JSON.stringify(value.statuses, null, 2));
      return;
    }

    const message = value?.messages?.[0];
    if (!message) {
      console.log("ℹ️ NO MESSAGE");
      return;
    }

    const phoneNumberId = value?.metadata?.phone_number_id;
    const from = message.from;
    const messageId = message.id;
    const type = message.type;

    const { projectKey, accessToken, phoneNumberId: currentPhoneNumberId } =
      getProjectConfig(phoneNumberId);

    if (!accessToken || !currentPhoneNumberId) {
      console.error("❌ Нет accessToken или phoneNumberId для проекта:", projectKey);
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
    } else {
      text = `[${type}]`;
    }

    console.log("📩 PROJECT:", projectKey);
    console.log("📩 FROM:", from);
    console.log("📩 TYPE:", type);
    console.log("📩 TEXT:", text);

    await markMessageAsRead({
      accessToken,
      phoneNumberId: currentPhoneNumberId,
      messageId,
    });

    let reply = getGreetingReply(projectKey, text);

    if (!reply) {
      if (projectKey === "construction") {
        reply =
          "Понял 👍\n\nНапишите коротко:\n1) что нужно построить\n2) размеры или площадь\n3) город/район\n\nИ я сразу сориентирую по следующему шагу.";
      } else {
        reply = "Спасибо за сообщение 👍\n\nНапишите, пожалуйста, подробнее, что вас интересует.";
      }
    }

    await sendWhatsAppMessage({
      accessToken,
      phoneNumberId: currentPhoneNumberId,
      to: from,
      body: reply,
    });

    console.log("✅ MESSAGE SENT");
  } catch (error) {
    console.error(
      "❌ handleWebhook error:",
      error.response?.data || error.message
    );
  }
}

module.exports = {
  verifyWebhook,
  handleWebhook,
};