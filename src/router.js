const { handleConstruction } = require('./modules/construction/scenario');
const { getAIReply } = require('./services/ai.service');

function normalizeText(text) {
  return (text || '').trim().toLowerCase();
}

function shouldUseAI(message, session) {
  const text = normalizeText(message);
  const step = session?.step || 'start';

  // Если человек в середине анкеты/воронки, не мешаем сценарию
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
    'calc_type',
    'calc_request',
    'calc_name',
    'calc_phone',
    'manager_name',
    'manager_phone'
  ];

  if (lockedSteps.includes(step)) return false;

  // Цифровое меню — тоже в сценарий
  if (/^[1-9]$/.test(text)) return false;

  // Явные сценарные команды — тоже в сценарий
  if (
    ['меню', 'назад', 'заново', 'сначала', 'стоп'].includes(text)
  ) {
    return false;
  }

  // ИИ включаем для свободных вопросов
  if (text.length >= 8) return true;

  return false;
}

async function routeMessage({ text, from, session, projectType }) {
  const project = projectType || session?.project || 'construction';

  if (project === 'construction') {
    if (shouldUseAI(text, session)) {
      const aiReply = await getAIReply({
        message: text,
        session
      });

      if (aiReply) {
        return {
          project,
          result: {
            reply: aiReply,
            nextStep: session?.step || 'start',
            data: session?.data || {}
          }
        };
      }
    }

    return {
      project,
      result: handleConstruction(text, session || {})
    };
  }

  return {
    project: 'construction',
    result: handleConstruction(text, session || {})
  };
}

module.exports = { routeMessage };