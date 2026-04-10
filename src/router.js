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

function isResetCommand(text) {
  const t = normalizeText(text);
  return ['меню', 'назад', 'заново', 'сначала', 'стоп'].includes(t);
}

function looksLikeLeadIntent(text) {
  const t = normalizeText(text);

  return (
    t.includes('хочу построить') ||
    t.includes('хочу дом') ||
    t.includes('нужен дом') ||
    t.includes('нужен ремонт') ||
    t.includes('нужен расчет') ||
    t.includes('нужен расчёт') ||
    t.includes('хочу расчет') ||
    t.includes('хочу расчёт') ||
    t.includes('хочу консультацию') ||
    t.includes('нужна консультация') ||
    t.includes('проект есть') ||
    t.includes('участок есть') ||
    t.includes('фундамент нужен')
  );
}

function shouldUseAI(message, session) {
  const text = normalizeText(message);
  const step = session?.step || 'start';

  // После completed — да
  if (step === 'completed') return true;

  // Если уже в AI-диалоге — тоже да
  if (step === 'ai_dialog') return true;

  // Жёсткие шаги анкеты — нет
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

  if (isResetCommand(text)) return false;

  // Простые цифры обычно в сценарий,
  // но если это похоже на свободный лидовый вход — ИИ
  if (/^[1-9]$/.test(text)) return false;

  if (isGreeting(text)) return false;

  if (looksLikeLeadIntent(text)) return true;

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

  // Команды сброса всегда уводят в сценарий
  if (isResetCommand(normalized)) {
    return {
      project: 'construction',
      result: handleConstruction('меню', session || {})
    };
  }

  // После завершённой заявки
  if (session?.step === 'completed') {
    if (isGreeting(normalized)) {
      return {
        project: 'construction',
        result: {
          reply:
            'Здравствуйте 👋\n\n' +
            'Могу помочь дальше по строительству, ремонту или расчёту.\n' +
            'Что вас сейчас интересует?',
          nextStep: 'ai_dialog',
          data: session?.data || {}
        }
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
          nextStep: 'ai_dialog',
          data: session?.data || {}
        }
      };
    }

    return {
      project: 'construction',
      result: {
        reply:
          'Хороший вопрос 👍\n\n' +
          'Подскажу по строительству, ремонту или отдельным работам.\n' +
          'Если хотите, могу сразу сориентировать по вашему объекту или помочь с предварительным расчётом.',
        nextStep: 'ai_dialog',
        data: session?.data || {}
      }
    };
  }

  // Если уже идёт AI-диалог, не сбрасываемся на коротких сообщениях типа 10/18
  if (session?.step === 'ai_dialog') {
    const aiReply = await getAIReply({
      message: text,
      session
    });

    if (aiReply) {
      return {
        project: 'construction',
        result: {
          reply: aiReply,
          nextStep: 'ai_dialog',
          data: session?.data || {}
        }
      };
    }

    return {
      project: 'construction',
      result: {
        reply:
          'Понял вас 👍\n\n' +
          'Могу помочь дальше по вашему объекту. Если хотите, напишите ещё пару деталей — площадь, локацию или что именно хотите рассчитать.',
        nextStep: 'ai_dialog',
        data: session?.data || {}
      }
    };
  }

  // ИИ для свободного входа
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
          nextStep: 'ai_dialog',
          data: session?.data || {}
        }
      };
    }
  }

  // Обычный сценарий
  return {
    project: 'construction',
    result: handleConstruction(text, session || {})
  };
}

module.exports = { routeMessage };