const axios = require("axios");

// Если у тебя сервис называется иначе, поправь путь
let sendTelegramLead = null;
try {
  ({ sendTelegramLead } = require("../services/telegram.service"));
} catch (e) {
  console.log("⚠️ telegram.service not found or sendTelegramLead missing");
}

const sessions = new Map();

function getProjectConfig(phoneNumberId) {
  const constructionId = String(process.env.CONSTRUCTION_PHONE_NUMBER_ID || "");
  const clinicId = String(process.env.CLINIC_PHONE_NUMBER_ID || "");

  if (String(phoneNumberId) === constructionId) {
    return {
      projectKey: "construction",
      accessToken: process.env.CONSTRUCTION_ACCESS_TOKEN,
      phoneNumberId: process.env.CONSTRUCTION_PHONE_NUMBER_ID,
      verifyTokens: [
        process.env.CONSTRUCTION_VERIFY_TOKEN,
        process.env.VERIFY_TOKEN,
      ].filter(Boolean),
    };
  }

  if (String(phoneNumberId) === clinicId) {
    return {
      projectKey: "clinic",
      accessToken: process.env.CLINIC_ACCESS_TOKEN,
      phoneNumberId: process.env.CLINIC_PHONE_NUMBER_ID,
      verifyTokens: [
        process.env.CLINIC_VERIFY_TOKEN,
        process.env.VERIFY_TOKEN,
      ].filter(Boolean),
    };
  }

  return {
    projectKey: "construction",
    accessToken: process.env.CONSTRUCTION_ACCESS_TOKEN,
    phoneNumberId: process.env.CONSTRUCTION_PHONE_NUMBER_ID,
    verifyTokens: [
      process.env.CONSTRUCTION_VERIFY_TOKEN,
      process.env.VERIFY_TOKEN,
    ].filter(Boolean),
  };
}

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
  if (len <= 180) return 1400;
  if (len <= 300) return 2000;
  return 2600;
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
    t.includes("что с тобой") ||
    t.includes("ты что") ||
    t.includes("ты вообще") ||
    t.includes("не понял") ||
    t.includes("тормоз") ||
    t.includes("зачем снова") ||
    t.includes("бесишь") ||
    t.includes("достал") ||
    t.includes("что за бот")
  );
}

function looksLikePhone(text) {
  const n = normalizePhone(text);
  return n.length >= 10 && n.length <= 15;
}

function detectLanguage(text) {
  const t = cleanText(text);

  if (["1", "қазақша", "казахский", "kz"].includes(t)) return "kz";
  if (["2", "русский", "ru", "russian"].includes(t)) return "ru";

  const kzChars = /[әіңғүұқөһі]/i;
  if (kzChars.test(t)) return "kz";

  const ruChars = /[а-яё]/i;
  if (ruChars.test(t)) return "ru";

  return null;
}

function detectIntent(text, projectKey) {
  const t = cleanText(text);

  if (projectKey === "construction") {
    if (
      t.includes("дом") ||
      t.includes("үй") ||
      t.includes("house")
    ) return "house";

    if (t.includes("коттедж")) return "cottage";

    if (
      t.includes("фундамент") ||
      t.includes("плита") ||
      t.includes("лента") ||
      t.includes("сваи")
    ) return "foundation";

    if (
      t.includes("консультация") ||
      t.includes("кеңес")
    ) return "consultation";
  }

  if (projectKey === "clinic") {
    if (t.includes("запись") || t.includes("жазылу")) return "booking";
    if (t.includes("консультация") || t.includes("кеңес")) return "consultation";
    if (t.includes("менеджер")) return "manager";
  }

  return null;
}

function extractSize(text) {
  const raw = String(text || "").trim();

  const pair = raw.match(/(\d+[.,]?\d*)\s*[xх*]\s*(\d+[.,]?\d*)/i);
  if (pair) return `${pair[1]} x ${pair[2]}`;

  const meters = raw.match(/(\d+[.,]?\d*)\s*(м|метр|метра|метров)/i);
  if (meters) return meters[0];

  return null;
}

function hasEnoughConstructionData(data = {}) {
  return Boolean(
    data.intent &&
    (data.size || data.projectDetails || data.location)
  );
}

function getSession(projectKey, phone) {
  const key = `${projectKey}:${normalizePhone(phone)}`;

  if (!sessions.has(key)) {
    sessions.set(key, {
      projectKey,
      step: "start",
      mode: "scenario", // scenario | support | silent
      language: null,
      data: {},
      leadSent: false,
      followUpCount: 0,
      followUpScheduled: false,
      userRepliedAfterCompleted: false,
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

function getGreetingReply(projectKey, lang, text) {
  if (projectKey === "construction") {
    if (isMuslimGreeting(text)) {
      if (lang === "kz") {
        return (
          "Уағалейкум ассалам 🤝\n\n" +
          "Adil Qurulus байланыста.\n" +
          "Үй, коттедж немесе фундамент бойынша не керек екенін қысқаша жазыңыз — бірден нақты бағыт берем."
        );
      }

      return (
        "Ва алейкум ассалам 🤝\n\n" +
        "Adil Qurulus на связи.\n" +
        "Напишите коротко, что вас интересует: дом, коттедж или фундамент — и я сразу сориентирую."
      );
    }

    if (lang === "kz") {
      return (
        "Сәлеметсіз бе! 👋\n\n" +
        "Adil Qurulus байланыста.\n" +
        "Үй, коттедж немесе фундамент керек болса, қысқаша жаза аласыз — бірден нақтылап берем."
      );
    }

    return (
      "Здравствуйте! 👋\n\n" +
      "Adil Qurulus на связи.\n" +
      "Напишите коротко, что вас интересует: дом, коттедж, фундамент или консультация."
    );
  }

  if (isMuslimGreeting(text)) {
    return lang === "kz"
      ? "Уағалейкум ассалам 🤝\n\nЖаза беріңіз, көмектесемін."
      : "Ва алейкум ассалам 🤝\n\nНапишите, пожалуйста, чем могу помочь.";
  }

  return lang === "kz"
    ? "Сәлеметсіз бе! 👋\n\nЖаза беріңіз, көмектесемін."
    : "Здравствуйте! 👋\n\nНапишите, пожалуйста, чем могу помочь.";
}

function getDeEscalationReply(lang) {
  if (lang === "kz") {
    return (
      "Түсіндім, артық сұрақпен шаршатпаймын 🙏\n\n" +
      "Қысқаша жазыңыз:\n" +
      "1) не салу керек\n" +
      "2) өлшемі немесе ауданы\n" +
      "3) қай қала/аудан\n\n" +
      "Сосын бірден нақты жауап берем."
    );
  }

  return (
    "Понял вас, лишними вопросами перегружать не буду 🙏\n\n" +
    "Напишите коротко:\n" +
    "1) что нужно построить\n" +
    "2) размер или площадь\n" +
    "3) город/район\n\n" +
    "И я сразу дам конкретику."
  );
}

function getLanguageChoiceReply() {
  return (
    "Сәлеметсіз бе! 👋\nЗдравствуйте! 👋\n\n" +
    "Тілді таңдаңыз / Выберите язык:\n" +
    "1️⃣ Қазақша\n" +
    "2️⃣ Русский"
  );
}

function getMenuReply(projectKey, lang) {
  if (projectKey === "construction") {
    return lang === "kz"
      ? "Қай бағыт қызықтырады?\n1️⃣ Үй салу\n2️⃣ Коттедж салу\n3️⃣ Фундамент есебі\n4️⃣ Кеңес алу"
      : "Что вас интересует?\n1️⃣ Строительство дома\n2️⃣ Строительство коттеджа\n3️⃣ Расчёт фундамента\n4️⃣ Консультация";
  }

  return lang === "kz"
    ? "Қай бағыт қызықтырады?\n1️⃣ Кеңес\n2️⃣ Процедуралар\n3️⃣ Жазылу\n4️⃣ Менеджер"
    : "Что вас интересует?\n1️⃣ Консультация\n2️⃣ Процедуры\n3️⃣ Запись\n4️⃣ Менеджер";
}

function getSupportReply(projectKey, lang, text) {
  const t = cleanText(text);

  if (projectKey === "construction") {
    if (
      t.includes("сколько") ||
      t.includes("цена") ||
      t.includes("стоим") ||
      t.includes("баға") ||
      t.includes("есеп")
    ) {
      return lang === "kz"
        ? "Түсіндім 👍 Нақты есеп керек екенін менеджерге жіберемін."
        : "Понял 👍 Передаю менеджеру, что вам нужен уточнённый расчёт.";
    }

    if (
      t.includes("когда") ||
      t.includes("ждать") ||
      t.includes("срок") ||
      t.includes("қашан")
    ) {
      return lang === "kz"
        ? "Менеджер өтінімді алды 👍 Егер шұғыл болса, осында қосымша жаза аласыз."
        : "Менеджер уже получил заявку 👍 Если вопрос срочный, можете написать сюда подробнее.";
    }

    return lang === "kz"
      ? "Мен байланыстамын 👍 Қосымша ақпарат болса, осы чатқа жаза аласыз — менеджерге жеткіземін."
      : "Я на связи 👍 Если есть дополнительные детали по объекту, можете написать сюда — передам менеджеру.";
  }

  return lang === "kz"
    ? "Мен байланыстамын 👍"
    : "Я на связи 👍";
}

function buildLeadPayload(projectKey, from, session) {
  return {
    whatsapp: from,
    phone: session.data?.phone || from,
    name: session.data?.name || "Не указано",
    direction: session.data?.intent || "Не указано",
    location: session.data?.location || "Не указано",
    size: session.data?.size || "Не указано",
    timing: session.data?.timing || "Не указано",
    projectKey,
  };
}

async function sendTelegramLeadNow(projectKey, from, session) {
  if (!sendTelegramLead || typeof sendTelegramLead !== "function") {
    console.log("⚠️ sendTelegramLead function not available");
    return false;
  }

  try {
    const payload = buildLeadPayload(projectKey, from, session);
    const result = await sendTelegramLead(payload);
    console.log("📨 TELEGRAM LEAD SENT:", result);
    return true;
  } catch (error) {
    console.log("❌ TELEGRAM SEND ERROR:", error.message);
    return false;
  }
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

function scheduleSoftFollowUps({ projectKey, from, lang }) {
  // follow-up #1 через 30 минут
  setTimeout(async () => {
    try {
      const session = getSession(projectKey, from);
      if (!session) return;
      if (session.mode !== "support") return;
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
    } catch (e) {
      console.log("❌ FOLLOW-UP #1 ERROR:", e.message);
    }
  }, 30 * 60 * 1000);

  // follow-up #2 через 12 часов
  setTimeout(async () => {
    try {
      const session = getSession(projectKey, from);
      if (!session) return;
      if (session.mode !== "support") return;
      if (session.userRepliedAfterCompleted) return;
      if (session.followUpCount >= 2) return;

      const project = getProjectConfig(
        projectKey === "construction"
          ? process.env.CONSTRUCTION_PHONE_NUMBER_ID
          : process.env.CLINIC_PHONE_NUMBER_ID
      );

      const text =
        lang === "kz"
          ? "Егер есептеу әлі де өзекті болса, кез келген уақытта жаза аласыз 👍"
          : "Если расчёт ещё актуален, можете написать сюда в любое время 👍";

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
    } catch (e) {
      console.log("❌ FOLLOW-UP #2 ERROR:", e.message);
    }
  }, 12 * 60 * 60 * 1000);
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
    const detectedLang = session.language || detectLanguage(text) || "ru";

    await markMessageAsRead({
      accessToken,
      phoneNumberId: currentPhoneNumberId,
      messageId,
    });

    // если клиент ответил после заявки — отключаем follow-up
    if (session.mode === "support" || session.mode === "silent") {
      updateSession(projectKey, from, {
        userRepliedAfterCompleted: true,
        mode: "support",
      });

      const supportReply = getSupportReply(projectKey, session.language || detectedLang, text);

      await delay(getTypingDelay(supportReply));
      await sendWhatsAppMessage({
        accessToken,
        phoneNumberId: currentPhoneNumberId,
        to: from,
        body: supportReply,
      });

      return;
    }

    // раздражение
    if (isAngry(text)) {
      const reply = getDeEscalationReply(session.language || detectedLang);

      await delay(getTypingDelay(reply));
      await sendWhatsAppMessage({
        accessToken,
        phoneNumberId: currentPhoneNumberId,
        to: from,
        body: reply,
      });

      updateSession(projectKey, from, {
        language: session.language || detectedLang,
        step: "qualification",
      });

      return;
    }

    // приветствия
    if ((isGreeting(text) || isMuslimGreeting(text)) && session.step === "start") {
      const lang = session.language || detectedLang;
      const reply = getGreetingReply(projectKey, lang, text);

      await delay(getTypingDelay(reply));
      await sendWhatsAppMessage({
        accessToken,
        phoneNumberId: currentPhoneNumberId,
        to: from,
        body: reply,
      });

      updateSession(projectKey, from, {
        language: lang,
        step: "qualification",
      });

      return;
    }

    // если язык ещё не выбран
    if (!session.language && !isGreeting(text) && !isMuslimGreeting(text)) {
      const lang = detectLanguage(text);

      if (!lang) {
        const reply = getLanguageChoiceReply();

        await delay(getTypingDelay(reply));
        await sendWhatsAppMessage({
          accessToken,
          phoneNumberId: currentPhoneNumberId,
          to: from,
          body: reply,
        });

        updateSession(projectKey, from, {
          step: "language_select",
        });

        return;
      }

      updateSession(projectKey, from, {
        language: lang,
        step: "qualification",
      });

      const reply = getMenuReply(projectKey, lang);

      await delay(getTypingDelay(reply));
      await sendWhatsAppMessage({
        accessToken,
        phoneNumberId: currentPhoneNumberId,
        to: from,
        body: reply,
      });

      return;
    }

    // language_select / qualification
    if (session.step === "start" || session.step === "language_select" || session.step === "qualification") {
      const lang = session.language || detectLanguage(text) || "ru";
      const intent = detectIntent(text, projectKey);

      updateSession(projectKey, from, {
        language: lang,
        step: "ask_project",
        data: {
          ...(session.data || {}),
          intent: intent || session.data?.intent || null,
        },
      });

      const reply =
        lang === "kz"
          ? "Жақсы 👍 Енді қысқаша жазыңыз: не салу керек және қандай өлшем шамалас?"
          : "Хорошо 👍 Теперь коротко напишите: что нужно построить и какие примерно размеры?";

      await delay(getTypingDelay(reply));
      await sendWhatsAppMessage({
        accessToken,
        phoneNumberId: currentPhoneNumberId,
        to: from,
        body: reply,
      });

      return;
    }

    // ask_project
    if (session.step === "ask_project") {
      const lang = session.language || detectedLang;
      const nextData = {
        ...(session.data || {}),
        projectDetails: text,
      };

      const size = extractSize(text);
      if (size) nextData.size = size;

      // если уже достаточно данных — быстрее к номеру
      if (hasEnoughConstructionData(nextData) && projectKey === "construction") {
        updateSession(projectKey, from, {
          language: lang,
          step: "ask_phone",
          data: nextData,
        });

        const reply =
          lang === "kz"
            ? "Жақсы 👍 Негізгі ақпарат жеткілікті. Нақты есептеп, менеджер байланысуы үшін номеріңізді жазыңыз."
            : "Отлично 👍 Основной информации уже достаточно. Чтобы точно рассчитать и передать менеджеру, напишите ваш номер.";

        await delay(getTypingDelay(reply));
        await sendWhatsAppMessage({
          accessToken,
          phoneNumberId: currentPhoneNumberId,
          to: from,
          body: reply,
        });

        return;
      }

      updateSession(projectKey, from, {
        language: lang,
        step: "ask_location",
        data: nextData,
      });

      const reply =
        lang === "kz"
          ? "Түсіндім. Құрылыс қай қалада немесе ауданда болады?"
          : "Понял. В каком городе или районе планируется строительство?";

      await delay(getTypingDelay(reply));
      await sendWhatsAppMessage({
        accessToken,
        phoneNumberId: currentPhoneNumberId,
        to: from,
        body: reply,
      });

      return;
    }

    // ask_location
    if (session.step === "ask_location") {
      const lang = session.language || detectedLang;
      const nextData = {
        ...(session.data || {}),
        location: text,
      };

      updateSession(projectKey, from, {
        language: lang,
        step: "ask_size",
        data: nextData,
      });

      const reply =
        lang === "kz"
          ? "Жақсы. Енді объектінің өлшемін немесе шамамен ауданын жазыңыз."
          : "Хорошо. Теперь напишите размеры объекта или примерную площадь.";

      await delay(getTypingDelay(reply));
      await sendWhatsAppMessage({
        accessToken,
        phoneNumberId: currentPhoneNumberId,
        to: from,
        body: reply,
      });

      return;
    }

    // ask_size
    if (session.step === "ask_size") {
      const lang = session.language || detectedLang;
      const nextData = {
        ...(session.data || {}),
        size: extractSize(text) || text,
      };

      updateSession(projectKey, from, {
        language: lang,
        step: "ask_timing",
        data: nextData,
      });

      const reply =
        lang === "kz"
          ? "Құрылысты қашан бастауды жоспарлап отырсыз?"
          : "Когда планируете начинать строительство?";

      await delay(getTypingDelay(reply));
      await sendWhatsAppMessage({
        accessToken,
        phoneNumberId: currentPhoneNumberId,
        to: from,
        body: reply,
      });

      return;
    }

    // ask_timing
    if (session.step === "ask_timing") {
      const lang = session.language || detectedLang;

      updateSession(projectKey, from, {
        language: lang,
        step: "ask_name",
        data: {
          ...(session.data || {}),
          timing: text,
        },
      });

      const reply =
        lang === "kz"
          ? "Өзіңізді қалай атаймыз?"
          : "Как к вам можно обращаться?";

      await delay(getTypingDelay(reply));
      await sendWhatsAppMessage({
        accessToken,
        phoneNumberId: currentPhoneNumberId,
        to: from,
        body: reply,
      });

      return;
    }

    // ask_name
    if (session.step === "ask_name") {
      const lang = session.language || detectedLang;

      updateSession(projectKey, from, {
        language: lang,
        step: "ask_phone",
        data: {
          ...(session.data || {}),
          name: text,
        },
      });

      const reply =
        lang === "kz"
          ? "Рақмет. Байланыс үшін номеріңізді жазыңыз."
          : "Спасибо. Напишите, пожалуйста, ваш номер для связи.";

      await delay(getTypingDelay(reply));
      await sendWhatsAppMessage({
        accessToken,
        phoneNumberId: currentPhoneNumberId,
        to: from,
        body: reply,
      });

      return;
    }

    // ask_phone
    if (session.step === "ask_phone") {
      const lang = session.language || detectedLang;

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
        step: "completed",
        mode: "support",
        data: {
          ...(session.data || {}),
          phone: text,
        },
      });

      // СРАЗУ отправляем в Telegram
      if (!updated.leadSent) {
        const ok = await sendTelegramLeadNow(projectKey, from, updated);
        if (ok) {
          updateSession(projectKey, from, { leadSent: true });
        }
      }

      // ставим мягкие follow-up только один раз
      const latest = getSession(projectKey, from);
      if (!latest.followUpScheduled) {
        scheduleSoftFollowUps({
          projectKey,
          from,
          lang,
        });

        updateSession(projectKey, from, {
          followUpScheduled: true,
          followUpCount: 0,
          userRepliedAfterCompleted: false,
        });
      }

      const reply =
        lang === "kz"
          ? "Рақмет 🙌 Өтініміңіз менеджерге жіберілді. Жақын арада сізбен байланысады.\n\nҚажет болса, осы чатқа қосымша ақпарат жаза аласыз."
          : "Спасибо 🙌 Ваша заявка сразу передана менеджеру. Он свяжется с вами в ближайшее время.\n\nЕсли хотите, можете написать сюда дополнительные детали по объекту.";

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
    const fallback =
      detectedLang === "kz"
        ? "Түсіндім 👍 Қысқаша жазыңыз, не керек: үй, коттедж, фундамент немесе кеңес."
        : "Понял 👍 Напишите коротко, что нужно: дом, коттедж, фундамент или консультация.";

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
