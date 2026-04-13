const projects = require("./config/projects.config");

function normalizeText(text) {
  return String(text || "").trim().toLowerCase();
}

function detectLanguage(text, projectConfig) {
  const t = normalizeText(text);

  if (projectConfig.languageButtons.kz.includes(t)) return "kz";
  if (projectConfig.languageButtons.ru.includes(t)) return "ru";

  const kzChars = /[әіңғүұқөһ]/i;
  if (kzChars.test(t)) return "kz";

  const ruChars = /[а-яё]/i;
  if (ruChars.test(t)) return "ru";

  return null;
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

function looksLikePhone(text) {
  const n = String(text || "").replace(/\D/g, "");
  return n.length >= 10 && n.length <= 15;
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
  const t = normalizeText(text);

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

  const language = session?.language || detectLanguage(t, projectConfig);

  // SUPPORT MODE
  if (session?.mode === "support") {
    return {
      project: projectKey,
      result: {
        reply: buildSupportReply(language || "ru", projectConfig, t),
        nextStep: "done",
        mode: "support",
        language: language || session?.language || "ru",
        data: session?.data || {},
      },
    };
  }

  // START / LANGUAGE
  if (!session?.language) {
    const lang = detectLanguage(t, projectConfig);

    if (!lang) {
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
        reply: projectConfig.welcome[lang],
        nextStep: "qualification",
        mode: "scenario",
        language: lang,
        data: session?.data || {},
      },
    };
  }

  const lang = session.language;
  const prompts = projectConfig.prompts[lang] || projectConfig.prompts.ru;
  const currentData = session?.data || {};

  // INTENT FROM BUTTONS / TEXT
  if (session?.step === "qualification") {
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

  // fallback after language set
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

module.exports = { routeMessage };