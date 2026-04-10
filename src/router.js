const { handleConstruction } = require('./modules/construction/scenario');
const { getAIReply } = require('./services/ai.service');

function normalizeText(text) {
  return (text || '').trim().toLowerCase();
}

function shouldUseAI(message, session) {
  const text = normalizeText(message);
  const step = session?.step || 'start';

  // После завершённой заявки всегда даём шанс ИИ ответить по-человечески
  if (step === 'completed') return true;

  // Внутри анкеты/воронки сценарий важнее ИИ
  const lockedSteps = [
    'house_stage',
    'house_location',
    'house_project',
    'house_size',
    'house_timing',
    'house_budget',
    'house_name',
    'house_phone',
    'repair_object',
    'repair_location',
    'repair_area',
    'repair_type',
    'repair_timing',
    'repair_name',
    'repair_phone',
    'service_type',
    'service_location',
    'service_scope',
    'service_materials',
    'service_name',
    'service_phone',
    'trust_menu',
    'after_trust',
    'after_about',
    'calc_type',
    'calc_request',
    'calc_name',
    'calc_phone',
    'manager_name',
    'manager_phone'
  ];

  if (lockedSteps.includes(step)) return false;

  // Простые цифровые ответы — это сценарий
  if (/^[1-9]$/.test(text)) return false;

  // Команды сброса — это сценарий
  if (['меню', 'назад', 'заново', 'сначала', 'стоп'].includes(text)) {
    return false;
  }

  // Короткие приветствия лучше обрабатывает ИИ после completed,
  // а в остальных случаях пусть идёт сценарий
  const shortGreetings = ['привет', 'здравствуйте', 'добрый день', 'салем', 'hello'];
  if (shortGreetings.includes(text)) {
    return step === 'completed';
  }

  // Свободный вопрос/фраза — пускаем в ИИ
  if (text.length >= 8) return true;

  return false;
}

async function routeMessage({ text, from, session, projectType }) {
  const project = projectType || session?.project || 'construction';

  // Сейчас основной активный проект — стройка
  if (project !== 'construction') {
    return {
      project: 'construction',
      result: handleConstruction(text, session || {})
    };
  }

  // Если заявка уже завершена, сначала пробуем ИИ
  if (session?.step === 'completed') {
    const aiReply = await getAIReply({
      message: text,
      session
    });

    if (aiReply) {
      return {
        project: 'construction',
        result: {
          reply: aiReply,
          nextStep: 'completed',
          data: session?.data || {}
        }
      };
    }

    // Если ИИ не ответил — перезапускаем сценарий
    return {
      project: 'construction',
      result: handleConstruction('', {})
    };
  }

  // Для свободных вопросов вне жёсткой анкеты — ИИ
  if (shouldUseAI(text, session)) {
    const aiReply = await getAIReply({
      message: text,
      session
    });

    if (aiReply) {
      return {
        project: 'construction',
        result: {
          reply: aiReply,
          nextStep: session?.step || 'start',
          data: session?.data || {}
        }
      };
    }
  }

  // Основной сценарий
  return {
    project: 'construction',
    result: handleConstruction(text, session || {})
  };
}

module.exports = { routeMessage };