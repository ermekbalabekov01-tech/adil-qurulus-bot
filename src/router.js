const projects = require("./config/projects.config");
const { getAIReply } = require("./services/ai.service");

/* =========================
   BASE HELPERS
========================= */

function normalizeText(text = "") {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[ʼ'`]/g, "")
    .replace(/\s+/g, " ");
}

function cleanGreetingText(text = "") {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-zа-яёәіңғүұқөһі0-9\s./,:-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikePhone(text = "") {
  const n = String(text).replace(/\D/g, "");
  return n.length >= 10 && n.length <= 15;
}

function onlyDigits(text = "") {
  return String(text).replace(/\D/g, "");
}

function detectLanguageByText(text = "") {
  const t = normalizeText(text);

  if (
    t.includes("қазақша") ||
    t.includes("қазақ") ||
    t.includes("на казахском") ||
    t.includes("казакша")
  ) {
    return "kz";
  }

  if (
    t.includes("русский") ||
    t.includes("на русском") ||
    t.includes("орысша") ||
    t.includes("по-русски")
  ) {
    return "ru";
  }

  const kzChars = /[әіңғүұқөһі]/i;
  if (kzChars.test(t)) return "kz";

  const ruChars = /[а-яё]/i;
  if (ruChars.test(t)) return "ru";

  return null;
}

function detectLanguage(text, projectConfig) {
  const t = normalizeText(text);

  if (projectConfig?.languageButtons?.kz?.includes(t)) return "kz";
  if (projectConfig?.languageButtons?.ru?.includes(t)) return "ru";

  return detectLanguageByText(text);
}

function isGreeting(text = "") {
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

function isMuslimGreeting(text = "") {
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

function isAngry(text = "") {
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

function extractName(text = "") {
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

function buildResult({
  project,
  reply,
  nextStep,
  mode = "scenario",
  language = "ru",
  data = {},
}) {
  return {
    project,
    result: {
      reply,
      nextStep,
      mode,
      language,
      data,
    },
  };
}

function mergeData(current = {}, extra = {}) {
  return {
    ...current,
    ...Object.fromEntries(
      Object.entries(extra).filter(([, value]) => value !== undefined && value !== null && value !== "")
    ),
  };
}

/* =========================
   CONSTRUCTION HELPERS
========================= */

function getConstructionOfficialGreeting(lang = "ru") {
  if (lang === "kz") {
    return (
      "Сәлем! 👋\n\n" +
      "*Adil Qurulus* компаниясына қош келдіңіз 🏗️\n\n" +
      "Біз Астана және жақын аймақтарда үй, коттедж және іргетас құрылысы бойынша бағыт береміз.\n\n" +
      "Жылдам нақтылау үшін жазыңыз:\n" +
      "1️⃣ Қандай жұмыс қызықтырады?\n" +
      "2️⃣ Дайын жоба бар ма, әлде әзірге нұсқаларды қарап жүрсіз бе?\n\n" +
      "Қаласаңыз, бірден учаскенің орналасқан жері мен шамамен көлемін жаза аласыз."
    );
  }

  return (
    "Здравствуйте! 👋\n\n" +
    "Вас приветствует компания *Adil Qurulus* 🏗️\n\n" +
    "Мы занимаемся строительством домов, коттеджей и фундаментных работ в Астане и области.\n\n" +
    "Чтобы сразу сориентировать вас по стоимости и срокам, уточните, пожалуйста:\n" +
    "1️⃣ Какие работы вас интересуют?\n" +
    "2️⃣ Есть ли у вас готовый проект или пока рассматриваете варианты?\n\n" +
    "Также можете сразу написать район участка и примерную площадь — это ускорит расчёт."
  );
}

function getDeEscalationReply(lang = "ru") {
  if (lang === "kz") {
    return (
      "Түсіндім, артық айналдырмаймын 🙏\n\n" +
      "Қысқаша жазыңыз:\n" +
      "1) не салу керек\n" +
      "2) учаске қай жерде\n" +
      "3) шамамен көлемі қандай\n\n" +
      "Сосын бірден нақты жауап берем."
    );
  }

  return (
    "Понял вас, без лишних кругов 🙏\n\n" +
    "Напишите коротко:\n" +
    "1) что нужно построить\n" +
    "2) где находится участок\n" +
    "3) какой примерно объём\n\n" +
    "И я сразу дам конкретику."
  );
}

function containsUsefulConstructionData(text = "") {
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
    if (t.includes("дом") || t.includes("үй") || t.includes("под ключ")) {
      data.intent = "house";
    }
    if (t.includes("коттедж")) data.intent = "cottage";
    if (
      t.includes("фундамент") ||
      t.includes("лента") ||
      t.includes("сваи") ||
      t.includes("плита")
    ) {
      data.intent = "foundation";
    }
    if (t.includes("консультация") || t.includes("кеңес")) {
      data.intent = "consultation";
    }
  }

  const areaMatch =
    t.match(/\b(\d{2,4})\s*(?:кв\.?\s*м|кв м|м2|м²)\b/i) ||
    t.match(/\b(\d{2,4})\s*(?:квадрат|квадратов)\b/i);

  if (areaMatch && !data.size) {
    data.size = `${areaMatch[1]} м²`;
  }

  const rangeMatch = t.match(
    /\b(\d{2,4})\s*[-–—]\s*(\d{2,4})\s*(?:кв\.?\s*м|кв м|м2|м²)?\b/i
  );
  if (rangeMatch && !data.size) {
    data.size = `${rangeMatch[1]}-${rangeMatch[2]} м²`;
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
    "биыл",
    "жақында",
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
    "левый берег",
    "правый берег",
    "район",
    "аудан",
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
  if (data.location) score += 1;
  if (data.size || data.plot) score += 1;
  if (data.timing) score += 1;
  return score;
}

function shouldUseConstructionAI(text, session = {}) {
  const t = normalizeText(text);
  const step = session?.step || "start";

  if (looksLikePhone(text)) return false;
  if (["language_select", "start", "ask_phone", "completed", "done"].includes(step)) {
    return false;
  }

  const aiSignals = [
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
    "ты бот",
    "это бот",
    "подробнее",
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
          "Ты спокойный и уверенный менеджер строительной компании Adil Qurulus. " +
          "Твоя задача — не уводить в долгий разговор, а мягко вести клиента к заявке. " +
          "Отвечай коротко, по делу, максимум 2-3 абзаца. " +
          "После ответа мягко переводи клиента к следующему шагу: локация, площадь, сроки, имя, телефон.",
      },
    });

    return aiReply || "";
  } catch (error) {
    console.error("❌ construction AI error:", error.message);
    return "";
  }
}

function getConstructionNextPrompt(data = {}, lang = "ru") {
  if (!data.intent) {
    return lang === "kz"
      ? "Қандай жұмыс қызықтырады?"
      : "Какие именно работы вас интересуют?";
  }
  if (!data.location) {
    return lang === "kz"
      ? "Учаске қай жерде орналасқан?"
      : "В каком районе или где находится участок?";
  }
  if (!data.size && !data.plot) {
    return lang === "kz"
      ? "Шамамен көлемі немесе ауданы қандай?"
      : "Какая примерно площадь или размер объекта?";
  }
  if (!data.timing) {
    return lang === "kz"
      ? "Құрылысты қашан бастауды жоспарлап отырсыз?"
      : "Когда планируете начинать строительство?";
  }
  if (!data.name) {
    return lang === "kz"
      ? "Өзіңізді қалай атаймыз?"
      : "Как я могу к вам обращаться?";
  }
  if (!data.phone) {
    return lang === "kz"
      ? "Телефон нөміріңізді қалдырыңыз."
      : "Оставьте, пожалуйста, номер телефона.";
  }
  return "";
}

/* =========================
   CLINIC HELPERS
========================= */

function getClinicGreeting(lang = "ru") {
  if (lang === "kz") {
    return (
      "Сәлеметсіз бе 🌸\n\n" +
      "Мен Алия, Dr.Aitimbetova клиникасының ассистентімін.\n" +
      "Процедура бойынша бағыт беріп, консультацияға жазылуға көмектесемін.\n\n" +
      "Қай қаладансыз?"
    );
  }

  return (
    "Здравствуйте 🌸\n\n" +
    "Я Алия, ассистент клиники Dr.Aitimbetova.\n" +
    "Помогу сориентироваться по процедурам, обучению и записать вас на консультацию.\n\n" +
    "Скажите, пожалуйста, из какого вы города?"
  );
}

function isClinicAdStarter(text = "") {
  const t = normalizeText(text);

  return (
    t.includes("можно узнать об этом подробнее") ||
    t.includes("можно узнать подробнее") ||
    t.includes("расскажите подробнее") ||
    t.includes("хочу узнать подробнее") ||
    t === "подробнее" ||
    t.includes("интересно") ||
    t.includes("можно узнать")
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

  const exact = t.match(/\b([0-2]?\d)[:. ]([0-5]\d)\b/);
  if (exact) {
    const hh = Number(exact[1]);
    const mm = Number(exact[2]);
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
  if (
    hourOnly &&
    (t.includes("в ") || t.includes("час") || t.includes("сағат") || t.includes("около") || t.includes("примерно"))
  ) {
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

  if (["language_select", "start", "ask_phone", "training_phone", "completed", "done"].includes(step)) {
    return false;
  }
  if (looksLikePhone(text)) return false;
  if (t.length < 6) return false;

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
    "подумаю",
    "из другого города",
    "другой город",
  ];

  return aiSignals.some((word) => t.includes(word));
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
          "Ты Алия, живой и уверенный ассистент клиники Dr.Aitimbetova. " +
          "Твоя задача — отвечать по делу и мягко вести клиента к записи или к заявке на обучение. " +
          "Отвечай коротко, по сути, максимум 2-3 абзаца. " +
          "Если клиент спрашивает цену — мягко веди к консультации. " +
          "Если клиент сомневается — успокой и предложи удобный день. " +
          "После ответа всегда возвращай клиента к следующему шагу.",
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

  return data;
}

function getClinicNextPrompt(data = {}, lang = "ru") {
  if (!data.city) {
    return lang === "kz"
      ? "Қай қаладансыз?"
      : "Скажите, пожалуйста, из какого вы города?";
  }
  if (!data.service) {
    return lang === "kz"
      ? "Қай процедура қызықтырады?"
      : "Какая процедура вас интересует?";
  }
  if (data.intent === "training" && !data.name) {
    return lang === "kz"
      ? "Өзіңізді қалай атаймыз?"
      : "Подскажите, пожалуйста, как я могу к вам обращаться?";
  }
  if (data.intent === "training" && !data.phone) {
    return lang === "kz"
      ? "Телефон нөміріңізді жазыңызшы."
      : "Напишите, пожалуйста, номер телефона.";
  }
  if (!data.visitDay) {
    return lang === "kz"
      ? "Қай күн ыңғайлы?"
      : "На какой день вам удобно?";
  }
  if (!data.visitTime) {
    return lang === "kz"
      ? "Қай уақыт ыңғайлы?"
      : "Какое время вам удобно?";
  }
  if (!data.name) {
    return lang === "kz"
      ? "Өзіңізді қалай атаймыз?"
      : "Как я могу к вам обращаться?";
  }
  if (!data.phone) {
    return lang === "kz"
      ? "Телефон нөміріңізді жазыңызшы."
      : "Напишите, пожалуйста, номер телефона.";
  }
  return "";
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

  const switchedLang = detectLanguageByText(text);
  if (switchedLang && switchedLang !== (session?.language || lang)) {
    return buildResult({
      project: "clinic",
      reply: getClinicGreeting(switchedLang),
      nextStep: "ask_city",
      mode: session?.mode || "scenario",
      language: switchedLang,
      data: currentData,
    });
  }

  if (
    isClinicAdStarter(text) &&
    (!session?.step || session?.step === "start" || !session?.language)
  ) {
    return buildResult({
      project: "clinic",
      reply: getClinicGreeting("ru"),
      nextStep: "ask_city",
      mode: "scenario",
      language: "ru",
      data: currentData,
    });
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
    return buildResult({
      project: "clinic",
      reply:
        lang === "kz"
          ? `Біз Астанада орналасқанбыз 🌿\n\nМіне нақты локация:\n${mapUrl}\n\nҚаласаңыз, ыңғайлы күн мен уақытты бірден қарайық.`
          : `Мы находимся в Астане 🌿\n\nВот наша точная локация:\n${mapUrl}\n\nЕсли хотите, я сразу помогу подобрать удобный день и время.`,
      nextStep: session?.step || "ask_city",
      mode: session?.mode || "scenario",
      language: lang,
      data: currentData,
    });
  }

  if (
    t.includes("инстаграм") ||
    t.includes("instagram") ||
    t.includes("работы") ||
    t.includes("кейсы") ||
    t.includes("примеры")
  ) {
    return buildResult({
      project: "clinic",
      reply:
        lang === "kz"
          ? `Әрине 🌿\n\nМіне біздің Instagram:\n${instagramUrl}\n\nҚаласаңыз, осы жерден-ақ консультацияға жазып қоямын.`
          : `Конечно 🌿\n\nВот наш Instagram:\n${instagramUrl}\n\nЕсли хотите, здесь же помогу записаться на консультацию.`,
      nextStep: session?.step || "ask_city",
      mode: session?.mode || "scenario",
      language: lang,
      data: currentData,
    });
  }

  if (!session?.language) {
    const detected = detectLanguage(text, projectConfig);

    if (!detected) {
      return buildResult({
        project: "clinic",
        reply: projectConfig.welcome.mixed,
        nextStep: "language_select",
        mode: "scenario",
        language: null,
        data: currentData,
      });
    }

    return buildResult({
      project: "clinic",
      reply: getClinicGreeting(detected),
      nextStep: "ask_city",
      mode: "scenario",
      language: detected,
      data: currentData,
    });
  }

  if (session?.mode === "support") {
    return buildResult({
      project: "clinic",
      reply: buildSupportReply(lang, projectConfig, text),
      nextStep: "done",
      mode: "support",
      language: lang,
      data: currentData,
    });
  }

  if (
    t.includes("сколько") ||
    t.includes("цена") ||
    t.includes("стоимость") ||
    t.includes("қанша") ||
    t.includes("бағасы")
  ) {
    return buildResult({
      project: "clinic",
      reply:
        lang === "kz"
          ? "Нақты баға зона мен көлемге байланысты 🌿\n\nДәрігер консультацияда нақтырақ айтады.\n\nҚаласаңыз, қазір ыңғайлы күнді қарайық."
          : "Точная стоимость зависит от зоны и объёма 🌿\n\nВрач сможет точнее сориентировать на консультации.\n\nЕсли хотите, давайте сразу подберём удобный день.",
      nextStep: currentData.visitDay ? "ask_time" : "ask_day",
      mode: "scenario",
      language: lang,
      data: currentData,
    });
  }

  if (t.includes("подумаю")) {
    return buildResult({
      project: "clinic",
      reply:
        lang === "kz"
          ? "Түсінемін 🌿\n\nӘзірге ыңғайлы уақытты алдын ала қойып қоя аламыз, еш міндеттемесіз.\n\nҚай күн ыңғайлы?"
          : "Понимаю 🌿\n\nМожем пока просто предварительно поставить удобное время, без обязательств.\n\nКакой день вам удобен?",
      nextStep: "ask_day",
      mode: "scenario",
      language: lang,
      data: currentData,
    });
  }

  if (
    t.includes("другой город") ||
    t.includes("из другого города") ||
    t.includes("с другого города")
  ) {
    return buildResult({
      project: "clinic",
      reply:
        lang === "kz"
          ? "Түсіндім 🌿\n\nБізге басқа қалалардан да жиі келеді.\n\nСіз Астанаға шамамен қай күні келе аласыз?"
          : "Поняла 🌿\n\nК нам часто приезжают из других городов.\n\nПодскажите, примерно в какой день вы сможете быть в Астане?",
      nextStep: "ask_day",
      mode: "scenario",
      language: lang,
      data: currentData,
    });
  }

  if (clinicShouldUseAI(text, session)) {
    const aiReply = await tryClinicAIReply({ text, session, lang });
    if (aiReply) {
      return buildResult({
        project: "clinic",
        reply: `${aiReply}\n\n${getClinicNextPrompt(currentData, lang)}`,
        nextStep: session?.step || "ask_service",
        mode: "scenario",
        language: lang,
        data: currentData,
      });
    }
  }

  if (session?.step === "language_select") {
    return buildResult({
      project: "clinic",
      reply: getClinicGreeting(lang),
      nextStep: "ask_city",
      mode: "scenario",
      language: lang,
      data: currentData,
    });
  }

  if (session?.step === "start" || session?.step === "ask_city") {
    const data = currentData.city
      ? currentData
      : mergeData(currentData, { city: text, location: text });

    if (data.city) {
      return buildResult({
        project: "clinic",
        reply: prompts.askLocation,
        nextStep: "ask_service",
        mode: "scenario",
        language: lang,
        data,
      });
    }

    return buildResult({
      project: "clinic",
      reply: getClinicGreeting(lang),
      nextStep: "ask_city",
      mode: "scenario",
      language: lang,
      data: currentData,
    });
  }

  if (session?.step === "ask_service") {
    const intent = detectIntent(text, projectConfig) || currentData.intent;
    const training = isTrainingIntent(text, { ...currentData, intent });
    const data = mergeData(currentData, {
      intent,
      service: currentData.service || text,
      projectDetails: currentData.projectDetails || text,
    });

    if (training) {
      return buildResult({
        project: "clinic",
        reply:
          lang === "kz"
            ? "Түсіндім 🌿\n\nОқу бойынша толық ақпаратты администратор береді.\nӨзіңізді қалай атаймыз?"
            : "Поняла 🌿\n\nПо обучению администратор подробно всё подскажет.\nПодскажите, пожалуйста, как я могу к вам обращаться?",
        nextStep: "training_name",
        mode: "scenario",
        language: lang,
        data: mergeData(data, { leadType: "training", intent: "training" }),
      });
    }

    return buildResult({
      project: "clinic",
      reply:
        lang === "kz"
          ? `Жақсы 🌸\n\n${data.service} бойынша дәрігер консультацияда нақтырақ бағыт береді.\n\nКонсультация шамамен 20 минут алады.\n\nҚай күн ыңғайлы?`
          : `Отлично 🌸\n\nПо направлению "${data.service}" врач сможет точнее сориентировать вас на консультации.\n\nКонсультация занимает около 20 минут.\n\nНа какой день вам удобно?`,
      nextStep: "ask_day",
      mode: "scenario",
      language: lang,
      data,
    });
  }

  if (session?.step === "training_name") {
    const data = mergeData(currentData, {
      name: currentData.name || extractName(text) || text,
    });

    return buildResult({
      project: "clinic",
      reply:
        lang === "kz"
          ? "Рақмет 🌸\n\nЕнді телефон нөміріңізді жазыңызшы. Администратор оқу бойынша хабарласады."
          : "Спасибо 🌸\n\nТеперь напишите, пожалуйста, ваш номер телефона. Администратор свяжется с вами по обучению.",
      nextStep: "training_phone",
      mode: "scenario",
      language: lang,
      data,
    });
  }

  if (session?.step === "training_phone") {
    if (!looksLikePhone(text)) {
      return buildResult({
        project: "clinic",
        reply:
          lang === "kz"
            ? "Телефон нөмірін ыңғайлы форматта жазыңызшы."
            : "Пожалуйста, напишите номер телефона в удобном формате.",
        nextStep: "training_phone",
        mode: "scenario",
        language: lang,
        data: currentData,
      });
    }

    return buildResult({
      project: "clinic",
      reply:
        lang === "kz"
          ? "Рақмет 🌿\n\nОқу бойынша сұранысыңызды администраторға жібердім.\nСізбен бағдарлама, формат, бағасы және жақын күндер туралы нақтылау үшін хабарласады."
          : "Спасибо 🌿\n\nЯ передала ваш запрос по обучению администратору.\nС вами свяжутся для уточнения программы, формата, стоимости и ближайших дат.",
      nextStep: "completed",
      mode: "support",
      language: lang,
      data: mergeData(currentData, {
        phone: onlyDigits(text),
        leadType: "training",
      }),
    });
  }

  if (session?.step === "ask_day") {
    const smart = parseSmartDateTime(text, lang);
    let data = { ...currentData };

    if (smart.hasDate) {
      data = mergeData(data, {
        visitDay: smart.date.value,
        visitDateIso: smart.date.iso,
        timing: smart.date.value,
      });
    }

    if (smart.hasTime) {
      if (!isWithinClinicHours(smart.time)) {
        return buildResult({
          project: "clinic",
          reply: getClinicAlternativeTimeReply(lang, smart.time),
          nextStep: "ask_time",
          mode: "scenario",
          language: lang,
          data,
        });
      }

      data = mergeData(data, {
        visitTime: smart.time.value,
        preferredTime: smart.time.value,
      });
    }

    if (!data.visitDay) {
      return buildResult({
        project: "clinic",
        reply:
          lang === "kz"
            ? "Күні ыңғайлы форматта жазыңызшы 🌿\nМысалы: ертең, дүйсенбі, 19 сәуір"
            : "Напишите, пожалуйста, день в удобном формате 🌿\nНапример: завтра, понедельник, 19 апреля",
        nextStep: "ask_day",
        mode: "scenario",
        language: lang,
        data,
      });
    }

    if (data.visitTime) {
      return buildResult({
        project: "clinic",
        reply:
          lang === "kz"
            ? "Өте жақсы 🌿\n\nУақытты қойып қойдым.\nЕнді өз атыңызды жазыңыз."
            : "Отлично 🌿\n\nВремя зафиксировала.\nТеперь подскажите, как к вам обращаться.",
        nextStep: "ask_name_age",
        mode: "scenario",
        language: lang,
        data,
      });
    }

    return buildResult({
      project: "clinic",
      reply:
        lang === "kz"
          ? `Жақсы 🌸\n\n${data.visitDay} күніне мына уақыттарды қарастыруға болады:\n• 12:00\n• 15:00\n• 19:00\n\nҚайсысы ыңғайлы?`
          : `Хорошо 🌸\n\nНа ${data.visitDay} можно рассмотреть такие окна:\n• 12:00\n• 15:00\n• 19:00\n\nКакое время вам удобнее?`,
      nextStep: "ask_time",
      mode: "scenario",
      language: lang,
      data,
    });
  }

  if (session?.step === "ask_time") {
    const smart = parseSmartDateTime(text, lang);
    let data = { ...currentData };

    if (smart.hasDate && !data.visitDay) {
      data = mergeData(data, {
        visitDay: smart.date.value,
        visitDateIso: smart.date.iso,
        timing: smart.date.value,
      });
    }

    if (!smart.hasTime) {
      return buildResult({
        project: "clinic",
        reply:
          lang === "kz"
            ? "Уақытты ыңғайлы форматта жазыңызшы 🌿\nМысалы: 12:00 немесе 15:30"
            : "Напишите, пожалуйста, время в удобном формате 🌿\nНапример: 12:00 или 15:30",
        nextStep: "ask_time",
        mode: "scenario",
        language: lang,
        data,
      });
    }

    if (!isWithinClinicHours(smart.time)) {
      return buildResult({
        project: "clinic",
        reply: getClinicAlternativeTimeReply(lang, smart.time),
        nextStep: "ask_time",
        mode: "scenario",
        language: lang,
        data,
      });
    }

    data = mergeData(data, {
      visitTime: smart.time.value,
      preferredTime: smart.time.value,
    });

    return buildResult({
      project: "clinic",
      reply:
        lang === "kz"
          ? "Өте жақсы 🌿\n\nУақытты қойып қойдым.\nЕнді өз атыңызды жазыңыз."
          : "Отлично 🌿\n\nВремя зафиксировала.\nТеперь подскажите, как к вам обращаться.",
      nextStep: "ask_name_age",
      mode: "scenario",
      language: lang,
      data,
    });
  }

  if (session?.step === "ask_name_age") {
    const data = mergeData(currentData, { name: text });

    return buildResult({
      project: "clinic",
      reply:
        lang === "kz"
          ? "Жақсы 🌸\n\nСоңғы қадам қалды — телефон нөміріңізді жазыңызшы."
          : "Хорошо 🌸\n\nОстался последний шаг — напишите, пожалуйста, номер телефона.",
      nextStep: "ask_phone",
      mode: "scenario",
      language: lang,
      data,
    });
  }

  if (session?.step === "ask_phone") {
    if (!looksLikePhone(text)) {
      return buildResult({
        project: "clinic",
        reply:
          lang === "kz"
            ? "Телефон нөмірін ыңғайлы форматта жазыңызшы."
            : "Пожалуйста, напишите номер телефона в удобном формате.",
        nextStep: "ask_phone",
        mode: "scenario",
        language: lang,
        data: currentData,
      });
    }

    const data = mergeData(currentData, {
      phone: onlyDigits(text),
      leadType: currentData.intent === "training" ? "training" : "consultation",
    });

    const day = data.visitDay || "Не указано";
    const time = data.visitTime || data.preferredTime || "Не указано";
    const city = data.city || data.location || "Не указано";
    const service = data.service || data.projectDetails || "Не указано";

    const finalReply =
      lang === "kz"
        ? `Рақмет 🌿\n\nСізді алдын ала консультацияға жаздым:\n• Қала: ${city}\n• Процедура: ${service}\n• Күні: ${day}\n• Уақыты: ${time}\n\nМіне біздің локация:\n${mapUrl}\n\nАдминистратор жақын арада растау үшін хабарласады.`
        : `Спасибо 🌿\n\nПредварительно записала вас на консультацию:\n• Город: ${city}\n• Услуга: ${service}\n• Дата: ${day}\n• Время: ${time}\n\nВот наша локация:\n${mapUrl}\n\nАдминистратор свяжется с вами в ближайшее время для подтверждения записи.`;

    return buildResult({
      project: "clinic",
      reply: finalReply,
      nextStep: "completed",
      mode: "support",
      language: lang,
      data,
    });
  }

  return buildResult({
    project: "clinic",
    reply: getClinicGreeting(lang),
    nextStep: "ask_city",
    mode: "scenario",
    language: lang,
    data: currentData,
  });
}

/* =========================
   CONSTRUCTION ROUTER
========================= */

async function routeConstructionMessage({ text, session, projectConfig, lang }) {
  const t = normalizeText(text);
  const currentData = parseConstructionInfo(text, session?.data || {});
  const prompts = projectConfig.prompts[lang] || projectConfig.prompts.ru;
  const signalCount = countConstructionSignals(currentData);

  const switchedLang = detectLanguageByText(text);
  if (switchedLang && switchedLang !== (session?.language || lang)) {
    return buildResult({
      project: "construction",
      reply: getConstructionOfficialGreeting(switchedLang),
      nextStep: "qualification",
      mode: session?.mode || "scenario",
      language: switchedLang,
      data: currentData,
    });
  }

  if (!session?.language) {
    const detected = detectLanguage(text, projectConfig);

    if (!detected) {
      return buildResult({
        project: "construction",
        reply: projectConfig.welcome.mixed,
        nextStep: "language_select",
        mode: "scenario",
        language: null,
        data: currentData,
      });
    }

    return buildResult({
      project: "construction",
      reply: getConstructionOfficialGreeting(detected),
      nextStep: "qualification",
      mode: "scenario",
      language: detected,
      data: currentData,
    });
  }

  if (session?.mode === "support") {
    return buildResult({
      project: "construction",
      reply: buildSupportReply(lang, projectConfig, text),
      nextStep: "done",
      mode: "support",
      language: lang,
      data: currentData,
    });
  }

  if (isAngry(text)) {
    return buildResult({
      project: "construction",
      reply: getDeEscalationReply(lang),
      nextStep: session?.step || "qualification",
      mode: session?.mode || "scenario",
      language: lang,
      data: currentData,
    });
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
    return buildResult({
      project: "construction",
      reply:
        lang === "kz"
          ? "Біз Астана және жақын маңдағы аудандармен жұмыс істейміз 👍\n\nНақты локацияны жазыңыз, сол жер бойынша бірден айтамын."
          : "Мы работаем по Астане и ближайшим пригородам 👍\n\nНапишите точную локацию участка, и я сразу скажу по вашему объекту.",
      nextStep: session?.step || "qualification",
      mode: session?.mode || "scenario",
      language: lang,
      data: currentData,
    });
  }

  if (
    t.includes("где вы") ||
    t.includes("локация") ||
    t.includes("адрес")
  ) {
    const mapUrl =
      process.env.CONSTRUCTION_2GIS_URL ||
      "https://2gis.kz/astana/geo/70000001102004976";

    return buildResult({
      project: "construction",
      reply:
        lang === "kz"
          ? `Міне біздің локация:\n${mapUrl}\n\nЕнді жобаңыз бойынша қысқаша жазыңыз: учаске қай жерде және шамамен қандай көлем?`
          : `Вот наша локация:\n${mapUrl}\n\nТеперь по вашему объекту кратко напишите: где участок и какой примерно объём?`,
      nextStep: session?.step || "qualification",
      mode: session?.mode || "scenario",
      language: lang,
      data: currentData,
    });
  }

  if (
    t.includes("инстаграм") ||
    t.includes("instagram") ||
    t.includes("работы") ||
    t.includes("кейсы")
  ) {
    const insta =
      process.env.INSTAGRAM_URL ||
      "https://www.instagram.com/adil_qurulus?igsh=eTJxdDU2bGJvcjd1";

    return buildResult({
      project: "construction",
      reply:
        lang === "kz"
          ? `Міне біздің Instagram:\n${insta}\n\nҚаласаңыз, осы жерден-ақ жобаңызды қысқаша жаза аласыз.`
          : `Вот наш Instagram:\n${insta}\n\nЕсли хотите, здесь же можете кратко написать по вашему объекту.`,
      nextStep: session?.step || "qualification",
      mode: session?.mode || "scenario",
      language: lang,
      data: currentData,
    });
  }

  if (isMuslimGreeting(text) && !containsUsefulConstructionData(text)) {
    return buildResult({
      project: "construction",
      reply: getConstructionOfficialGreeting(lang),
      nextStep: session?.step || "qualification",
      mode: session?.mode || "scenario",
      language: lang,
      data: currentData,
    });
  }

  if (isGreeting(text) && !containsUsefulConstructionData(text)) {
    return buildResult({
      project: "construction",
      reply: getConstructionOfficialGreeting(lang),
      nextStep: session?.step || "qualification",
      mode: session?.mode || "scenario",
      language: lang,
      data: currentData,
    });
  }

  if (shouldUseConstructionAI(text, session)) {
    const aiReply = await tryConstructionAIReply({ text, session, lang });
    if (aiReply) {
      return buildResult({
        project: "construction",
        reply: `${aiReply}\n\n${getConstructionNextPrompt(currentData, lang)}`,
        nextStep: session?.step || "qualification",
        mode: "scenario",
        language: lang,
        data: currentData,
      });
    }
  }

  if (
    session?.step === "language_select" ||
    session?.step === "qualification" ||
    session?.step === "start"
  ) {
    if (signalCount >= 3) {
      return buildResult({
        project: "construction",
        reply:
          lang === "kz"
            ? "Жақсы, негізгі мәлімет жеткілікті 👍\n\nӨзіңізді қалай атаймыз?"
            : "Хорошо, основной информации уже достаточно 👍\n\nПодскажите, как я могу к вам обращаться?",
        nextStep: "ask_name",
        mode: "scenario",
        language: lang,
        data: currentData,
      });
    }

    return buildResult({
      project: "construction",
      reply:
        lang === "kz"
          ? "Қандай жұмыс қызықтырады?\nМысалы: үй, коттедж, іргетас немесе кеңес."
          : "Какие именно работы вас интересуют?\nНапример: дом, коттедж, фундамент или консультация.",
      nextStep: "ask_project",
      mode: "scenario",
      language: lang,
      data: currentData,
    });
  }

  if (session?.step === "ask_project") {
    const data = mergeData(currentData, {
      intent: currentData.intent || detectIntent(text, projectConfig),
      projectDetails: currentData.projectDetails || text,
    });

    if (countConstructionSignals(data) >= 3) {
      return buildResult({
        project: "construction",
        reply:
          lang === "kz"
            ? "Жақсы 👍\n\nНегізгі мәліметті түсіндім. Енді өз атыңызды жазыңыз."
            : "Хорошо 👍\n\nОсновную картину уже понял. Теперь подскажите, как к вам можно обращаться.",
        nextStep: "ask_name",
        mode: "scenario",
        language: lang,
        data,
      });
    }

    return buildResult({
      project: "construction",
      reply:
        lang === "kz"
          ? "Енді локацияны жазыңыз: учаске қай жерде?"
          : "Теперь уточните локацию: в каком районе или где находится участок?",
      nextStep: "ask_location",
      mode: "scenario",
      language: lang,
      data,
    });
  }

  if (session?.step === "ask_location") {
    const data = mergeData(currentData, {
      location: currentData.location || text,
    });

    if (data.size || data.plot) {
      return buildResult({
        project: "construction",
        reply:
          lang === "kz"
            ? "Құрылысты қашан бастауды жоспарлап отырсыз?"
            : "Когда планируете начинать строительство?",
        nextStep: "ask_timing",
        mode: "scenario",
        language: lang,
        data,
      });
    }

    return buildResult({
      project: "construction",
      reply:
        lang === "kz"
          ? "Шамамен көлемін жазыңыз. Мысалы: 120 м² немесе 10 соток."
          : "Напишите примерный размер. Например: 120 м² или участок 10 соток.",
      nextStep: "ask_size",
      mode: "scenario",
      language: lang,
      data,
    });
  }

  if (session?.step === "ask_size") {
    const parsed = parseConstructionInfo(text, currentData);

    return buildResult({
      project: "construction",
      reply:
        lang === "kz"
          ? "Құрылысты қашан бастауды жоспарлап отырсыз?"
          : "Когда планируете начинать строительство?",
      nextStep: "ask_timing",
      mode: "scenario",
      language: lang,
      data: parsed,
    });
  }

  if (session?.step === "ask_timing") {
    const data = mergeData(currentData, {
      timing: currentData.timing || text,
    });

    return buildResult({
      project: "construction",
      reply:
        lang === "kz"
          ? "Өзіңізді қалай атаймыз?"
          : "Как я могу к вам обращаться?",
      nextStep: "ask_name",
      mode: "scenario",
      language: lang,
      data,
    });
  }

  if (session?.step === "ask_name") {
    const data = mergeData(currentData, {
      name: currentData.name || extractName(text) || text,
    });

    return buildResult({
      project: "construction",
      reply:
        lang === "kz"
          ? "Телефон нөміріңізді қалдырыңыз. Менеджер сізбен байланысып, нақты консультация береді."
          : "Оставьте, пожалуйста, номер телефона. Менеджер свяжется с вами и даст точную консультацию.",
      nextStep: "ask_phone",
      mode: "scenario",
      language: lang,
      data,
    });
  }

  if (session?.step === "ask_phone") {
    if (!looksLikePhone(text)) {
      return buildResult({
        project: "construction",
        reply:
          lang === "kz"
            ? "Телефон нөмірін ыңғайлы форматта жазыңызшы."
            : "Пожалуйста, напишите номер телефона в удобном формате.",
        nextStep: "ask_phone",
        mode: "scenario",
        language: lang,
        data: currentData,
      });
    }

    return buildResult({
      project: "construction",
      reply: prompts.leadCreated,
      nextStep: "completed",
      mode: "support",
      language: lang,
      data: mergeData(currentData, {
        phone: onlyDigits(text),
      }),
    });
  }

  return buildResult({
    project: "construction",
    reply: getConstructionOfficialGreeting(lang),
    nextStep: "qualification",
    mode: "scenario",
    language: lang,
    data: currentData,
  });
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
        mode: "scenario",
        language: session?.language || "ru",
        data: session?.data || {},
      },
    };
  }

  const language =
    session?.language ||
    detectLanguage(text, projectConfig) ||
    "ru";

  if (projectKey === "clinic") {
    return routeClinicMessage({
      text,
      session,
      projectConfig,
      lang: language,
    });
  }

  return routeConstructionMessage({
    text,
    session,
    projectConfig,
    lang: language,
  });
}

module.exports = {
  routeMessage,
};
