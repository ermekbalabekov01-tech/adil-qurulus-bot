const axios = require("axios");

// Telegram service: поддерживаем оба варианта
let sendTelegramLead = null;
let sendTelegramMessage = null;

try {
  const telegramService = require("../services/telegram.service");
  sendTelegramLead = telegramService.sendTelegramLead || null;
  sendTelegramMessage = telegramService.sendTelegramMessage || null;
} catch (e) {
  console.log("⚠️ telegram.service not found");
}

const sessions = new Map();

/* -------------------- helpers -------------------- */

function normalizePhone(phone) {
  return String(phone || "").replace(/\D/g, "");
}

function cleanText(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[ʼ'`]/g, "")
    .replace(/\s+/g, " ");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getTypingDelay(text = "") {
  const len = String(text || "").length;
  if (len <= 80) return 900;
  if (len <= 160) return 1400;
  if (len <= 260) return 2000;
  return 2600;
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

function detectLanguage(text) {
  const t = cleanText(text);

  if (["1", "қазақша", "kz", "казахский"].includes(t)) return "kz";
  if (["2", "русский", "ru", "russian"].includes(t)) return "ru";

  if (/[әіңғүұқөһі]/i.test(t)) return "kz";
  if (/[а-яё]/i.test(t)) return "ru";

  return "ru";
}

function isMuslimGreeting(text) {
  const t = cleanText(text);

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
    t.includes("доброе утро") ||
    t.includes("салам") ||
    t.includes("сәлем") ||
    t.includes("салем") ||
    t.includes("hello") ||
    t.includes("hi")
  );
}

function isAngry(text) {
  const t = cleanText(text);

  return (
    t.includes("издеваешься") ||
    t.includes("я же сказал") ||
    t.includes("ты что") ||
    t.includes("что с тобой") ||
    t.includes("не понял") ||
    t.includes("тормоз") ||
    t.includes("зачем снова") ||
    t.includes("что за бот") ||
    t.includes("бесишь")
  );
}

function looksLikePhone(text) {
  const n = normalizePhone(text);
  return n.length >= 10 && n.length <= 15;
}

function isPricingRequest(text) {
  const t = cleanText(text);

  return (
    t.includes("сколько") ||
    t.includes("цена") ||
    t.includes("стоимость") ||
    t.includes("расчет") ||
    t.includes("расчёт") ||
    t.includes("посчитать") ||
    t.includes("смета") ||
    t.includes("баға") ||
    t.includes("есеп") ||
    t.includes("құны")
  );
}

function detectIntent(text, projectKey) {
  const t = cleanText(text);

  if (projectKey === "construction") {
    if (t.includes("дом") || t.includes("үй")) return "house";
    if (t.includes("коттедж")) return "cottage";
    if (
      t.includes("фундамент") ||
      t.includes("лента") ||
      t.includes("плита") ||
      t.includes("сваи")
    ) {
      return "foundation";
    }
    if (t.includes("консультация") || t.includes("кеңес")) return "consultation";
  }

  if (projectKey === "clinic") {
    if (t.includes("консультация") || t.includes("кеңес")) return "consultation";
    if (t.includes("запись") || t.includes("жазылу")) return "booking";
    if (t.includes("менеджер")) return "manager";
  }

  return null;
}

function extractSize(text) {
  const raw = String(text || "").trim();

  const pair = raw.match(/(\d+[.,]?\d*)\s*[xх*\/]\s*(\d+[.,]?\d*)/i);
  if (pair) return `${pair[1]}x${pair[2]}`;

  const meters = raw.match(/(\d+[.,]?\d*)\s*(м|метр|метра|метров)/i);
  if (meters) return meters[0];

  return null;
}

function hasUsefulData(data = {}) {
  return Boolean(data.intent || data.size || data.location || data.projectDetails);
}

/* -------------------- session -------------------- */

function getSession(projectKey, phone) {
  const key = `${projectKey}:${normalizePhone(phone)}`;

  if (!sessions.has(key)) {
    sessions.set(key, {
      step: "start",
      mode: "scenario", // scenario | support | silent
      language: null,
      leadSent: false,
      followUpCount: 0,
      followUpScheduled: false,
      userRepliedAfterCompleted: false,
      data: {},
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

/* -------------------- texts -------------------- */

function getWelcome(projectKey, lang, text) {
  if (projectKey === "construction") {
    if (isMuslimGreeting(text)) {
      return lang === "kz"
        ? "Уағалейкум ассалам 🤝\n\nAdil Qurulus компаниясы.\nАстанада үй, коттедж және фундамент саламыз.\n\nҚысқаша жазыңыз, не керек — әрі қарай нақты бағыт беремін."
        : "Ва алейкум ассалам 🤝\n\nКомпания Adil Qurulus.\nСтроим дома, коттеджи и фундамент в Астане.\n\nНапишите, что вам нужно — дальше сориентирую по делу.";
    }

    return lang === "kz"
      ? "Сәлеметсіз бе! 👋\n\nAdil Qurulus компаниясы.\nАстанада үй, коттедж және фундамент саламыз.\n\nҚысқаша жазыңыз, не керек — әрі қарай нақты бағыт беремін."
      : "Здравствуйте! 👋\n\nКомпания Adil Qurulus.\nСтроим дома, коттеджи и фундамент в Астане.\n\nНапишите, что вам нужно — дальше сориентирую по делу.";
  }

  if (isMuslimGreeting(text)) {
    return lang === "kz"
      ? "Уағалейкум ассалам 🤝\n\nҚысқаша жаза аласыз, көмектесемін."
      : "Ва алейкум ассалам 🤝\n\nНапишите, пожалуйста, чем могу помочь.";
  }

  return lang === "kz"
    ? "Сәлеметсіз бе! 👋\n\nҚысқаша жаза аласыз, көмектесемін."
    : "Здравствуйте! 👋\n\nНапишите, пожалуйста, чем могу помочь.";
}

function getDeEscalationReply(lang) {
  return lang === "kz"
    ? "Түсіндім 🙏 Артық сұрақпен шаршатпаймын. Қысқаша жазыңыз: не салу керек, өлшемі және қай жерде."
    : "Понял вас 🙏 Лишними вопросами перегружать не буду. Напишите коротко: что нужно построить, размеры и где объект.";
}

function getAskNeedReply(projectKey, lang) {
  if (projectKey === "construction") {
    return lang === "kz"
      ? "Жақсы 👍 Енді қысқаша жазыңыз: үй, коттедж, фундамент немесе қандай жұмыс керек?"
      : "Хорошо 👍 Теперь коротко напишите: дом, коттедж, фундамент или какой именно вид работ нужен?";
  }

  return lang === "kz"
    ? "Қай бағыт қызықтырады?"
    : "Что вас интересует?";
}

function getAskSizeReply(lang) {
  return lang === "kz"
    ? "Түсіндім 👍 Объектінің шамамен өлшемін немесе ауданын жазыңыз."
    : "Понял 👍 Напишите примерные размеры объекта или площадь.";
}

function getAskLocationReply(lang, sizeText) {
  return lang === "kz"
    ? `Жақсы. ${sizeText ? `${sizeText} 👍\n\n` : ""}Құрылыс қай қалада немесе ауданда болады?`
    : `Хорошо. ${sizeText ? `${sizeText} 👍\n\n` : ""}В каком городе или районе планируется строительство?`;
}

function getAskPhoneForManagerReply(lang) {
  return lang === "kz"
    ? "Нақты есеп пен дұрыс ұсыныс беру үшін менеджерді қосамын. Байланыс үшін номеріңізді жазыңыз."
    : "Чтобы подключить менеджера и дать вам точный расчёт без ошибок, напишите ваш номер для связи.";
}

function getLeadCreatedReply(lang) {
  return lang === "kz"
    ? "Рақмет 🙌 Өтініміңіз менеджерге жіберілді. Жақын арада сізбен байланысады.\n\nҚажет болса, осы чатқа қосымша ақпарат жаза аласыз."
    : "Спасибо 🙌 Ваша заявка передана менеджеру. Он свяжется с вами в ближайшее время.\n\nЕсли хотите, можете написать сюда дополнительные детали по объекту.";
}

function getSupportReply(lang, text) {
  const t = cleanText(text);

  if (isPricingRequest(t)) {
    return lang === "kz"
      ? "Түсіндім 👍 Нақты есеп керек екенін менеджерге қайта жеткіземін."
      : "Понял 👍 Передаю менеджеру, что вам нужен точный расчёт.";
  }

  if (
    t.includes("когда") ||
    t.includes("ждать") ||
    t.includes("срок") ||
    t.includes("қашан")
  ) {
    return lang === "kz"
      ? "Менеджер өтінімді алды 👍 Қажет болса, осы чатқа қосымша мәлімет жаза аласыз."
      : "Менеджер уже получил заявку 👍 Если нужно, можете написать сюда дополнительные детали.";
  }

  return lang === "kz"
    ? "Қосымша ақпарат болса, осы чатқа жаза аласыз 👍"
    : "Если есть дополнительные детали, можете написать сюда 👍";
}

/* -------------------- telegram -------------------- */

function buildLeadText(projectKey, from, session) {
  const data = session.data || {};

  return [
    `🔥 НОВАЯ ЗАЯВКА`,
    `Проект: ${projectKey}`,
    `WhatsApp: ${from}`,
    `Имя: ${data.name || "Не указано"}`,
    `Телефон: ${data.phone || from}`,
    `Интерес: ${data.intent || "Не указано"}`,
    `Размер: ${data.size || "Не указано"}`,
    `Локация: ${data.location || "Не указано"}`,
    `Детали: ${data.projectDetails || "Не указано"}`,
  ].join("\n");
}

async function sendTelegramLeadNow(projectKey, from, session) {
  try {
    if (sendTelegramLead && typeof sendTelegramLead === "function") {
      await sendTelegramLead({
        whatsapp: from,
        phone: session.data?.phone || from,
        name: session.data?.name || "Не указано",
        direction: session.data?.intent || "Не указано",
        location: session.data?.location || "Не указано",
        size: session.data?.size || "Не указано",
        details: session.data?.projectDetails || "Не указано",
        projectKey,
      });

      return true;
    }

    if (sendTelegramMessage && typeof sendTelegramMessage === "function") {
      await sendTelegramMessage(buildLeadText(projectKey, from, session));
      return true;
    }

    console.log("⚠️ Telegram function not available");
    return false;
  } catch (error) {
    console.log("❌ TELEGRAM SEND ERROR:", error.message);
    return false;
  }
}

/* -------------------- whatsapp api -------------------- */

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

/* -------------------- follow-ups -------------------- */

function scheduleSoftFollowUps({ projectKey, from, lang }) {
  setTimeout(async () => {
    try {
      const session = getSession(projectKey, from);
      if (!session || session.mode !== "support") return;
      if (session.userRepliedAfterCompleted) return;
      if (session.followUpCount >= 1) return;

      const project = getProjectConfig(
        projectKey === "construction"
          ? process.env.CONSTRUCTION_PHONE_NUMBER_ID
          : process.env.CLINIC_PHONE_NUMBER_ID
      );

      const text =
        lang === "kz"
          ? "Сәлеметсіз бе! Өтініміңіз қабылданды 👍 Қажет болса, объект бойынша қосымша мәлімет жаза аласыз."
          : "Здравствуйте! Ваша заявка принята 👍 Если хотите, можете написать дополнительные детали по объекту.";

      await sendWhatsAppMessage({
        accessToken: project.accessToken,
        phoneNumberId: project.phoneNumberId,
        to: from,
        body: text,
      });

      updateSession(projectKey, from, { followUpCount: 1 });
      console.log("✅ FOLLOW-UP #1 SENT");
    } catch (error) {
      console.log("❌ FOLLOW-UP #1 ERROR:", error.message);
    }
  }, 30 * 60 * 1000);

  setTimeout(async () => {
    try {
      const session = getSession(projectKey, from);
      if (!session || session.mode !== "support") return;
      if (session.userRepliedAfterCompleted) return;
      if (session.followUpCount >= 2) return;

      const project = getProjectConfig(
        projectKey === "construction"
          ? process.env.CONSTRUCTION_PHONE_NUMBER_ID
          : process.env.CLINIC_PHONE_NUMBER_ID
      );

      const text =
        lang === "kz"
          ? "Егер өтінім әлі де өзекті болса, кез келген уақытта жаза аласыз 👍"
          : "Если заявка ещё актуальна, можете написать сюда в любое время 👍";

      await sendWhatsAppMessage({
        accessToken: project.accessToken,
        phoneNumberId: project.phoneNumberId,
        to: from,
        body: text,
      });

      updateSession(projectKey, from, {
        followUpCount: 2,
        mode: "silent",
      });

      console.log("✅ FOLLOW-UP #2 SENT");
    } catch (error) {
      console.log("❌ FOLLOW-UP #2 ERROR:", error.message);
    }
  }, 12 * 60 * 60 * 1000);
}

/* -------------------- webhook handlers -------------------- */

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

    const { projectKey, accessToken, phoneNumberId: currentPhoneNumberId } =
      getProjectConfig(phoneNumberId);

    if (!accessToken || !currentPhoneNumberId) {
      console.error("❌ Missing accessToken or phoneNumberId");
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
    console.log("📩 TEXT:", text);

    const session = getSession(projectKey, from);
    const lang = session.language || detectLanguage(text);

    await markMessageAsRead({
      accessToken,
      phoneNumberId: currentPhoneNumberId,
      messageId,
    });

    // После заявки: только мягкий support
    if (session.mode === "support" || session.mode === "silent") {
      updateSession(projectKey, from, {
        userRepliedAfterCompleted: true,
        mode: "support",
      });

      const reply = getSupportReply(lang, text);

      await delay(getTypingDelay(reply));
      await sendWhatsAppMessage({
        accessToken,
        phoneNumberId: currentPhoneNumberId,
        to: from,
        body: reply,
      });

      return;
    }

    // Анти-агрессия
    if (isAngry(text)) {
      const reply = getDeEscalationReply(lang);

      await delay(getTypingDelay(reply));
      await sendWhatsAppMessage({
        accessToken,
        phoneNumberId: currentPhoneNumberId,
        to: from,
        body: reply,
      });

      return;
    }

    // Первый вход
    if (session.step === "start") {
      const reply = getWelcome(projectKey, lang, text);

      await delay(getTypingDelay(reply));
      await sendWhatsAppMessage({
        accessToken,
        phoneNumberId: currentPhoneNumberId,
        to: from,
        body: reply,
      });

      // Если клиент уже в первом сообщении пишет предмет разговора
      const intent = detectIntent(text, projectKey);
      const size = extractSize(text);

      updateSession(projectKey, from, {
        language: lang,
        step: intent || size ? "ask_location_or_phone" : "ask_need",
        data: {
          ...(session.data || {}),
          intent: intent || session.data?.intent || null,
          size: size || session.data?.size || null,
          projectDetails: !isGreeting(text) && !isMuslimGreeting(text) ? text : session.data?.projectDetails || null,
        },
      });

      return;
    }

    // Что нужно
    if (session.step === "ask_need") {
      const intent = detectIntent(text, projectKey);
      const size = extractSize(text);

      const nextData = {
        ...(session.data || {}),
        intent: intent || session.data?.intent || text,
        size: size || session.data?.size || null,
        projectDetails: text,
      };

      updateSession(projectKey, from, {
        language: lang,
        step: size ? "ask_location_or_phone" : "ask_size",
        data: nextData,
      });

      const reply = size ? getAskLocationReply(lang, size) : getAskSizeReply(lang);

      await delay(getTypingDelay(reply));
      await sendWhatsAppMessage({
        accessToken,
        phoneNumberId: currentPhoneNumberId,
        to: from,
        body: reply,
      });

      return;
    }

    // Размер
    if (session.step === "ask_size") {
      const size = extractSize(text) || text;

      updateSession(projectKey, from, {
        language: lang,
        step: "ask_location_or_phone",
        data: {
          ...(session.data || {}),
          size,
        },
      });

      const reply = getAskLocationReply(lang, size);

      await delay(getTypingDelay(reply));
      await sendWhatsAppMessage({
        accessToken,
        phoneNumberId: currentPhoneNumberId,
        to: from,
        body: reply,
      });

      return;
    }

    // Город / район или сразу номер
    if (session.step === "ask_location_or_phone") {
      // Если клиент вместо города сразу дал номер
      if (looksLikePhone(text)) {
        const updated = updateSession(projectKey, from, {
          language: lang,
          step: "done",
          mode: "support",
          data: {
            ...(session.data || {}),
            phone: text,
          },
        });

        if (!updated.leadSent) {
          const ok = await sendTelegramLeadNow(projectKey, from, updated);
          if (ok) {
            updateSession(projectKey, from, { leadSent: true });
          }
        }

        const latest = getSession(projectKey, from);
        if (!latest.followUpScheduled) {
          scheduleSoftFollowUps({ projectKey, from, lang });
          updateSession(projectKey, from, {
            followUpScheduled: true,
            followUpCount: 0,
            userRepliedAfterCompleted: false,
          });
        }

        const reply = getLeadCreatedReply(lang);

        await delay(getTypingDelay(reply));
        await sendWhatsAppMessage({
          accessToken,
          phoneNumberId: currentPhoneNumberId,
          to: from,
          body: reply,
        });

        return;
      }

      // Если клиент просит цену / расчёт — сразу на менеджера, без допроса
      if (isPricingRequest(text) || isPricingRequest(session.data?.projectDetails || "")) {
        updateSession(projectKey, from, {
          language: lang,
          step: "ask_phone",
          data: {
            ...(session.data || {}),
            location: text,
          },
        });

        const reply = getAskPhoneForManagerReply(lang);

        await delay(getTypingDelay(reply));
        await sendWhatsAppMessage({
          accessToken,
          phoneNumberId: currentPhoneNumberId,
          to: from,
          body: reply,
        });

        return;
      }

      // Обычный сценарий: сохраняем город и просим номер
      updateSession(projectKey, from, {
        language: lang,
        step: "ask_phone",
        data: {
          ...(session.data || {}),
          location: text,
        },
      });

      const reply = getAskPhoneForManagerReply(lang);

      await delay(getTypingDelay(reply));
      await sendWhatsAppMessage({
        accessToken,
        phoneNumberId: currentPhoneNumberId,
        to: from,
        body: reply,
      });

      return;
    }

    // Номер
    if (session.step === "ask_phone") {
      if (!looksLikePhone(text)) {
        const reply =
          lang === "kz"
            ? "Номеріңізді толық жаза аласыз ба? Мысалы: +7 7XX XXX XX XX"
            : "Можете написать номер полностью? Например: +7 7XX XXX XX XX";

        await delay(getTypingDelay(reply));
        await sendWhatsAppMessage({
          accessToken,
          phoneNumberId: currentPhoneNumberId,
          to: from,
          body: reply,
        });

        return;
      }

      const updated = updateSession(projectKey, from, {
        language: lang,
        step: "done",
        mode: "support",
        data: {
          ...(session.data || {}),
          phone: text,
        },
      });

      // СРАЗУ Telegram
      if (!updated.leadSent) {
        const ok = await sendTelegramLeadNow(projectKey, from, updated);
        if (ok) {
          updateSession(projectKey, from, { leadSent: true });
        }
      }

      // Мягкий follow-up
      const latest = getSession(projectKey, from);
      if (!latest.followUpScheduled) {
        scheduleSoftFollowUps({ projectKey, from, lang });
        updateSession(projectKey, from, {
          followUpScheduled: true,
          followUpCount: 0,
          userRepliedAfterCompleted: false,
        });
      }

      const reply = getLeadCreatedReply(lang);

      await delay(getTypingDelay(reply));
      await sendWhatsAppMessage({
        accessToken,
        phoneNumberId: currentPhoneNumberId,
        to: from,
        body: reply,
      });

      return;
    }

    // fallback
    const fallback = getAskNeedReply(projectKey, lang);

    await delay(getTypingDelay(fallback));
    await sendWhatsAppMessage({
      accessToken,
      phoneNumberId: currentPhoneNumberId,
      to: from,
      body: fallback,
    });
  } catch (error) {
    console.error("❌ handleWebhook error:", error.response?.data || error.message);
  }
}

module.exports = {
  verifyWebhook,
  handleWebhook,
};
