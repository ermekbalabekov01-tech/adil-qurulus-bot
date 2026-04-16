const projects = require("./config/projects.config");
const { getAIReply } = require("./services/ai.service");

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
    .replace(/[^a-zа-яёәіңғүұқөһі0-9\s./:-]/gi, " ")
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

function extractName(text) {
  const cleaned = String(text || "")
    .replace(/[^\p{L}\s-]/gu, " ")
    .trim()
    .replace(/\s+/g, " ");

  if (!cleaned) return "";
  const parts = cleaned.split(" ");
  return parts[0] || cleaned;
}

function monthNumberByWord(text) {
  const t = normalizeText(text);

  const months = {
    "январ": 0,
    "феврал": 1,
    "март": 2,
    "апрел": 3,
    "май": 4,
    "мая": 4,
    "июн": 5,
    "июл": 6,
    "август": 7,
    "сентябр": 8,
    "октябр": 9,
    "ноябр": 10,
    "декабр": 11,
    "қаңтар": 0,
    "ақпан": 1,
    "наурыз": 2,
    "сәуір": 3,
    "мамыр": 4,
    "маусым": 5,
    "шілде": 6,
    "тамыз": 7,
    "қыркүйек": 8,
    "қазан": 9,
    "қараша": 10,
    "желтоқсан": 11,
  };

  for (const [key, value] of Object.entries(months)) {
    if (t.includes(key)) return value;
  }

  return null;
}

function formatDateForUser(date, lang = "ru") {
  const d = new Date(date);
  const monthsRu = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
  ];
  const monthsKz = [
    "қаңтар", "ақпан", "наурыз", "сәуір", "мамыр", "маусым",
    "шілде", "тамыз", "қыркүйек", "қазан", "қараша", "желтоқсан",
  ];

  if (lang === "kz") {
    return `${d.getDate()} ${monthsKz[d.getMonth()]}`;
  }

  return `${d.getDate()} ${monthsRu[d.getMonth()]}`;
}

function parseVisitDate(text, lang = "ru") {
  const t = normalizeText(text);
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  if (t.includes("сегодня") || t.includes("бүгін")) {
    return {
      ok: true,
      value: formatDateForUser(now, lang),
      iso: now.toISOString().slice(0, 10),
    };
  }

  if (t.includes("завтра") || t.includes("ертең")) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return {
      ok: true,
      value: formatDateForUser(d, lang),
      iso: d.toISOString().slice(0, 10),
    };
  }

  if (t.includes("послезавтра")) {
    const d = new Date(now);
    d.setDate(d.getDate() + 2);
    return {
      ok: true,
      value: formatDateForUser(d, lang),
      iso: d.toISOString().slice(0, 10),
    };
  }

  const weekdaysRu = {
    "понедельник": 1,
    "вторник": 2,
    "среда": 3,
    "четверг": 4,
    "пятница": 5,
    "суббота": 6,
    "воскресенье": 0,
  };

  const weekdaysKz = {
    "дүйсенбі": 1,
    "сейсенбі": 2,
    "сәрсенбі": 3,
    "бейсенбі": 4,
    "жұма": 5,
    "сенбі": 6,
    "жексенбі": 0,
  };

  for (const [dayText, weekday] of Object.entries({ ...weekdaysRu, ...weekdaysKz })) {
    if (t.includes(dayText)) {
      const d = new Date(now);
      let diff = (weekday - d.getDay() + 7) % 7;
      if (diff === 0) diff = 7;
      d.setDate(d.getDate() + diff);

      return {
        ok: true,
        value: formatDateForUser(d, lang),
        iso: d.toISOString().slice(0, 10),
      };
    }
  }

  const numeric = t.match(/\b(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?\b/);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]) - 1;
    let year = numeric[3] ? Number(numeric[3]) : now.getFullYear();
    if (year < 100) year += 2000;

    const d = new Date(year, month, day);
    if (!Number.isNaN(d.getTime())) {
      return {
        ok: true,
        value: formatDateForUser(d, lang),
        iso: d.toISOString().slice(0, 10),
      };
    }
  }

  const dayOnly = t.match(/\b([0-2]?\d|3[01])\b/);
  const monthByWord = monthNumberByWord(t);
  if (dayOnly && monthByWord !== null) {
    let year = now.getFullYear();
    const d = new Date(year, monthByWord, Number(dayOnly[1]));
    if (d < now) d.setFullYear(year + 1);

    return {
      ok: true,
      value: formatDateForUser(d, lang),
      iso: d.toISOString().slice(0, 10),
    };
  }

  return { ok: false };
}

function parseVisitTime(text) {
  const t = normalizeText(text);

  const match = t.match(/\b([0-2]?\d)[:. ]([0-5]\d)\b/);
  if (match) {
    const hh = Number(match[1]);
    const mm = Number(match[2]);
    if (hh <= 23 && mm <= 59) {
      return {
        ok: true,
        value: `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`,
        hour: hh,
        minute: mm,
      };
    }
  }

  const hourOnly = t.match(/\b([0-2]?\d)\b/);
  if (hourOnly) {
    const hh = Number(hourOnly[1]);
    if (hh <= 23) {
      return {
        ok: true,
        value: `${String(hh).padStart(2, "0")}:00`,
        hour: hh,
        minute: 0,
      };
    }
  }

  return { ok: false };
}

function isWithinClinicHours(parsedTime) {
  if (!parsedTime?.ok) return false;

  const total = parsedTime.hour * 60 + parsedTime.minute;
  const start = 9 * 60;
  const end = 20 * 60;

  return total >= start && total <= end;
}

function getClinicWorkingHoursReply(lang = "ru") {
  if (lang === "kz") {
    return (
      "Клиника 09:00-ден 20:00-ге дейін жұмыс істейді 🌿\n\n" +
      "Осы аралықтағы ыңғайлы уақытты жазыңыз.\nМысалы: 12:00"
    );
  }

  return (
    "Клиника работает с 09:00 до 20:00 🌿\n\n" +
    "Напишите, пожалуйста, удобное время в этом диапазоне.\nНапример: 12:00"
  );
}

function isTrainingIntent(text, currentData = {}) {
  const t = normalizeText(text);

  if (currentData?.intent === "training") return true;

  return (
    t.includes("обучение") ||
    t.includes("курс") ||
    t.includes("курсы") ||
    t.includes("хочу учиться") ||
    t.includes("обучение пересадке") ||
    t.includes("обучение волос") ||
    t.includes("мастер класс") ||
    t.includes("мастер-класс") ||
    t.includes("семинар") ||
    t.includes("обучаться") ||
    t.includes("оқу") ||
    t.includes("курсқа") ||
    t.includes("үйрену")
  );
}

function clinicShouldUseAI(text, session) {
  const step = session?.step || "start";
  const t = normalizeText(text);

  const blockedSteps = [
    "language_select",
    "start",
    "ask_phone",
    "training_phone",
    "completed",
    "done",
  ];

  if (blockedSteps.includes(step)) return false;
  if (looksLikePhone(text)) return false;
  if (isGreeting(text)) return false;
  if (t.length < 8) return false;

  const aiSignals = [
    "сколько",
    "цена",
    "стоимость",
    "больно",
    "опасно",
    "можно ли",
    "подойдет ли",
    "какая разница",
    "как проходит",
    "сколько длится",
    "сколько дней",
    "реабилитация",
    "восстановление",
    "шрам",
    "результат",
    "приживаемость",
    "противопоказ",
    "обучение",
    "курс",
    "семинар",
    "хочу узнать",
    "расскажите",
    "подскажите подробнее",
    "қанша",
    "бағасы",
    "ауыра ма",
    "қалай өтеді",
    "үйрету",
    "оқу",
    "курс",
    "семинар",
  ];

  return aiSignals.some((word) => t.includes(word));
}

function getClinicStepReminder(step, lang = "ru") {
  const reminders = {
    ru: {
      ask_service: "Если удобно, напишите, пожалуйста, какая процедура вас интересует.",
      ask_photo: "Если удобно, отправьте фото зоны или просто напишите: Без фото.",
      ask_day: "Напишите, пожалуйста, удобный день для консультации.",
      ask_time: "И напишите удобное время. Например: 12:00",
      ask_name_age: "И напишите, пожалуйста, как к вам обращаться и ваш возраст.",
      training_name: "И напишите, пожалуйста, как к вам обращаться.",
      training_phone: "И напишите, пожалуйста, номер телефона для связи.",
    },
    kz: {
      ask_service: "Ыңғайлы болса, қай процедура қызықтыратынын жазыңыз.",
      ask_photo: "Ыңғайлы болса, фото жіберіңіз немесе: Фото жоқ деп жазыңыз.",
      ask_day: "Консультацияға ыңғайлы күніңізді жазыңыз.",
      ask_time: "Және ыңғайлы уақытыңызды жазыңыз. Мысалы: 12:00",
      ask_name_age: "Және өз атыңыз бен жасыңызды жазыңыз.",
      training_name: "Және өз атыңызды жазыңыз.",
      training_phone: "Және байланыс үшін телефон нөміріңізді жазыңыз.",
    },
  };

  return reminders[lang]?.[step] || reminders.ru.ask_service;
}

async function tryClinicAIReply({ text, session, lang }) {
  try {
    const aiReply = await getAIReply({
      project: "clinic",
      message: text,
      session: {
        ...session,
        language: lang,
        aiInstructions:
          "Ты Алия, ассистент клиники Dr.Aitimbetova. " +
          "Отвечай тепло, по делу и коротко. " +
          "Не ставь диагноз. " +
          "Не обещай результат операции. " +
          "Не называй точную цену без консультации и оценки зоны. " +
          "Если вопрос про обучение, скажи, что администратор свяжется для уточнения программы, формата, стоимости и ближайших дат. " +
          "После ответа мягко возвращай человека к записи.",
      },
    });

    return aiReply || "";
  } catch (error) {
    console.error("❌ clinic AI error:", error.message);
    return "";
  }
}

async function routeClinicMessage({ text, session, projectConfig, lang }) {
  const prompts = projectConfig.prompts[lang] || projectConfig.prompts.ru;
  const currentData = session?.data || {};

  if (!session?.language) {
    const detected = detectLanguage(text, projectConfig);

    if (!detected) {
      return {
        project: "clinic",
        result: {
          reply: projectConfig.welcome.mixed,
          nextStep: "language_select",
          mode: "scenario",
          language: null,
          data: currentData,
        },
      };
    }

    return {
      project: "clinic",
      result: {
        reply: projectConfig.welcome[detected],
        nextStep: "ask_city",
        mode: "scenario",
        language: detected,
        data: currentData,
      },
    };
  }

  if (session?.mode === "support") {
    return {
      project: "clinic",
      result: {
        reply: buildSupportReply(lang, projectConfig, text),
        nextStep: "done",
        mode: "support",
        language: lang,
        data: currentData,
      },
    };
  }

  if (clinicShouldUseAI(text, session)) {
    const aiReply = await tryClinicAIReply({
      text,
      session,
      lang,
    });

    if (aiReply) {
      const reminder = getClinicStepReminder(session?.step, lang);

      return {
        project: "clinic",
        result: {
          reply: `${aiReply}\n\n${reminder}`,
          nextStep: session?.step || "ask_service",
          mode: "scenario",
          language: lang,
          data: currentData,
        },
      };
    }
  }

  if (session?.step === "language_select") {
    return {
      project: "clinic",
      result: {
        reply: projectConfig.welcome[lang],
        nextStep: "ask_city",
        mode: "scenario",
        language: lang,
        data: currentData,
      },
    };
  }

  if (session?.step === "start" || session?.step === "ask_city") {
    return {
      project: "clinic",
      result: {
        reply: prompts.askLocation,
        nextStep: "ask_service",
        mode: "scenario",
        language: lang,
        data: {
          ...currentData,
          city: text,
          location: text,
        },
      },
    };
  }

  if (session?.step === "ask_service") {
    const intent = detectIntent(text, projectConfig) || currentData.intent;
    const training = isTrainingIntent(text, { ...currentData, intent });

    if (training) {
      return {
        project: "clinic",
        result: {
          reply:
            lang === "kz"
              ? "Түсіндім 🌿\n\nОқу бойынша сұранысыңызды қабылдадым.\nЕнді өз атыңызды жазыңызшы."
              : "Поняла 🌿\n\nПриняла ваш запрос по обучению.\nПодскажите, пожалуйста, как я могу к вам обращаться?",
          nextStep: "training_name",
          mode: "scenario",
          language: lang,
          data: {
            ...currentData,
            intent: "training",
            service: text,
            projectDetails: text,
          },
        },
      };
    }

    return {
      project: "clinic",
      result: {
        reply: prompts.askSize,
        nextStep: "ask_photo",
        mode: "scenario",
        language: lang,
        data: {
          ...currentData,
          service: text,
          projectDetails: text,
          intent,
        },
      },
    };
  }

  if (session?.step === "training_name") {
    return {
      project: "clinic",
      result: {
        reply:
          lang === "kz"
            ? "Рақмет 🌸\n\nТелефон нөміріңізді жазыңызшы. Администратор сізбен оқу бойынша хабарласады."
            : "Спасибо 🌸\n\nНапишите, пожалуйста, ваш номер телефона. Администратор свяжется с вами по обучению.",
        nextStep: "training_phone",
        mode: "scenario",
        language: lang,
        data: {
          ...currentData,
          name: extractName(text) || text,
        },
      },
    };
  }

  if (session?.step === "training_phone") {
    if (!looksLikePhone(text)) {
      return {
        project: "clinic",
        result: {
          reply:
            lang === "kz"
              ? "Телефон нөмірін ыңғайлы форматта жазыңызшы."
              : "Пожалуйста, напишите номер телефона в удобном формате.",
          nextStep: "training_phone",
          mode: "scenario",
          language: lang,
          data: currentData,
        },
      };
    }

    return {
      project: "clinic",
      result: {
        reply:
          lang === "kz"
            ? "Рақмет 🌿\n\nОқу бойынша сұранысыңызды администраторға жібердім.\nСізбен бағдарлама, формат, бағасы және жақын күндер туралы нақтылау үшін хабарласады."
            : "Спасибо 🌿\n\nЯ передала ваш запрос по обучению администратору.\nС вами свяжутся для уточнения программы, формата, стоимости и ближайших дат.",
        nextStep: "completed",
        mode: "support",
        language: lang,
        data: {
          ...currentData,
          phone: text,
          leadType: "training",
        },
      },
    };
  }

  if (session?.step === "ask_photo") {
    return {
      project: "clinic",
      result: {
        reply: prompts.askTiming,
        nextStep: "ask_day",
        mode: "scenario",
        language: lang,
        data: {
          ...currentData,
          photoStatus: text,
          size: text,
        },
      },
    };
  }

  if (session?.step === "ask_day") {
    const parsedDate = parseVisitDate(text, lang);

    if (!parsedDate.ok) {
      return {
        project: "clinic",
        result: {
          reply:
            lang === "kz"
              ? "Күні ыңғайлы форматта жазыңызшы 🌿\nМысалы: ертең, дүйсенбі, 19 сәуір"
              : "Напишите, пожалуйста, дату в удобном формате 🌿\nНапример: завтра, понедельник, 19 апреля",
          nextStep: "ask_day",
          mode: "scenario",
          language: lang,
          data: currentData,
        },
      };
    }

    return {
      project: "clinic",
      result: {
        reply: prompts.askName,
        nextStep: "ask_time",
        mode: "scenario",
        language: lang,
        data: {
          ...currentData,
          visitDay: parsedDate.value,
          visitDateIso: parsedDate.iso,
          timing: parsedDate.value,
        },
      },
    };
  }

  if (session?.step === "ask_time") {
    const parsedTime = parseVisitTime(text);

    if (!parsedTime.ok) {
      return {
        project: "clinic",
        result: {
          reply:
            lang === "kz"
              ? "Уақытты ыңғайлы форматта жазыңызшы 🌿\nМысалы: 12:00"
              : "Напишите, пожалуйста, время в удобном формате 🌿\nНапример: 12:00",
          nextStep: "ask_time",
          mode: "scenario",
          language: lang,
          data: currentData,
        },
      };
    }

    if (!isWithinClinicHours(parsedTime)) {
      return {
        project: "clinic",
        result: {
          reply: getClinicWorkingHoursReply(lang),
          nextStep: "ask_time",
          mode: "scenario",
          language: lang,
          data: currentData,
        },
      };
    }

    return {
      project: "clinic",
      result: {
        reply: prompts.askProject,
        nextStep: "ask_name_age",
        mode: "scenario",
        language: lang,
        data: {
          ...currentData,
          visitTime: parsedTime.value,
          preferredTime: parsedTime.value,
        },
      },
    };
  }

  if (session?.step === "ask_name_age") {
    return {
      project: "clinic",
      result: {
        reply:
          lang === "kz"
            ? "Рақмет 🌸\n\nЕнді байланыс үшін телефон нөміріңізді жазыңызшы."
            : "Спасибо 🌸\n\nТеперь напишите, пожалуйста, ваш номер телефона для подтверждения записи.",
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
        project: "clinic",
        result: {
          reply:
            lang === "kz"
              ? "Телефон нөмірін ыңғайлы форматта жазыңызшы."
              : "Пожалуйста, напишите номер телефона в удобном формате.",
          nextStep: "ask_phone",
          mode: "scenario",
          language: lang,
          data: currentData,
        },
      };
    }

    const day = currentData.visitDay || "Не указано";
    const time = currentData.visitTime || currentData.preferredTime || "Не указано";
    const city = currentData.city || currentData.location || "Не указано";
    const service = currentData.service || currentData.projectDetails || "Не указано";

    const finalReply =
      lang === "kz"
        ? `Рақмет 🌿\n\nСізді алдын ала консультацияға жаздым:\n• Қала: ${city}\n• Процедура: ${service}\n• Күні: ${day}\n• Уақыты: ${time}\n\nАдминистратор жақын арада растау үшін хабарласады.`
        : `Спасибо 🌿\n\nПредварительно записала вас на консультацию:\n• Город: ${city}\n• Услуга: ${service}\n• Дата: ${day}\n• Время: ${time}\n\nАдминистратор свяжется с вами в ближайшее время для подтверждения записи.`;

    return {
      project: "clinic",
      result: {
        reply: finalReply,
        nextStep: "completed",
        mode: "support",
        language: lang,
        data: {
          ...currentData,
          phone: text,
          leadType: "consultation",
        },
      },
    };
  }

  return {
    project: "clinic",
    result: {
      reply: projectConfig.welcome[lang],
      nextStep: "ask_city",
      mode: "scenario",
      language: lang,
      data: currentData,
    },
  };
}

async function routeConstructionMessage({ text, session, projectConfig, lang }) {
  const t = normalizeText(text);
  const currentData = session?.data || {};

  if (session?.mode === "support") {
    return {
      project: "construction",
      result: {
        reply: buildSupportReply(lang, projectConfig, text),
        nextStep: "done",
        mode: "support",
        language: lang,
        data: currentData,
      },
    };
  }

  if (isAngry(text)) {
    return {
      project: "construction",
      result: {
        reply: getDeEscalationReply(lang),
        nextStep: session?.step || "qualification",
        mode: session?.mode || "scenario",
        language: lang,
        data: currentData,
      },
    };
  }

  if (isMuslimGreeting(text) && !containsUsefulConstructionData(text)) {
    return {
      project: "construction",
      result: {
        reply: getSellerGreetingReply(lang, true),
        nextStep: session?.step === "start" ? "qualification" : session?.step || "qualification",
        mode: session?.mode || "scenario",
        language: lang,
        data: currentData,
      },
    };
  }

  if (isGreeting(text) && !containsUsefulConstructionData(text)) {
    return {
      project: "construction",
      result: {
        reply: getSellerGreetingReply(lang, false),
        nextStep: session?.step === "start" ? "qualification" : session?.step || "qualification",
        mode: session?.mode || "scenario",
        language: lang,
        data: currentData,
      },
    };
  }

  if (!session?.language) {
    const detected = detectLanguage(text, projectConfig);

    if (!detected) {
      return {
        project: "construction",
        result: {
          reply: projectConfig.welcome.mixed,
          nextStep: "language_select",
          mode: "scenario",
          language: null,
          data: currentData,
        },
      };
    }

    return {
      project: "construction",
      result: {
        reply: projectConfig.welcome[detected],
        nextStep: "qualification",
        mode: "scenario",
        language: detected,
        data: currentData,
      },
    };
  }

  const prompts = projectConfig.prompts[lang] || projectConfig.prompts.ru;

  if (session?.step === "qualification" || session?.step === "language_select") {
    const intent = detectIntent(t, projectConfig);
    const nextData = { ...currentData };
    if (intent) nextData.intent = intent;

    return {
      project: "construction",
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
      project: "construction",
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
      project: "construction",
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
      project: "construction",
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
      project: "construction",
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
      project: "construction",
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
        project: "construction",
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
      project: "construction",
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
    project: "construction",
    result: {
      reply: projectConfig.welcome[lang],
      nextStep: "qualification",
      mode: "scenario",
      language: lang,
      data: currentData,
    },
  };
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

  const language = session?.language || detectLanguage(text, projectConfig);
  const lang = language || "ru";

  if (projectKey === "clinic") {
    return routeClinicMessage({
      text,
      session,
      projectConfig,
      lang,
    });
  }

  return routeConstructionMessage({
    text,
    session,
    projectConfig,
    lang,
  });
}

module.exports = {
  routeMessage,
};
