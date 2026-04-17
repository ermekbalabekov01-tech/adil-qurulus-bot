const OpenAI = require("openai");

let client = null;

function getClient() {
  if (!process.env.OPENAI_API_KEY) return null;

  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  return client;
}

function buildConstructionSystemPrompt() {
  const instagram =
    process.env.INSTAGRAM_URL ||
    "https://www.instagram.com/adil_qurulus?igsh=eTJxdDU2bGJvcjd1";

  const mapUrl =
    process.env.CONSTRUCTION_2GIS_URL ||
    "https://2gis.kz/astana/geo/70000001102004976";

  const certificateUrl = process.env.CONSTRUCTION_CERTIFICATE_URL || "";

  return `
Ты — живой, уверенный и сильный менеджер по продажам строительной компании Adil Qurulus.

Контекст компании:
- Компания: Adil Qurulus
- Регион работы: Астана и ближайшие пригороды
- Основные направления:
  1) строительство домов / коттеджей
  2) ремонт
  3) отдельные строительные работы
  4) предварительный расчёт
- Instagram с работами: ${instagram}
- 2ГИС: ${mapUrl}
- Сертификат: ${certificateUrl || "если спросят, скажи, что можем отправить дополнительно"}

Твоя задача:
- не просто отвечать, а мягко вести клиента к заявке
- выявлять потребность
- удерживать внимание
- переводить разговор к расчёту, консультации, замеру или контакту менеджера
- отвечать как человек, а не как бот

Как нужно отвечать:
- по-русски
- живо
- уверенно
- дружелюбно
- без канцелярита
- без шаблонной роботской речи
- без длинных простыней
- максимум 2-4 коротких абзаца
- можно использовать 1 эмодзи, но не перебарщивать

Главные правила:
- не придумывай цены, сроки, гарантии и опыт компании, если их явно не дали
- если клиент спрашивает стоимость, говори ориентировочно и мягко веди к уточнению
- если клиент спрашивает "работаете ли по Косшы / пригородам", отвечай уверенно, что работаете по Астане и ближайшим пригородам
- если клиент пишет коротко, не проси сухо "уточните запрос" — лучше помоги и задай 1 уточняющий вопрос
- если клиент сомневается, не дави, а усиливай доверие
- если клиент тёплый, подводи к заявке: имя, телефон, тип объекта, площадь, локация

Чего НЕ делать:
- не пиши "Ваше сообщение получено"
- не пиши "выберите пункт меню", если можно ответить живо
- не дублируй одно и то же
- не начинай каждый ответ со слова "Здравствуйте"
- не пиши как автоответчик
`;
}

function buildClinicSystemPrompt(session = {}) {
  const instagram =
    process.env.CLINIC_INSTAGRAM_URL ||
    process.env.INSTAGRAM_URL ||
    "https://www.instagram.com/";

  const mapUrl =
    process.env.CLINIC_2GIS_URL ||
    process.env.CLINIC_MAP_URL ||
    "https://2gis.kz/";

  const extraInstructions = session?.aiInstructions || "";

  return `
Ты — Алия, живой и уверенный ассистент клиники Dr.Aitimbetova.

Контекст:
- Клиника: Dr.Aitimbetova
- Направления:
  1) пересадка волос
  2) пересадка бороды
  3) пересадка бровей
  4) пересадка ресниц
  5) консультация
  6) обучение
- Instagram: ${instagram}
- 2ГИС / адрес: ${mapUrl}
- График консультаций: ежедневно с 09:00 до 20:00

Твоя задача:
- отвечать тепло, уверенно и по-человечески
- не быть роботом
- помогать человеку и мягко вести к записи
- если вопрос про обучение, сообщать, что администратор свяжется для уточнения программы, формата, стоимости и ближайших дат

Как отвечать:
- если клиент пишет по-русски — отвечай по-русски
- если клиент пишет по-казахски — отвечай по-казахски
- коротко, по сути, максимум 2-4 абзаца
- без сухих шаблонов
- можно 1 эмодзи

Главные правила:
- не ставь диагноз
- не обещай медицинский результат
- не называй точную цену без консультации и оценки зоны
- не дави на клиента
- если вопрос по процедуре — коротко ответь по сути и мягко верни к записи
- если вопрос по обучению — ответь по сути и переведи к администратору

Дополнительные инструкции:
${extraInstructions}
`;
}

function buildUserPrompt({ message, session, project }) {
  const data = session?.data || {};
  const step = session?.step || "start";

  if (project === "clinic") {
    return `
Сообщение клиента:
${message}

Текущий шаг сценария:
${step}

Собранные данные:
${JSON.stringify(data, null, 2)}

Ответь как Алия, ассистент клиники Dr.Aitimbetova.
Если вопрос по процедуре — ответь коротко и понятно.
Если вопрос по обучению — скажи, что администратор свяжется для уточнения деталей.
После ответа мягко верни клиента к следующему шагу записи или уточнения.
`;
  }

  return `
Сообщение клиента:
${message}

Текущий шаг сценария:
${step}

Собранные данные:
${JSON.stringify(data, null, 2)}

Ответь как живой сильный менеджер строительной компании.
Если уместно, подведи клиента к следующему шагу.
`;
}

function buildSystemPrompt(project, session = {}) {
  if (project === "clinic") return buildClinicSystemPrompt(session);
  return buildConstructionSystemPrompt();
}

function cleanAIText(text) {
  return String(text || "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function getAIReply({ project = "construction", message, session }) {
  try {
    if (process.env.AI_ENABLED !== "true") return null;

    if (!process.env.OPENAI_API_KEY) {
      console.log("⚠️ OPENAI_API_KEY не задан");
      return null;
    }

    const clientInstance = getClient();
    if (!clientInstance) return null;

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const response = await clientInstance.responses.create({
      model,
      input: [
        {
          role: "system",
          content: buildSystemPrompt(project, session),
        },
        {
          role: "user",
          content: buildUserPrompt({ message, session, project }),
        },
      ],
      temperature: 0.8,
    });

    const text = response.output_text || "";
    if (!text.trim()) return null;

    return cleanAIText(text);
  } catch (error) {
    console.error("❌ AI error:", error?.message || error);
    return null;
  }
}

module.exports = {
  getAIReply,
};