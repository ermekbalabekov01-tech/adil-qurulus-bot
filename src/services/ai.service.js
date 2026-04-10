const OpenAI = require('openai');

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

function buildSystemPrompt() {
  return `
Ты — живой, уверенный и вежливый менеджер строительной компании Adil Qurulus.

Задача:
- отвечать по-человечески, коротко и понятно
- помогать по строительству домов, ремонту, фундаменту и отдельным строительным работам
- работать по Астане и ближайшим пригородам
- не звучать как робот и не писать слишком официально
- не придумывать цены, сроки и гарантии, если их не дали явно
- если клиент готов обсудить проект, мягко вести к заявке
- если вопрос общий, сначала ответь полезно, потом предложи помочь с расчётом или консультацией
- если человек спрашивает адрес или работы, можно упомянуть Instagram и 2ГИС
- пиши на русском языке

Стиль:
- дружелюбно
- уверенно
- без канцелярита
- без длинных полотен
- максимум 4-6 коротких абзацев
`;
}

function buildUserPrompt({ message, session }) {
  const data = session?.data || {};
  const step = session?.step || 'start';

  return `
Сообщение клиента:
${message}

Текущий шаг сценария:
${step}

Текущие данные клиента:
${JSON.stringify(data, null, 2)}

Ответь как живой менеджер строительной компании.
Если уместно, мягко подтолкни к следующему шагу.
`;
}

async function getAIReply({ message, session }) {
  try {
    if (process.env.AI_ENABLED !== 'true') return null;
    if (!process.env.OPENAI_API_KEY) {
      console.log('⚠️ OPENAI_API_KEY не задан');
      return null;
    }

    const model = process.env.OPENAI_MODEL || 'gpt-5.4-mini';

    const response = await client.responses.create({
      model,
      input: [
        {
          role: 'system',
          content: buildSystemPrompt()
        },
        {
          role: 'user',
          content: buildUserPrompt({ message, session })
        }
      ]
    });

    return response.output_text || null;
  } catch (error) {
    console.error('❌ AI error:', error?.message || error);
    return null;
  }
}

module.exports = {
  getAIReply
};