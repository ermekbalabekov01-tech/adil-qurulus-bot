const { handleConstruction } = require('./modules/construction/scenario');
const { getAIReply } = require('./services/ai.service');

function normalizeText(text) {
  return (text || '').trim().toLowerCase();
}

function isGreeting(text) {
  const t = normalizeText(text);
  return [
    'привет',
    'здравствуйте',
    'добрый день',
    'добрый вечер',
    'салам',
    'салем',
    'hello',
    'hi'
  ].includes(t);
}

function shouldUseAI(message, session) {
  const text = normalizeText(message);
  const step = session?.step || 'start';

  // После завершённой заявки — свободные вопросы отдаём ИИ
  if (step === 'completed') return true;

  // Внутри анкеты сценарий важнее ИИ
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

  // Кнопочные/цифровые ответы — в сценарий
  if (/^[1-9]$/.test(text)) return false;

  // Команды сброса — в сценарий
  if (['меню', 'назад', 'заново', 'сначала', 'стоп'].includes(text)) {
    return false;
  }

  // Короткие приветствия вне completed — тоже в сценарий
  if (isGreeting(text)) return false;

  // Свободные осмысленные вопросы — в ИИ
  if (text.length >= 8) return true;

  return false;
}

async function routeMessage({ text, session, projectType }) {
  const project = projectType || session?.project || 'construction';
  const normalized = normalizeText(text);

  // Пока всё ведём в стройку
  if (project !== 'construction') {
    return {
      project: 'construction',
      result: handleConstruction(text, session || {})
    };
  }

  // После completed:
  // приветствие -> новый старт
  // меню/назад -> в меню
  // вопрос -> ИИ
  if (session?.step === 'completed') {
    if (['меню', 'назад', 'заново', 'сначала', 'стоп'].includes(normalized)) {
      return {
        project: 'construction',
        result: handleConstruction('меню', session || {})
      };
    }

    if (isGreeting(normalized)) {
      return {
        project: 'construction',
        result: handleConstruction('', {})
      };
    }

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

    // fallback без сброса в сухое меню
    return {
      project: 'construction',
      result: {
        reply:
          'Хороший вопрос 👍\n\n' +
          'Подскажу по строительству, ремонту или отдельным работам.\n' +
          'Если хотите, могу сразу сориентировать по вашему объекту или помочь с предварительным расчётом.',
        nextStep: 'completed',
        data: session?.data || {}
      }
    };
  }

  // ИИ для свободных вопросов вне анкеты
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