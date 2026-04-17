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

function isClinicAdStarter(text = "") {
  const t = normalizeText(text);

  return (
    t.includes("можно узнать об этом подробнее") ||
    t.includes("можно узнать подробнее") ||
    t.includes("расскажите подробнее") ||
    t.includes("хочу узнать подробнее") ||
    t === "подробнее"
  );
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
    январ: 0,
    февраля: 1,
    феврал: 1,
    марта: 2,
    март: 2,
    апреля: 3,
    апрел: 3,
    мая: 4,
    май: 4,
    июня: 5,
    июн: 5,
    июля: 6,
    июл: 6,
    августа: 7,
    август: 7,
    сентября: 8,
    сентябр: 8,
    октября: 9,
    октябр: 9,
    ноября: 10,
    ноябр: 10,
    декабря: 11,
    декабр: 11,
    қаңтар: 0,
    ақпан: 1,
    наурыз: 2,
    сәуір: 3,
    мамыр: 4,
    маусым: 5,
    шілде: 6,
    тамыз: 7,
    қыркүйек: 8,
    қазан: 9,
    қараша: 10,
    желтоқсан: 11,
  };

  for (const [key, value] of Object.entries(months)) {
    if (t.includes(key)) return value;
  }

  return null;
}

function formatDateForUser(date, lang = "ru") {
  const d = new Date(date);
  const monthsRu = [
    "января",
    "февраля",
    "марта",
    "апреля",
    "мая",
    "июня",
    "июля",
    "августа",
    "сентября",
    "октября",
    "ноября",
    "декабря",
  ];
  const monthsKz = [
    "қаңтар",
    "ақпан",
    "наурыз",
    "сәуір",
    "мамыр",
    "маусым",
    "шілде",
    "тамыз",
    "қыркүйек",
    "қазан",
    "қараша",
    "желтоқсан",
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
    понедельник: 1,
    вторник: 2,
    среда: 3,
    четверг: 4,
    пятница: 5,
    суббота: 6,
    воскресенье: 0,
  };

  const weekdaysKz = {
    дүйсенбі: 1,
    сейсенбі: 2,
    сәрсенбі: 3,
    бейсенбі: 4,
    жұма: 5,
    сенбі: 6,
    жексенбі: 0,
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

  return { ok: false };
}

function normalizeHourMinute(hour, minute = 0) {
  const hh = Math.max(0, Math.min(23, Number(hour)));
  const mm = Math.max(0, Math.min(59, Number(minute)));
  return {
    value: `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`,
    hour: hh,
    minute: mm,
    ok: true,
  };
}

function parseAfterTime(text) {
  const t = normalizeText(text);
  const match = t.match(/(?:после|кейін|кейин)\s*([0-2]?\d)\b/);
  if (!match) return { ok: false };

  const hh = Number(match[1]);
  if (hh > 23) return { ok: false };

  const suggested = hh < 20 ? hh + 1 : hh;
  return normalizeHourMinute(suggested, 0);
}

function parsePartOfDayTime(text) {
  const t = normalizeText(text);
  const match = t.match(/\b([0-2]?\d)\b/);
  if (!match) return { ok: false };

  let hour = Number(match[1]);
  if (hour > 23) return { ok: false };

  if (t.includes("утра") || t.includes("таң")) {
    if (hour === 12) hour = 0;
    return normalizeHourMinute(hour, 0);
  }

  if (t.includes("дня") || t.includes("күндіз")) {
    if (hour >= 1 && hour <= 8) hour += 12;
    return normalizeHourMinute(hour, 0);
  }

  if (t.includes("вечера") || t.includes("кешке") || t.includes("кеш")) {
    if (hour >= 1 && hour <= 11) hour += 12;
    return normalizeHourMinute(hour, 0);
  }

  if (t.includes("ночи") || t.includes("түнде")) {
    if (hour === 12) hour = 0;
    return normalizeHourMinute(hour, 0);
  }

  return { ok: false };
}

function parseRangeLikeTime(text) {
  const t = normalizeText(text);
  const match = t.match(/\b(?:с|сағат|в)?\s*([0-2]?\d)\s*(?:до|-|—)\s*([0-2]?\d)\b/);
  if (!match) return { ok: false };

  const fromHour = Number(match[1]);
  if (fromHour > 23) return { ok: false };

  return normalizeHourMinute(fromHour, 0);
}

function parseLooseHour(text) {
  const t = normalizeText(text);

  const direct = t.match(/\b([0-2]?\d)\b/);
  if (!direct) return { ok: false };

  const hour = Number(direct[1]);
  if (hour > 23) return { ok: false };

  if (
    t.includes("в ") ||
    t.includes("сағат") ||
    t.includes("час") ||
    t.includes("к ") ||
    t.includes("около") ||
    t.includes("примерно")
  ) {
    return normalizeHourMinute(hour, 0);
  }

  return { ok: false };
}

function parseSmartDateTime(text, lang = "ru") {
  const date = parseVisitDate(text, lang);

  let time = parseVisitTime(text);
  if (!time.ok) time = parseAfterTime(text);
  if (!time.ok) time = parsePartOfDayTime(text);
  if (!time.ok) time = parseRangeLikeTime(text);
  if (!time.ok) time = parseLooseHour(text);

  return {
    hasDate: date.ok,
    hasTime: time.ok,
    date,
    time,
  };
}

function isWithinClinicHours(parsedTime) {
  if (!parsedTime?.ok) return false;

  const total = parsedTime.hour * 60 + parsedTime.minute;
  const start = 9 * 60;
  const end = 20 * 60;

  return total >= start && total <= end;
}

function getNearestClinicTimeOptions(baseHour = 12) {
  const options = [];
  const allowed = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

  const sorted = allowed
    .map((h) => ({ h, diff: Math.abs(h - baseHour) }))
    .sort((a, b) => a.diff - b.diff)
    .slice(0, 3)
    .map((x) => `${String(x.h).padStart(2, "0")}:00`);

  for (const item of sorted) {
    if (!options.includes(item)) options.push(item);
  }

  return options;
}

function getClinicAlternativeTimeReply(lang = "ru", parsedTime = null) {
  const baseHour = parsedTime?.hour ?? 12;
  const options = getNearestClinicTimeOptions(baseHour);

  if (lang === "kz") {
    return (
      `Клиника 09:00-ден 20:00-ге дейін жұмыс істейді 🌿\n\n` +
      `Мына уақыттардың бірін таңдауға болады:\n` +
      `${options.map((x) => `• ${x}`).join("\n")}`
    );
  }

  return (
    `Клиника работает с 09:00 до 20:00 🌿\n\n` +
    `Можно выбрать одно из ближайших удобных времен:\n` +
    `${options.map((x) => `• ${x}`).join("\n")}`
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
  if (t.length < 6) return false;

  const hardScenarioSignals = ["без фото", "фото жоқ", "да", "нет", "иә", "жоқ"];
  if (hardScenarioSignals.includes(t)) return false;

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
    "мастер класс",
    "мастер-класс",
    "хочу узнать",
    "расскажите",
    "подскажите подробнее",
    "это правда",
    "есть ли гарантия",
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
      ask_service: "Чтобы двинуться дальше, напишите, пожалуйста, какая процедура вас интересует.",
      ask_photo: "Если удобно, отправьте фото зоны или просто напишите: Без фото.",
      ask_day: "Напишите, пожалуйста, удобный день для консультации. Например: завтра, понедельник, 19 апреля.",
      ask_time: "И напишите удобное время. Например: 12:00 или завтра в 15:00.",
      ask_name_age: "И напишите, пожалуйста, как к вам обращаться и ваш возраст.",
      training_name: "И напишите, пожалуйста, как к вам обращаться.",
      training_phone: "И напишите, пожалуйста, номер телефона для связи.",
    },
    kz: {
      ask_service: "Әрі қарай жалғастыру үшін қай процедура қызықтыратынын жазыңыз.",
      ask_photo: "Ыңғайлы болса, фото жіберіңіз немесе: Фото жоқ деп жазыңыз.",
      ask_day: "Консультацияға ыңғайлы күніңізді жазыңыз. Мысалы: ертең, дүйсенбі, 19 сәуір.",
      ask_time: "Және ыңғайлы уақытыңызды жазыңыз. Мысалы: 12:00 немесе ертең 15:00.",
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
          "Ты Алия, сильный и живой ассистент премиальной клиники Dr.Aitimbetova. " +
          "Стиль: спокойный, уверенный, заботливый, без воды, без робота. " +
          "Отвечай коротко, по сути, максимум 2-4 абзаца. " +
          "Не ставь диагноз. " +
          "Не обещай медицинский результат. " +
          "Не называй точную цену без консультации и оценки зоны. " +
          "Если вопрос про обучение, скажи, что администратор свяжется для уточнения программы, формата, стоимости и ближайших дат. " +
          "Если вопрос про процедуру, сначала коротко ответь по сути, потом мягко верни человека к следующему шагу записи. " +
          "Если человек спрашивает адрес, локацию, как добраться или Instagram — отвечай уверенно и коротко. " +
          "Не пиши как автоответчик. Не используй сухие формулировки вроде 'заявка принята'.",
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
  const t = normalizeText(text);
  const mapUrl = process.env.CLINIC_2GIS_URL || "https://2gis.kz/";
  const instagramUrl = process.env.CLINIC_INSTAGRAM_URL || "https://www.instagram.com/";

  if (
    t.includes("где вы") ||
    t.includes("где находитесь") ||
    t.includes("адрес") ||
    t.includes("локация") ||
    t.includes("как добраться") ||
    t.includes("где именно") ||
    t.includes("қайда") ||
    t.includes("мекенжай")
  ) {
    const reply =
      lang === "kz"
        ? `Біз Астанада орналасқанбыз 🌿\n\nМіне, нақты локация:\n${mapUrl}\n\nҚаласаңыз, ыңғайлы күн мен уақытты бірден қарайық 🙂`
        : `Мы находимся в Астане 🌿\n\nВот наша точная локация:\n${mapUrl}\n\nЕсли хотите, можем сразу подобрать вам удобный день и время 🙂`;

    return {
      project: "clinic",
      result: {
        reply,
        nextStep: session?.step || "ask_city",
        mode: session?.mode || "scenario",
        language: lang,
        data: currentData,
      },
    };
  }

  if (
    t.includes("инстаграм") ||
    t.includes("instagram") ||
    t.includes("работы") ||
    t.includes("кейсы") ||
    t.includes("примеры")
  ) {
    const reply =
      lang === "kz"
        ? `Әрине 🌿\n\nМіне біздің Instagram:\n${instagramUrl}\n\nҚаласаңыз, осы жерден-ақ процедура бойынша бағыт беріп, консультацияға жазып қоямын 🙂`
        : `Конечно 🌿\n\nВот наш Instagram:\n${instagramUrl}\n\nЕсли хотите, я здесь же подскажу по процедуре и помогу записаться на консультацию 🙂`;

    return {
      project: "clinic",
      result: {
        reply,
        nextStep: session?.step || "ask_city",
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
    const smart = parseSmartDateTime(text, lang);

    if (!smart.hasDate) {
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

    if (smart.hasTime) {
      if (!isWithinClinicHours(smart.time)) {
        return {
          project: "clinic",
          result: {
            reply: getClinicAlternativeTimeReply(lang, smart.time),
            nextStep: "ask_time",
            mode: "scenario",
            language: lang,
            data: {
              ...currentData,
              visitDay: smart.date.value,
              visitDateIso: smart.date.iso,
              timing: smart.date.value,
            },
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
            visitDay: smart.date.value,
            visitDateIso: smart.date.iso,
            timing: smart.date.value,
            visitTime: smart.time.value,
            preferredTime: smart.time.value,
          },
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
          visitDay: smart.date.value,
          visitDateIso: smart.date.iso,
          timing: smart.date.value,
        },
      },
    };
  }

  if (session?.step === "ask_time") {
    const smart = parseSmartDateTime(text, lang);
    const parsedTime = smart.hasTime ? smart.time : { ok: false };

    if (smart.hasDate && !currentData.visitDay) {
      if (!parsedTime.ok) {
        return {
          project: "clinic",
          result: {
            reply:
              lang === "kz"
                ? "Уақытты да жазыңызшы 🌿\nМысалы: 12:00"
                : "Напишите ещё и время 🌿\nНапример: 12:00",
            nextStep: "ask_time",
            mode: "scenario",
            language: lang,
            data: {
              ...currentData,
              visitDay: smart.date.value,
              visitDateIso: smart.date.iso,
              timing: smart.date.value,
            },
          },
        };
      }

      if (!isWithinClinicHours(parsedTime)) {
        return {
          project: "clinic",
          result: {
            reply: getClinicAlternativeTimeReply(lang, parsedTime),
            nextStep: "ask_time",
            mode: "scenario",
            language: lang,
            data: {
              ...currentData,
              visitDay: smart.date.value,
              visitDateIso: smart.date.iso,
              timing: smart.date.value,
            },
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
            visitDay: smart.date.value,
            visitDateIso: smart.date.iso,
            timing: smart.date.value,
            visitTime: parsedTime.value,
            preferredTime: parsedTime.value,
          },
        },
      };
    }

    if (!parsedTime.ok) {
      return {
        project: "clinic",
        result: {
          reply:
            lang === "kz"
              ? "Уақытты ыңғайлы форматта жазыңызшы 🌿\nМысалы: 12:00, 15:30, кешкі 6"
              : "Напишите, пожалуйста, время в удобном формате 🌿\nНапример: 12:00, 15:30, вечером в 6",
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
          reply: getClinicAlternativeTimeReply(lang, parsedTime),
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
        ? `Рақмет 🌿\n\nСізді алдын ала консультацияға жаздым:\n• Қала: ${city}\n• Процедура: ${service}\n• Күні: ${day}\n• Уақыты: ${time}\n\nМіне біздің локация:\n${mapUrl}\n\nАдминистратор жақын арада растау үшін хабарласады.`
        : `Спасибо 🌿\n\nПредварительно записала вас на консультацию:\n• Город: ${city}\n• Услуга: ${service}\n• Дата: ${day}\n• Время: ${time}\n\nВот наша локация:\n${mapUrl}\n\nАдминистратор свяжется с вами в ближайшее время для подтверждения записи.`;

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
