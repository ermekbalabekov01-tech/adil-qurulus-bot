const projects = require("./config/projects.config");

function normalizeText(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[ʼ'`]/g, "")
    .replace(/\s+/g, " ");
}

function cleanGreetingText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-zа-яёәіңғүұқөһі\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectLanguage(text, projectConfig) {
  const t = normalizeText(text);

  if (projectConfig?.languageButtons?.kz?.includes(t)) return "kz";
  if (projectConfig?.languageButtons?.ru?.includes(t)) return "ru";

  const kzChars = /[әіңғүұқөһі]/i;
  if (kzChars.test(t)) return "kz";

  const ruChars = /[а-яё]/i;
  if (ruChars.test(t)) return "ru";

  return null;
}

function isGreeting(text) {
  const t = cleanGreetingText(text);

  return [
    "привет",
    "здравствуйте",
    "здраствуйте",
    "добрый день",
    "добрый вечер",
    "доброе утро",
    "салам",
    "сәлем",
    "салем",
    "hello",
    "hi",
    "hey",
  ].some((g) => t.includes(g));
}

function isMuslimGreeting(text) {
  const t = cleanGreetingText(text);

  return (
    t.includes("ассаляму алейкум") ||
    t.includes("ассаламу алейкум") ||
    t.includes("ассалам алейкум") ||
    t.includes("ассаламагалейкум") ||
    t.includes("ассаламуагалейкум") ||
    t.includes("ас саляму алейкум") ||
    t.includes("асаламу алейкум") ||
    t.includes("асаламалейкум") ||
    t.includes("салам алейкум") ||
    t.includes("саламалейкум") ||
    t.includes("assalamu alaikum") ||
    t.includes("assalamu alaykum") ||
    t.includes("salam alaikum")
  );
}

function isAngry(text) {
  const t = normalizeText(text);

  return (
    t.includes("издеваешься") ||
    t.includes("ты что") ||
    t.includes("что с тобой") ||
    t.includes("ты вообще") ||
    t.includes("не понял") ||
    t.includes("бесишь") ||
    t.includes("достал") ||
    t.includes("задолбал") ||
    t.includes("зачем снова") ||
    t.includes("я же сказал") ||
    t.includes("тормоз") ||
    t.includes("что за бот") ||
    t.includes("что за фигня")
  );
}

function looksLikePhone(text) {
  const n = String(text || "").replace(/\D/g, "");
  return n.length >= 10 && n.length <= 15;
}

function containsUsefulConstructionData(text) {
  const t = normalizeText(text);

  return (
    /\d/.test(t) ||
    t.includes("фундамент") ||
    t.includes("дом") ||
    t.includes("коттедж") ||
    t.includes("баня") ||
    t.includes("үй") ||
    t.includes("плита") ||
    t.includes("лента") ||
    t.includes("сваи") ||
    t.includes("размер") ||
    t.includes("размеры") ||
    t.includes("материал") ||
    t.includes("газоблок") ||
    t.includes("кирпич") ||
    t.includes("бетон")
  );
}

function detectIntent(text, projectConfig) {
  const t = normalizeText(text);

  for (const [intent, phrases] of Object.entries(projectConfig.intentMap || {})) {
    if (phrases.some((phrase) => t.includes(normalizeText(phrase)))) {
      return intent;
    }
  }

  return null;
}

function getSellerGreetingReply(lang = "ru", isIslamic = false) {
  if (lang === "kz") {
    if (isIslamic) {
      return (
        "Уағалейкум ассалам 🤝\n\n" +
        "Adil Qurulus байланыста.\n" +
        "Үй, коттедж немесе фундамент бойынша не керек екенін қысқаша жазыңыз — бірден нақты бағыт берем."
      );
    }

    return (
      "Сәлеметсіз бе! 👋\n\n" +
      "Adil Qurulus байланыста.\n" +
      "Үй, коттедж немесе фундамент керек болса, қысқаша жаза аласыз — бірден нақтылап берем."
    );
  }

  if (isIslamic) {
    return (
      "Ва алейкум ассалам 🤝\n\n" +
      "Adil Qurulus на связи.\n" +
      "Напишите коротко, что вас интересует: дом, коттедж или фундамент — и я сразу сориентирую."
    );
  }

  return (
    "Здравствуйте! 👋\n\n" +
    "Adil Qurulus на связи.\n" +
    "Напишите коротко, что вас интересует: дом, коттедж или фундамент — и я сразу сориентирую."
  );
}

function getDeEscalationReply(lang = "ru") {
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

function buildSupportReply(lang, projectConfig, text) {
  const t = normalizeText(text);
  const prompts = projectConfig.prompts[lang] || projectConfig.prompts.ru;

  if (
    t.includes("когда") ||
    t.includes("срок") ||
    t.includes("ждать") ||
    t.includes("қашан")
  ) {
    return prompts.supportTiming;
  }

  if (
    t.includes("цена") ||
    t.includes("стоим") ||
    t.includes("сколько") ||
    t.includes("баға") ||
    t.includes("есеп")
  ) {
    return prompts.supportEstimate;
  }

  return prompts.supportGeneric;
}

async function routeMessage({ text, session, projectType }) {
  const projectKey = projectType || "construction";
  const projectConfig = projects[projectKey];

  if (!projectConfig) {
    return {
      project: "construction",
      result: {
        reply: "Проект не найден",
        nextStep: "start",
        data: session?.data || {},
      },
    };
  }

  const t = normalizeText(text);
  const language = session?.language || detectLanguage(t, projectConfig);
  const lang = language || "ru";

  if (session?.mode === "support") {
    return {
      project: projectKey,
      result: {
        reply: buildSupportReply(lang, projectConfig, text),
        nextStep: "done",
        mode: "support",
        language: lang,
        data: session?.data || {},
      },
    };
  }

  if (isAngry(text)) {
    return {
      project: projectKey,
      result: {
        reply: getDeEscalationReply(lang),
        nextStep: session?.step || "qualification",
        mode: session?.mode || "scenario",
        language: lang,
        data: session?.data || {},
      },
    };
  }

  if (isMuslimGreeting(text) && projectKey === "construction" && !containsUsefulConstructionData(text)) {
    return {
      project: projectKey,
      result: {
        reply: getSellerGreetingReply(lang, true),
        nextStep: session?.step === "start" ? "qualification" : session?.step || "qualification",
        mode: session?.mode || "scenario",
        language: lang,
        data: session?.data || {},
      },
    };
  }

  if (isGreeting(text) && projectKey === "construction" && !containsUsefulConstructionData(text)) {
    return {
      project: projectKey,
      result: {
        reply: getSellerGreetingReply(lang, false),
        nextStep: session?.step === "start" ? "qualification" : session?.step || "qualification",
        mode: session?.mode || "scenario",
        language: lang,
        data: session?.data || {},
      },
    };
  }

  if (!session?.language) {
    const detected = detectLanguage(t, projectConfig);

    if (!detected) {
      return {
        project: projectKey,
        result: {
          reply: projectConfig.welcome.mixed,
          nextStep: "language_select",
          mode: "scenario",
          language: null,
          data: session?.data || {},
        },
      };
    }

    return {
      project: projectKey,
      result: {
        reply: projectConfig.welcome[detected],
        nextStep: "qualification",
        mode: "scenario",
        language: detected,
        data: session?.data || {},
      },
    };
  }

  const prompts = projectConfig.prompts[lang] || projectConfig.prompts.ru;
  const currentData = session?.data || {};

  if (session?.step === "qualification" || session?.step === "language_select") {
    const intent = detectIntent(t, projectConfig);
    const nextData = { ...currentData };
    if (intent) nextData.intent = intent;

    return {
      project: projectKey,
      result: {
        reply: prompts.askProject,
        nextStep: "ask_project",
        mode: "scenario",
        language: lang,
        data: nextData,
      },
    };
  }

  if (session?.step === "ask_project") {
    return {
      project: projectKey,
      result: {
        reply: prompts.askLocation,
        nextStep: "ask_location",
        mode: "scenario",
        language: lang,
        data: {
          ...currentData,
          projectDetails: text,
        },
      },
    };
  }

  if (session?.step === "ask_location") {
    return {
      project: projectKey,
      result: {
        reply: prompts.askSize,
        nextStep: "ask_size",
        mode: "scenario",
        language: lang,
        data: {
          ...currentData,
          location: text,
        },
      },
    };
  }

  if (session?.step === "ask_size") {
    return {
      project: projectKey,
      result: {
        reply: prompts.askTiming,
        nextStep: "ask_timing",
        mode: "scenario",
        language: lang,
        data: {
          ...currentData,
          size: text,
        },
      },
    };
  }

  if (session?.step === "ask_timing") {
    return {
      project: projectKey,
      result: {
        reply: prompts.askName,
        nextStep: "ask_name",
        mode: "scenario",
        language: lang,
        data: {
          ...currentData,
          timing: text,
        },
      },
    };
  }

  if (session?.step === "ask_name") {
    return {
      project: projectKey,
      result: {
        reply: prompts.askPhone,
        nextStep: "ask_phone",
        mode: "scenario",
        language: lang,
        data: {
          ...currentData,
          name: text,
        },
      },
    };
  }

  if (session?.step === "ask_phone") {
    if (!looksLikePhone(text)) {
      return {
        project: projectKey,
        result: {
          reply: prompts.askPhone,
          nextStep: "ask_phone",
          mode: "scenario",
          language: lang,
          data: currentData,
        },
      };
    }

    return {
      project: projectKey,
      result: {
        reply: prompts.leadCreated,
        nextStep: "completed",
        mode: "support",
        language: lang,
        data: {
          ...currentData,
          phone: text,
        },
      },
    };
  }

  return {
    project: projectKey,
    result: {
      reply: projectConfig.welcome[lang],
      nextStep: "qualification",
      mode: "scenario",
      language: lang,
      data: currentData,
    },
  };
}

module.exports = {
  routeMessage,
};