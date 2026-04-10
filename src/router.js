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
    'салем',
    'hello',
    'hi'
  ].includes(t);
}

function shouldUseAI(message, session) {
  const text = normalizeText(message);
  const step = session?.step || 'start';

  if (step === 'completed') return true;

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

  if (/^[1-9]$/.test(text)) return false;

  if (['меню', 'назад', 'заново', 'сначала', 'стоп'].includes(text)) {
    return false;
  }

  if (isGreeting(text)) return false;

  if (text.length >= 8) return true;

  return false;
}

async function routeMessage({ text, session, projectType }) {
  const project = projectType || session?.project || 'construction';
  const normalized = normalizeText(text);

  if (project !== 'construction') {
    return {
      project: 'construction',
      result: handleConstruction(text, session || {})
    };
  }

  // После завершённой заявки:
  // 1) команды меню/заново -> в сценарий
  // 2) приветствие -> начинаем заново живо
  // 3) свободный вопрос -> пробуем ИИ
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

    return {
      project: 'construction',
      result: handleConstruction('', {})
    };
  }

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

  return {
    project: 'construction',
    result: handleConstruction(text, session || {})
  };
}

module.exports = { routeMessage };