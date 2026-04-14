const axios = require("axios");

const sessions = new Map();

/* ---------------- helpers ---------------- */

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

function detectLanguage(text) {
  const t = cleanText(text);

  if (["1", "русский", "ru", "russian"].includes(t)) return "ru";
  if (["2", "қазақша", "kz", "казахский"].includes(t)) return "kz";

  if (/[әіңғүұқөһі]/i.test(t)) return "kz";
  if (/[а-яё]/i.test(t)) return "ru";

  return null;
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
    t.includes("assalamu alaykum")
  );
}

function isAngry(text) {
  const t = cleanText(text);

  return (
    t.includes("издеваешься") ||
    t.includes("я же сказал") ||
    t.includes("что с тобой") ||
    t.includes("ты что") ||
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

function isPricingIntent(text) {
  const t = cleanText(text);

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
    ) return "foundation";
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

  const square = raw.match(/(\d+[.,]?\d*)\s*(кв|м2|м²)/i);
  if (square) return square[0];

  const meters = raw.match(/(\d+[.,]?\d*)\s*(м|метр|метра|метров)/i);
  if (meters) return meters[0];

  return null;
}

function normalizeIntentLabel(intent, lang) {
  if (lang === "kz") {
    if (intent === "house") return "үй";
    if (intent === "cottage") return "коттедж";
    if (intent === "foundation") return "фундамент";
    if (intent === "consultation") return "кеңес";
    return intent || "объект";
  }

  if (intent === "house") return "дом";
  if (intent === "cottage") return "коттедж";
  if (intent === "foundation") return "фундамент";
  if (intent === "consultation") return "консультация";
  return intent || "объект";
}

/* ---------------- session ---------------- */

function getSession(projectKey, phone) {
  const key = `${projectKey}:${normalizePhone(phone)}`;

  if (!sessions.has(key)) {
    sessions.set(key, {
      step: "start",
      mode: "scenario", // scenario | support
      language: null,
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

/* ---------------- texts ---------------- */

function getBilingualWelcome() {
  return (
    "Здравствуйте! 👋\n" +
    "Сәлеметсіз бе! 👋\n\n" +
    "Компания Adil Qurulus.\n" +
    "Астанада үй, коттедж және фундамент саламыз.\n" +
    "Строим дома, коттеджи и фундамент в Астане.\n\n" +
    "Выберите язык:\n" +
    "1️⃣ Русский\n" +
    "2️⃣ Қазақша"
  );
}

function getNeedReply(lang) {
  return lang === "kz"
    ? "Жақсы 👌\n\nҚысқаша жазыңыз, не керек:\n— үй\n— коттедж\n— фундамент\n— кеңес"
    : "Хорошо 👌\n\nНапишите, пожалуйста, что именно вас интересует:\n— дом\n— коттедж\n— фундамент\n— консультация";
}

function getProjectReply(lang, intentLabel) {
  return lang === "kz"
    ? `Түсіндім 👍\n\n${intentLabel} бойынша жоба бар ма, әлде нөлден бастайсыз?`
    : `Понял 👍\n\nПо направлению "${intentLabel}" подскажите: проект уже есть или планируете начинать с нуля?`;
}

function getAskSizeReply(lang) {
  return lang === "kz"
    ? "Жақсы.\n\nШамамен өлшемін немесе ауданын жазыңыз."
    : "Хорошо.\n\nНапишите примерные размеры объекта или площадь.";
}

function getAskLocationReply(lang, sizeText = "") {
  if (lang === "kz") {
    return (
      `Жақсы. ${sizeText ? `${sizeText} 👍\n\n` : ""}` +
      "Құрылыс қай қалада немесе ауданда болады?"
    );
  }

  return (
    `Хорошо. ${sizeText ? `${sizeText} 👍\n\n` : ""}` +
    "В каком городе или районе планируется строительство?"
  );
}

function getAskNameReply(lang) {
  return lang === "kz"
    ? "Рақмет.\n\nӨзіңізді қалай атаймыз?"
    : "Хорошо.\n\nКак к вам можно обращаться?";
}

function getAskPhoneReply(lang) {
  return lang === "kz"
    ? "Жақсы.\n\nМенеджер дұрыс бағыт беруі үшін номеріңізді жазыңыз."
    : "Хорошо.\n\nЧтобы менеджер подключился и дал точный ответ, напишите ваш номер для связи.";
}

function getPricingHandoffReply(lang) {
  return lang === "kz"
    ? "Нақты есеп дұрыс шығуы үшін менеджерді қосамын.\n\nОл детальдарды нақтылап, баға мен мерзім бойынша дұрыс бағыт береді.\n\nБайланыс үшін номеріңізді жазыңыз."
    : "Чтобы дать вам точный расчёт без ошибок, подключаю менеджера.\n\nОн уточнит детали и правильно сориентирует по срокам и стоимости.\n\nНапишите ваш номер для связи.";
}

function getDoneReply(lang) {
  if (lang === "kz") {
    return (
      "Керемет 👍\n\n" +
      "Өтініміңізді менеджерге жібердім.\n\n" +
      "📞 Ол сізбен жақын арада байланысып:\n" +
      "— детальдарды нақтылайды\n" +
      "— тиімді шешім ұсынады\n" +
      "— мерзім мен баға бойынша бағыт береді\n\n" +
      "⚠️ Қоңырауды өткізіп алмау үшін байланыста болыңыз.\n\n" +
      "💡 Қазір Астанада жұмыс істеп жатқан объектілер бар — менеджер нақты мысалдар көрсетіп, сіздің бюджетке сай қалай тиімді жасауға болатынын түсіндіреді.\n\n" +
      "Егер процесті жылдамдатқыңыз келсе, жаза аласыз:\n" +
      "— жоба бар ма\n" +
      "— немесе үй бойынша тілектеріңіз\n\n" +
      "Бірден жеткіземін 👍"
    );
  }

  return (
    "Отлично 👍\n\n" +
    "Я передал вашу заявку менеджеру.\n\n" +
    "📞 Он свяжется с вами в ближайшее время и:\n" +
    "— уточнит детали\n" +
    "— предложит оптимальное решение\n" +
    "— сориентирует по срокам и стоимости\n\n" +
    "⚠️ Пожалуйста, будьте на связи, чтобы не пропустить звонок.\n\n" +
    "💡 Сейчас в работе есть объекты в Астане — менеджер сможет показать реальные примеры и подсказать, как лучше сделать под ваш бюджет.\n\n" +
    "Если хотите ускорить процесс — напишите:\n" +
    "— есть ли проект\n" +
    "— или пожелания по дому\n\n" +
    "Я сразу передам 👍"
  );
}

function getAfterDoneReply(lang) {
  return lang === "kz"
    ? "Менеджерге жеткіземін 👍\n\nҚосымша ақпарат болса, жаза аласыз."
    : "Передам менеджеру 👍\n\nЕсли есть что добавить по объекту, можете написать сюда.";
}

function getAngryReply(lang) {
  return lang === "kz"
    ? "Түсіндім 🙏 Артық сұрақпен шаршатпаймын. Қысқаша жазыңыз: не салу керек, өлшемі және қай жерде."
    : "Понял вас 🙏 Лишними вопросами перегружать не буду. Напишите коротко: что нужно построить, размеры и где объект.";
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

    await markMessageAsRead({
      accessToken,
      phoneNumberId: currentPhoneNumberId,
      messageId,
    });

    // После заявки
    if (session.mode === "support") {
      const reply = getAfterDoneReply(session.language || "ru");

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
      const lang = session.language || detectLanguage(text) || "ru";
      const reply = getAngryReply(lang);

      await delay(getTypingDelay(reply));
      await sendWhatsAppMessage({
        accessToken,
        phoneNumberId: currentPhoneNumberId,
        to: from,
        body: reply,
      });

      return;
    }

    // Старт
    if (session.step === "start") {
      const reply = getBilingualWelcome();

      await delay(getTypingDelay(reply));
      await sendWhatsAppMessage({
        accessToken,
        phoneNumberId: currentPhoneNumberId,
        to: from,
        body: reply,
      });

      updateSession(projectKey, from, {
        step: "choose_language",
      });

      return;
    }

    // Выбор языка
    if (session.step === "choose_language") {
      const lang = detectLanguage(text);

      if (!lang) {
        const reply = getBilingualWelcome();

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
        step: "ask_need",
      });

      const reply = getNeedReply(lang);

      await delay(getTypingDelay(reply));
      await sendWhatsAppMessage({
        accessToken,
        phoneNumberId: currentPhoneNumberId,
        to: from,
        body: reply,
      });

      return;
    }

    // Что нужно
    if (session.step === "ask_need") {
      const lang = session.language || "ru";
      const intent = detectIntent(text, projectKey);
      const size = extractSize(text);

      updateSession(projectKey, from, {
        step: size ? "ask_location" : intent ? "ask_project" : "ask_project",
        data: {
          ...(session.data || {}),
          intent: intent || text,
          projectDetails: text,
          size: size || session.data?.size || null,
        },
      });

      if (size) {
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

      const reply = getProjectReply(lang, normalizeIntentLabel(intent || text, lang));

      await delay(getTypingDelay(reply));
      await sendWhatsAppMessage({
        accessToken,
        phoneNumberId: currentPhoneNumberId,
        to: from,
        body: reply,
      });

      return;
    }

    // Есть ли проект
    if (session.step === "ask_project") {
      const lang = session.language || "ru";
      const size = extractSize(text);

      updateSession(projectKey, from, {
        step: size ? "ask_location" : "ask_size",
        data: {
          ...(session.data || {}),
          hasProject: text,
          size: size || session.data?.size || null,
        },
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
      const lang = session.language || "ru";
      const size = extractSize(text) || text;

      updateSession(projectKey, from, {
        step: "ask_location",
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

    // Локация
    if (session.step === "ask_location") {
      const lang = session.language || "ru";

      updateSession(projectKey, from, {
        step: "ask_name",
        data: {
          ...(session.data || {}),
          location: text,
        },
      });

      const reply = getAskNameReply(lang);

      await delay(getTypingDelay(reply));
      await sendWhatsAppMessage({
        accessToken,
        phoneNumberId: currentPhoneNumberId,
        to: from,
        body: reply,
      });

      return;
    }

    // Имя
    if (session.step === "ask_name") {
      const lang = session.language || "ru";

      updateSession(projectKey, from, {
        step: "ask_phone",
        data: {
          ...(session.data || {}),
          name: text,
        },
      });

      const detailsText =
        isPricingIntent(session.data?.projectDetails || "") || isPricingIntent(text)
          ? getPricingHandoffReply(lang)
          : getAskPhoneReply(lang);

      await delay(getTypingDelay(detailsText));
      await sendWhatsAppMessage({
        accessToken,
        phoneNumberId: currentPhoneNumberId,
        to: from,
        body: detailsText,
      });

      return;
    }

    // Номер
    if (session.step === "ask_phone") {
      const lang = session.language || "ru";

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

      updateSession(projectKey, from, {
        step: "done",
        mode: "support",
        data: {
          ...(session.data || {}),
          phone: text,
        },
      });

      const reply = getDoneReply(lang);

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
    const reply = getNeedReply(session.language || "ru");

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
