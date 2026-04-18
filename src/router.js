const projects = require("./config/projects.config");
const { getAIReply } = require("./services/ai.service");

/* =========================
   BASIC HELPERS
========================= */

function normalizeText(text = "") {
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[ʼ'`]/g, "")
    .replace(/\s+/g, " ");
}

function cleanGreetingText(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/[^a-zа-яёәіңғүұқөһі0-9\s./,:-]/gi, " ")
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

function extractName(text) {
  const cleaned = String(text || "")
    .replace(/[^\p{L}\s-]/gu, " ")
    .trim()
    .replace(/\s+/g, " ");

  if (!cleaned) return "";
  const parts = cleaned.split(" ");
  return parts.slice(0, 2).join(" ");
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

function hasQuestionMark(text = "") {
  return String(text).includes("?");
}

/* =========================
   SHARED QUICK REPLIES
========================= */

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

/* =========================
   CONSTRUCTION HELPERS
========================= */

function getConstructionOfficialGreeting(lang = "ru", islamic = false) {
  if (lang === "kz") {
    if (islamic) {
      return (
        "Уағалейкум ассалам 🤝\n\n" +
        "Adil Qurulus компаниясы байланыста.\n" +
        "Астана және жақын аймақтар бойынша үй, коттедж және фундамент құрылысына қатысты нақты бағыт береміз.\n\n" +
        "Қысқаша жазыңыз: не керек, қай жерде, шамамен қандай көлем — бірден нақтылап жауап беремін."
      );
    }

    return (
      "Сәлеметсіз бе 👋\n\n" +
      "Adil Qurulus компаниясы байланыста.\n" +
      "Астана және жақын аймақтар бойынша үй, коттедж және фундамент құрылысы бойынша нақты бағыт береміз.\n\n" +
      "Қысқаша жазыңыз: не керек, қай жерде, шамамен қандай көлем — бірден нақтылап жауап беремін."
    );
  }

  if (islamic) {
    return (
      "Ва алейкум ассалам 🤝\n\n" +
      "Компания Adil Qurulus на связи.\n" +
      "Мы консультируем по строительству домов, коттеджей и фундаментным работам в Астане и ближайших пригородах.\n\n" +
      "Напишите коротко: что нужно, где участок и какой примерно объём — я сразу сориентирую."
    );
  }

  return (
    "Здравствуйте 👋\n\n" +
    "Компания Adil Qurulus на связи.\n" +
    "Консультируем по строительству домов, коттеджей и фундаментным работам в Астане и ближайших пригородах.\n\n" +
    "Напишите коротко: что нужно, где участок и какой примерно объём — я сразу сориентирую."
  );
}

function getDeEscalationReply(lang = "ru") {
  if (lang === "kz") {
    return (
      "Түсіндім, артық айналдырмаймын 🙏\n\n" +
      "Қысқаша жазыңыз:\n" +
      "1) не салу керек\n" +
      "2) қай жерде\n" +
      "3) шамамен көлемі\n\n" +
      "Сосын бірден нақты жауап берем."
    );
  }

  return (
    "Понял вас, без лишних кругов 🙏\n\n" +
    "Напишите коротко:\n" +
    "1) что нужно построить\n" +
    "2) где участок\n" +
    "3) примерный размер\n\n" +
    "И я сразу дам конкретику."
  );
}

function containsUsefulConstructionData(text) {
  const t = normalizeText(text);

  return (
    /\d/.test(t) ||
    t.includes("фундамент") ||
    t.includes("дом") ||
    t.includes("коттедж") ||
    t.includes("баня") ||
    t.includes("участок") ||
    t.includes("соток") ||
    t.includes("үй") ||
    t.includes("жер") ||
    t.includes("плита") ||
    t.includes("лента") ||
    t.includes("сваи") ||
    t.includes("размер") ||
    t.includes("размеры") ||
    t.includes("материал") ||
    t.includes("газоблок") ||
    t.includes("кирпич") ||
    t.includes("бетон") ||
    t.includes("астана") ||
    t.includes("косшы")
  );
}

function parseConstructionInfo(text = "", currentData = {}) {
  const t = normalizeText(text);
  const data = { ...currentData };

  if (!data.intent) {
    if (
      t.includes("дом") ||
      t.includes("үй")
    ) data.intent = "house";

    if (
      t.includes("коттедж")
    ) data.intent = "cottage";

    if (
      t.includes("фундамент") ||
      t.includes("лента") ||
      t.includes("сваи") ||
      t.includes("плита")
    ) data.intent = "foundation";

    if (
      t.includes("консультация") ||
      t.includes("кеңес")
    ) data.intent = "consultation";
  }

  const areaMatch =
    t.match(/\b(\d{2,4})\s*(?:кв\.?\s*м|кв м|м2|м²)\b/i) ||
    t.match(/\b(\d{2,4})\s*(?:квадрат|квадратов)\b/i);

  if (areaMatch && !data.size) {
    data.size = `${areaMatch[1]} м²`;
  }

  const areaRangeMatch = t.match(/\b(\d{2,4})\s*[-–—]\s*(\d{2,4})\s*(?:кв\.?\s*м|кв м|м2|м²)?\b/i);
  if (areaRangeMatch && !data.size) {
    data.size = `${areaRangeMatch[1]}-${areaRangeMatch[2]} м²`;
  }

  const sotokMatch = t.match(/\b(\d{1,3})\s*сот(?:ок|ки|ка)?\b/i);
  if (sotokMatch && !data.plot) {
    data.plot = `${sotokMatch[1]} соток`;
  }

  const startSignals = [
    "в этом году",
    "весной",
    "летом",
    "осенью",
    "зимой",
    "сейчас",
    "скоро",
    "ближайшее время",
    "в следующем месяце",
    "после",
    "через",
  ];
  if (!data.timing && startSignals.some((x) => t.includes(x))) {
    data.timing = text;
  }

  const locations = [
    "астана",
    "косшы",
    "ильинка",
    "талапкер",
    "карагайлы",
    "караоткель",
    "участок",
    "левый берег",
    "правый берег",
  ];
  if (!data.location && locations.some((x) => t.includes(x))) {
    data.location = text;
  }

  if (!data.projectDetails && text.length > 3) {
    data.projectDetails = text;
  }

  return data;
}

function countConstructionSignals(data = {}) {
  let score = 0;
  if (data.intent) score += 1;
  if (data.size) score += 1;
  if (data.plot) score += 1;
  if (data.location) score += 1;
  if (data.timing) score += 1;
  return score;
}

function shouldUseConstructionAI(text, session = {}) {
  const t = normalizeText(text);
  const step = session?.step || "start";

  if (looksLikePhone(text)) return false;
  if (["language_select", "start", "ask_phone", "completed", "done"].includes(step)) return false;

  const aiSignals = [
    "ты бот",
    "это бот",
    "сколько стоит",
    "цена",
    "стоимость",
    "примерно сколько",
    "без проекта можно",
    "если проекта нет",
    "какой фундамент лучше",
    "какой материал лучше",
    "срок строительства",
    "какие районы",
    "работаете ли",
    "почему так",
    "в чем разница",
    "как лучше",
    "есть ли гарантия",
    "можно ли в рассрочку",
    "қалай",
    "бағасы",
    "қанша",
  ];

  return aiSignals.some((w) => t.includes(w));
}

async function tryConstructionAIReply({ text, session, lang }) {
  try {
    const aiReply = await getAIReply({
      project: "construction",
      message: text,
      session: {
        ...session,
        language: lang,
        aiInstructions:
          "Ты сильный и деловой менеджер крупной строительной компании Adil Qurulus. " +
          "Главная цель — не болтать, а вести клиента к заявке. " +
          "Отвечай коротко, по делу, уверенно, максимум 2-3 коротких абзаца. " +
          "Не дублируй приветствия. " +
          "После ответа мягко, но уверенно переводи клиента к следующему шагу: локация, площадь, имя, телефон. " +
          "Если клиент уже тёплый, не растягивай диалог — подводи к контакту. " +
          "Не пиши как бот и не уходи в длинные объяснения.",
      },
    });

    return aiReply || "";
  } catch (error) {
    console.error("❌ construction AI error:", error.message);
    return "";
  }
}

/* =========================
   CLINIC HELPERS
========================= */

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
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
  ];
  const monthsKz = [
    "қаңтар", "ақпан", "наурыз", "сәуір", "мамыр", "маусым",
    "шілде", "тамыз", "қыркүйек", "қазан", "қараша", "желтоқсан",
  ];

  if (lang === "kz") return `${d.getDate()} ${monthsKz[d.getMonth()]}`;
  return `${d.getDate()} ${monthsRu[d.getMonth()]}`;
}

function parseVisitDate(text, lang = "ru") {
  const t = normalizeText(text);
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  if (t.includes("сегодня") || t.includes("бүгін")) {
    return { ok: true, value: formatDateForUser(now, lang), iso: now.toISOString().slice(0, 10) };
  }

  if (t.includes("завтра") || t.includes("ертең")) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return { ok: true, value: formatDateForUser(d, lang), iso: d.toISOString().slice(0, 10) };
  }

  if (t.includes("послезавтра")) {
    const d = new Date(now);
    d.setDate(d.getDate() + 2);
    return { ok: true, value: formatDateForUser(d, lang), iso: d.toISOString().slice(0, 10) };
  }

  const weekdaysRu = {
    понедельник: 1, вторник: 2, среда: 3, четверг: 4,
    пятница: 5, суббота: 6, воскресенье: 0,
  };

  const weekdaysKz = {
    дүйсенбі: 1, сейсенбі: 2, сәрсенбі: 3, бейсенбі: 4,
    жұма: 5, сенбі: 6, жексенбі: 0,
  };

  for (const [dayText, weekday] of Object.entries({ ...weekdaysRu, ...weekdaysKz })) {
    if (t.includes(dayText)) {
      const d = new Date(now);
      let diff = (weekday - d.getDay() + 7) % 7;
      if (diff === 0) diff = 7;
      d.setDate(d.getDate() + diff);

      return { ok: true, value: formatDateForUser(d, lang), iso: d.toISOString().slice(0, 10) };
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
      return { ok: true, value: formatDateForUser(d, lang), iso: d.toISOString().slice(0, 10) };
    }
  }

  const dayOnly = t.match(/\b([0-2]?\d|3[01])\b/);
  const monthByWord = monthNumberByWord(t);
  if (dayOnly && monthByWord !== null) {
    let year = now.getFullYear();
    const d = new Date(year, monthByWord, Number(dayOnly[1]));
    if (d < now) d.setFullYear(year + 1);

    return { ok: true, value: formatDateForUser(d, lang), iso: d.toISOString().slice(0, 10) };
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
  if (hourOnly && (t.includes("в ") || t.includes("час") || t.includes("сағат") || t.includes("около") || t.includes("примерно"))) {
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

function parseSmartDateTime(text, lang = "ru") {
  const date = parseVisitDate(text, lang);
  const time = parseVisitTime(text);

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
  const allowed = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
  return allowed
    .map((h) => ({ h, diff: Math.abs(h - baseHour) }))
    .sort((a, b) => a.diff - b.diff)
    .slice(0, 3)
    .map((x) => `${String(x.h).padStart(2, "0")}:00`);
}

function getClinicAlternativeTimeReply(lang = "ru", parsedTime = null) {
  const baseHour = parsedTime?.hour ?? 12;
  const options = getNearestClinicTimeOptions(baseHour);

  if (lang === "kz") {
    return (
      `Клиника 09:00-ден 20:00-ге дейін жұмыс істейді 🌿\n\n` +
      `Мына уақыттардың бірін таңдауға болады:\n${options.map((x) => `• ${x}`).join("\n")}`
    );
  }

  return (
    `Клиника работает с 09:00 до 20:00 🌿\n\n` +
    `Можно выбрать одно из ближайших удобных времен:\n${options.map((x) => `• ${x}`).join("\n")}`
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

  if (["language_select", "start", "ask_phone", "training_phone", "completed", "done"].includes(step)) return false;
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
  ];

  return aiSignals.some((word) => t.includes(word));
}

function getClinicStepReminder(step, lang = "ru") {
  const reminders = {
    ru: {
      ask_service: "Чтобы двинуться дальше, напишите, пожалуйста, какая процедура вас интересует.",
      ask_photo: "Если удобно, отправьте фото зоны или просто напишите: Без фото.",
      ask_day: "Напишите, пожалуйста, удобный день. Например: завтра, понедельник, 19 апреля.",
      ask_time: "И напишите удобное время. Например: 12:00.",
      ask_name_age: "И напишите, пожалуйста, как к вам обращаться и ваш возраст.",
      training_name: "И напишите, пожалуйста, как к вам обращаться.",
      training_phone: "И напишите, пожалуйста, номер телефона для связи.",
    },
    kz: {
      ask_service: "Әрі қарай жалғастыру үшін қай процедура қызықтыратынын жазыңыз.",
      ask_photo: "Ыңғайлы болса, фото жіберіңіз немесе: Фото жоқ деп жазыңыз.",
      ask_day: "Ыңғайлы күніңізді жазыңыз. Мысалы: ертең, дүйсенбі, 19 сәуір.",
      ask_time: "Және ыңғайлы уақытыңызды жазыңыз. Мысалы: 12:00.",
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
          "Главная цель — быстро привести клиента к записи или заявке на обучение. " +
          "Отвечай коротко, уверенно, тепло, без воды, максимум 2-3 коротких абзаца. " +
          "Не ставь диагноз. Не обещай медицинский результат. " +
          "Если вопрос по обучению — дай короткий ответ и переведи к имени/телефону. " +
          "Если вопрос по процедуре — коротко ответь по сути и мягко верни к следующему шагу записи. " +
          "Не пиши как автоответчик.",
      },
    });

    return aiReply || "";
  } catch (error) {
    console.error("❌ clinic AI error:", error.message);
    return "";
  }
}

function parseClinicInfo(text = "", currentData = {}, lang = "ru") {
  const t = normalizeText(text);
  const data = { ...currentData };

  if (!data.city) {
    const cityHints = [
      "астана",
      "алматы",
      "караганда",
      "қарағанды",
      "шымкент",
      "актау",
      "атырау",
      "павлодар",
      "семей",
      "костанай",
      "қостанай",
      "кокшетау",
      "өкемен",
      "усть-каменогорск",
    ];
    if (cityHints.some((c) => t.includes(c)) || t.includes("из города") || t.includes("с города") || t.includes("қаладан")) {
      data.city = text;
      data.location = text;
    }
  }

  if (!data.service) {
    if (t.includes("волос") || t.includes("шаш")) data.service = "Пересадка волос";
    if (t.includes("бород") || t.includes("сақал")) data.service = "Пересадка бороды";
    if (t.includes("бров") || t.includes("қас")) data.service = "Пересадка бровей";
    if (t.includes("ресниц") || t.includes("кірпік")) data.service = "Пересадка ресниц";
    if (t.includes("консультац") || t.includes("кеңес")) data.service = "Консультация";
    if (isTrainingIntent(text, data)) data.service = "Обучение";
  }

  if (!data.intent && isTrainingIntent(text, data)) {
    data.intent = "training";
  }

  const smart = parseSmartDateTime(text, lang);
  if (!data.visitDay && smart.hasDate) {
    data.visitDay = smart.date.value;
    data.visitDateIso = smart.date.iso;
  }
  if (!data.visitTime && smart.hasTime) {
    data.visitTime = smart.time.value;
    data.preferredTime = smart.time.value;
  }

  if (!data.name && /\p{L}{2,}/u.test(text) && !hasQuestionMark(text) && text.length <= 40 && !looksLikePhone(text)) {
    const maybeName = extractName(text);
    if (maybeName && maybeName.length >= 2 && !isGreeting(text)) {
      data.name = maybeName;
    }
  }

  return data;
}

function countClinicSignals(data = {}) {
  let score = 0;
  if (data.city) score += 1;
  if (data.service) score += 1;
  if (data.visitDay) score += 1;
  if (data.visitTime) score += 1;
  if (data.name) score += 1;
  return score;
}

/* =========================
   CLINIC ROUTER
========================= */

async function routeClinicMessage({ text, session, projectConfig, lang }) {
  const prompts = projectConfig.prompts[lang] || projectConfig.prompts.ru;
  const currentData = parseClinicInfo(text, session?.data || {}, lang);
  const t = normalizeText(text);
  const mapUrl = process.env.CLINIC_2GIS_URL || "https://2gis.kz/";
  const instagramUrl = process.env.CLINIC_INSTAGRAM_URL || "https://www.instagram.com/";

  if (isClinicAdStarter(text) && !session?.language) {
    return {
      project: "clinic",
      result: {
        reply:
          "Здравствуйте 🌸\n\n" +
          "Я Алия, ассистент клиники Dr.Aitimbetova.\n" +
          "Коротко подскажу по процедуре и помогу записаться на консультацию.\n\n" +
          "Подскажите, пожалуйста, из какого вы города?",
        nextStep: "ask_city",
        mode: "scenario",
        language: "ru",
        data: currentData,
      },
    };
  }

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
    return {
      project: "clinic",
      result: {
        reply:
          lang === "kz"
            ? `Біз Астанада орналасқанбыз 🌿\n\nМіне нақты локация:\n${mapUrl}\n\nҚаласаңыз, ыңғайлы күн мен уақытты бірден қарайық.`
            : `Мы находимся в Астане 🌿\n\nВот наша точная локация:\n${mapUrl}\n\nЕсли хотите, можем сразу подобрать удобный день и время.`,
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
    return {
      project: "clinic",
      result: {
        reply:
          lang === "kz"
            ? `Әрине 🌿\n\nМіне біздің Instagram:\n${instagramUrl}\n\nҚаласаңыз, осы жерден-ақ консультацияға жазып қоямын.`
            : `Конечно 🌿\n\nВот наш Instagram:\n${instagramUrl}\n\nЕсли хотите, здесь же помогу записаться на консультацию.`,
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
    const aiReply = await tryClinicAIReply({ text, session, lang });
    if (aiReply) {
      return {
        project: "clinic",
        result: {
          reply: `${aiReply}\n\n${getClinicStepReminder(session?.step, lang)}`,
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
    if (currentData.city) {
      return {
        project: "clinic",
        result: {
          reply: prompts.askLocation,
          nextStep: "ask_service",
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
            ? "Қай қаладансыз?"
            : "Подскажите, пожалуйста, из какого вы города?",
        nextStep: "ask_city",
        mode: "scenario",
        language: lang,
        data: currentData,
      },
    };
  }

  if (session?.step === "ask_service") {
    const intent = detectIntent(text, projectConfig) || currentData.intent;
    const training = isTrainingIntent(text, { ...currentData, intent });
    const data = { ...currentData, intent };

    if (data.service && training) {
      return {
        project: "clinic",
        result: {
          reply:
            lang === "kz"
              ? "Түсіндім 🌿\n\nОқу бойынша сұранысыңызды қабылдадым.\nӨзіңізді қалай атаймыз?"
              : "Поняла 🌿\n\nПриняла ваш запрос по обучению.\nПодскажите, пожалуйста, как я могу к вам обращаться?",
          nextStep: "training_name",
          mode: "scenario",
          language: lang,
          data: {
            ...data,
            leadType: "training",
          },
        },
      };
    }

    if (data.service) {
      return {
        project: "clinic",
        result: {
          reply: prompts.askSize,
          nextStep: "ask_photo",
          mode: "scenario",
          language: lang,
          data,
        },
      };
    }

    return {
      project: "clinic",
      result: {
        reply: prompts.askLocation,
        nextStep: "ask_service",
        mode: "scenario",
        language: lang,
        data,
      },
    };
  }

  if (session?.step === "training_name") {
    const data = {
      ...currentData,
      name: currentData.name || extractName(text) || text,
    };

    return {
      project: "clinic",
      result: {
        reply:
          lang === "kz"
            ? "Рақмет 🌸\n\nЕнді телефон нөміріңізді жазыңызшы. Администратор оқу бойынша хабарласады."
            : "Спасибо 🌸\n\nТеперь напишите, пожалуйста, ваш номер телефона. Администратор свяжется с вами по обучению.",
        nextStep: "training_phone",
        mode: "scenario",
        language: lang,
        data,
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
    const data = {
      ...currentData,
      photoStatus: text,
      size: text,
    };

    if (data.visitDay && data.visitTime) {
      return {
        project: "clinic",
        result: {
          reply: prompts.askProject,
          nextStep: "ask_name_age",
          mode: "scenario",
          language: lang,
          data,
        },
      };
    }

    return {
      project: "clinic",
      result: {
        reply: prompts.askTiming,
        nextStep: "ask_day",
        mode: "scenario",
        language: lang,
        data,
      },
    };
  }

  if (session?.step === "ask_day") {
    const smart = parseSmartDateTime(text, lang);
    const data = { ...currentData };

    if (smart.hasDate) {
      data.visitDay = smart.date.value;
      data.visitDateIso = smart.date.iso;
      data.timing = smart.date.value;
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
            data,
          },
        };
      }

      data.visitTime = smart.time.value;
      data.preferredTime = smart.time.value;
    }

    if (data.visitDay && data.visitTime) {
      return {
        project: "clinic",
        result: {
          reply: prompts.askProject,
          nextStep: "ask_name_age",
          mode: "scenario",
          language: lang,
          data,
        },
      };
    }

    if (!data.visitDay) {
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
          data,
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
        data,
      },
    };
  }

  if (session?.step === "ask_time") {
    const smart = parseSmartDateTime(text, lang);
    const data = { ...currentData };

    if (smart.hasDate && !data.visitDay) {
      data.visitDay = smart.date.value;
      data.visitDateIso = smart.date.iso;
      data.timing = smart.date.value;
    }

    if (!smart.hasTime) {
      return {
        project: "clinic",
        result: {
          reply:
            lang === "kz"
              ? "Уақытты ыңғайлы форматта жазыңызшы 🌿\nМысалы: 12:00 немесе 15:30"
              : "Напишите, пожалуйста, время в удобном формате 🌿\nНапример: 12:00 или 15:30",
          nextStep: "ask_time",
          mode: "scenario",
          language: lang,
          data,
        },
      };
    }

    if (!isWithinClinicHours(smart.time)) {
      return {
        project: "clinic",
        result: {
          reply: getClinicAlternativeTimeReply(lang, smart.time),
          nextStep: "ask_time",
          mode: "scenario",
          language: lang,
          data,
        },
      };
    }

    data.visitTime = smart.time.value;
    data.preferredTime = smart.time.value;

    return {
      project: "clinic",
      result: {
        reply: prompts.askProject,
        nextStep: "ask_name_age",
        mode: "scenario",
        language: lang,
        data,
      },
    };
  }

  if (session?.step === "ask_name_age") {
    const data = {
      ...currentData,
      name: text,
    };

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
        data,
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

    const data = {
      ...currentData,
      phone: text,
      leadType: currentData.intent === "training" ? "training" : "consultation",
    };

    const day = data.visitDay || "Не указано";
    const time = data.visitTime || data.preferredTime || "Не указано";
    const city = data.city || data.location || "Не указано";
    const service = data.service || data.projectDetails || "Не указано";

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
        data,
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

/* =========================
   CONSTRUCTION ROUTER
========================= */

async function routeConstructionMessage({ text, session, projectConfig, lang }) {
  const t = normalizeText(text);
  const currentData = parseConstructionInfo(text, session?.data || {});
  const prompts = projectConfig.prompts[lang] || projectConfig.prompts.ru;
  const signalCount = countConstructionSignals(currentData);

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

  if (
    t.includes("какой район") ||
    t.includes("в каком районе") ||
    t.includes("где вы работаете") ||
    t.includes("какие районы") ||
    t.includes("по какому району") ||
    t.includes("район") ||
    t.includes("астана") ||
    t.includes("косшы") ||
    t.includes("пригород")
  ) {
    return {
      project: "construction",
      result: {
        reply:
          lang === "kz"
            ? "Біз Астана және жақын маңдағы аудандармен жұмыс істейміз 👍\n\nНақты локацияны жазсаңыз, сол жер бойынша бірден нақтылап айтамын."
            : "Мы работаем по Астане и ближайшим пригородам 👍\n\nНапишите точную локацию участка, и я сразу скажу по вашему объекту.",
        nextStep: session?.step || "qualification",
        mode: session?.mode || "scenario",
        language: lang,
        data: currentData,
      },
    };
  }

  if (t.includes("ты бот") || t.includes("это бот")) {
    return {
      project: "construction",
      result: {
        reply:
          lang === "kz"
            ? "Мен компанияның цифрлық ассистентімін.\n\nМақсатым — сұрағыңызды тез қабылдап, менеджерге нақты мәліметпен өткізу."
            : "Я цифровой ассистент компании.\n\nМоя задача — быстро собрать ключевые данные и передать ваш запрос менеджеру без лишней переписки.",
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
        reply: getConstructionOfficialGreeting(lang, true),
        nextStep: session?.step || "qualification",
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
        reply: getConstructionOfficialGreeting(lang, false),
        nextStep: session?.step || "qualification",
        mode: session?.mode || "scenario",
        language: lang,
        data: currentData,
      },
    };
  }

  if (shouldUseConstructionAI(text, session) && signalCount < 3) {
    const aiReply = await tryConstructionAIReply({ text, session, lang });
    if (aiReply) {
      let push = "";
      if (!currentData.location) {
        push =
          lang === "kz"
            ? "\n\nНақты локацияны жазыңыз."
            : "\n\nНапишите точную локацию участка.";
      } else if (!currentData.size && !currentData.plot) {
        push =
          lang === "kz"
            ? "\n\nШамамен көлемін жазыңыз."
            : "\n\nНапишите примерный размер или площадь.";
      } else if (!currentData.name) {
        push =
          lang === "kz"
            ? "\n\nӨзіңізді қалай атаймыз?"
            : "\n\nКак к вам можно обращаться?";
      }

      return {
        project: "construction",
        result: {
          reply: `${aiReply}${push}`,
          nextStep: session?.step || "qualification",
          mode: "scenario",
          language: lang,
          data: currentData,
        },
      };
    }
  }

  if (session?.step === "language_select" || session?.step === "qualification" || session?.step === "start") {
    if (signalCount >= 3) {
      return {
        project: "construction",
        result: {
          reply:
            lang === "kz"
              ? "Жақсы, мәлімет жеткілікті 👍\n\nЕнді өз атыңызды жазыңыз. Кейін менеджер нақты консультация береді."
              : "Хорошо, данных уже достаточно 👍\n\nТеперь подскажите, как к вам можно обращаться. После этого менеджер даст точную консультацию.",
          nextStep: "ask_name",
          mode: "scenario",
          language: lang,
          data: currentData,
        },
      };
    }

    if (currentData.intent && (currentData.location || currentData.size || currentData.plot)) {
      return {
        project: "construction",
        result: {
          reply:
            lang === "kz"
              ? "Түсіндім 👍\n\nЕнді тағы 1-2 нақтылау:\n• учаске қай жерде\n• шамамен көлемі қандай"
              : "Понял 👍\n\nЧтобы сразу сориентировать точнее, уточню ещё 1-2 момента:\n• где находится участок\n• какой примерно объём объекта",
          nextStep: "collect_details",
          mode: "scenario",
          language: lang,
          data: currentData,
        },
      };
    }

    return {
      project: "construction",
      result: {
        reply:
          lang === "kz"
            ? "Жақсы 👌\n\nНе қызықтырады:\n— Үй\n— Коттедж\n— Фундамент\n— Кеңес"
            : "Хорошо 👌\n\nЧто вас интересует:\n— Дом\n— Коттедж\n— Фундамент\n— Консультация",
        nextStep: "ask_project",
        mode: "scenario",
        language: lang,
        data: currentData,
      },
    };
  }

  if (session?.step === "ask_project") {
    const data = parseConstructionInfo(text, currentData);

    if (countConstructionSignals(data) >= 3) {
      return {
        project: "construction",
        result: {
          reply:
            lang === "kz"
              ? "Жақсы, негізгі мәліметті түсіндім 👍\n\nӨзіңізді қалай атаймыз?"
              : "Хорошо, основную картину уже понял 👍\n\nПодскажите, как к вам можно обращаться?",
          nextStep: "ask_name",
          mode: "scenario",
          language: lang,
          data,
        },
      };
    }

    return {
      project: "construction",
      result: {
        reply:
          lang === "kz"
            ? "Түсіндім.\n\nУчаске қай жерде және шамамен қандай көлем керек?"
            : "Понял.\n\nПодскажите, где участок и какой примерно нужен объём?",
        nextStep: "collect_details",
        mode: "scenario",
        language: lang,
        data,
      },
    };
  }

  if (session?.step === "collect_details") {
    const data = parseConstructionInfo(text, currentData);

    if (countConstructionSignals(data) >= 3) {
      return {
        project: "construction",
        result: {
          reply:
            lang === "kz"
              ? "Жақсы 👍\n\nЕнді өз атыңызды жазыңыз. Содан кейін менеджерге өткіземін."
              : "Хорошо 👍\n\nТеперь напишите, как к вам можно обращаться. После этого передам заявку менеджеру.",
          nextStep: "ask_name",
          mode: "scenario",
          language: lang,
          data,
        },
      };
    }

    if (!data.location) {
      return {
        project: "construction",
        result: {
          reply:
            lang === "kz"
              ? "Нақты локацияны жазыңыз."
              : "Напишите, пожалуйста, точную локацию участка.",
          nextStep: "collect_details",
          mode: "scenario",
          language: lang,
          data,
        },
      };
    }

    return {
      project: "construction",
      result: {
        reply:
          lang === "kz"
            ? "Шамамен көлемін жазыңыз. Мысалы: 90-100 м² немесе 10 соток."
            : "Напишите примерный размер. Например: 90-100 м² или участок 10 соток.",
        nextStep: "collect_details",
        mode: "scenario",
        language: lang,
        data,
      },
    };
  }

  if (session?.step === "ask_name") {
    const data = {
      ...currentData,
      name: extractName(text) || text,
    };

    return {
      project: "construction",
      result: {
        reply:
          lang === "kz"
            ? "Жақсы.\n\nТелефон нөміріңізді қалдырыңыз. Менеджер сізбен байланысып, нақты консультация береді."
            : "Хорошо.\n\nОставьте, пожалуйста, номер телефона. Менеджер свяжется с вами и даст точную консультацию.",
        nextStep: "ask_phone",
        mode: "scenario",
        language: lang,
        data,
      },
    };
  }

  if (session?.step === "ask_phone") {
    if (!looksLikePhone(text)) {
      return {
        project: "construction",
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
      reply: projectConfig.welcome[lang] || projectConfig.welcome.ru,
      nextStep: "qualification",
      mode: "scenario",
      language: lang,
      data: currentData,
    },
  };
}

/* =========================
   ENTRY POINT
========================= */

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
