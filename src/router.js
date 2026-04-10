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

function wantsManager(text) {
  const t = normalizeText(text);
  return (
    t.includes('менеджер') ||
    t.includes('свяжите') ||
    t.includes('перезвоните') ||
    t.includes('позвоните') ||
    t.includes('давайте с менеджером') ||
    t.includes('хочу менеджера') ||
    t.includes('нужен менеджер')
  );
}

function looksLikePhone(text) {
  const n = String(text || '').replace(/\D/g, '');
  return n.length >= 10 && n.length <= 15;
}

function looksLikeSize(text) {
  const t = normalizeText(text);
  return (
    /\d+\s*[xх]\s*\d+/.test(t) ||
    /\d+\s*(м2|м²|кв|квадрат)/.test(t) ||
    /^\d+\/\d+$/.test(t)
  );
}

function looksLikeLocation(text) {
  const t = normalizeText(text);
  return (
    t.includes('астана') ||
    t.includes('косшы') ||
    t.includes('пригород') ||
    t.includes('рядом с астаной') ||
    t.includes('район')
  );
}

function extractName(text) {
  const cleaned = String(text || '')
    .replace(/[^\p{L}\s-]/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');

  if (!cleaned) return '';

  const parts = cleaned.split(' ');
  return parts[0] || cleaned;
}

function countLeadSignals(text, session) {
  const t = normalizeText(text);
  let score = 0;

  if (
    t.includes('хочу построить') ||
    t.includes('хочу дом') ||
    t.includes('дом построить') ||
    t.includes('коттедж') ||
    t.includes('дом')
  ) score += 1;

  if (
    t.includes('есть проект') ||
    t.includes('проект есть') ||
    t.includes('есть участок') ||
    t.includes('участок есть')
  ) score += 1;

  if (looksLikeSize(t)) score += 1;
  if (looksLikeLocation(t)) score += 1;

  if (
    t.includes('под ключ') ||
    t.includes('расчет') ||
    t.includes('расчёт') ||
    t.includes('консультац')
  ) score += 1;

  const data = session?.data || {};
  if (data.size) score += 1;
  if (data.location) score += 1;
  if (data.projectStatus) score += 1;
  if (data.direction) score += 1;

  return score;
}

function shouldUseAI(message, session) {
  const text = normalizeText(message);
  const step = session?.step || 'start';

  if (step === 'ai_dialog') return true;

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
    'manager_phone',
    'lead_capture_name',
    'lead_capture_phone'
  ];

  if (lockedSteps.includes(step)) return false;
  if (isResetCommand(text)) return false;
  if (/^[1-9]$/.test(text)) return false;
  if (isGreeting(text)) return false;

  return text.length >= 6;
}

async function routeMessage({ text, session, projectType }) {
  const project = projectType || session?.project || 'construction';
  const normalized = normalizeText(text);
  const currentData = session?.data || {};

  if (project !== 'construction') {
    return {
      project: 'construction',
      result: handleConstruction(text, session || {})
    };
  }

  if (isResetCommand(normalized)) {
    return {
      project: 'construction',
      result: handleConstruction('меню', session || {})
    };
  }

  // Если клиент просит менеджера — сразу идём на сбор контакта
  if (wantsManager(normalized)) {
    if (currentData.name && currentData.phone) {
      return {
        project: 'construction',
        result: {
          reply:
            'Спасибо 🙌\n\n' +
            'Заявка уже зафиксирована и передана менеджеру. Он свяжется с вами в ближайшее время.\n\n' +
            'Если появятся вопросы — можете написать сюда 👍',
          nextStep: 'completed',
          data: currentData
        }
      };
    }

    if (currentData.name && !currentData.phone) {
      return {
        project: 'construction',
        result: {
          reply: 'Отлично 👍 Тогда напишите, пожалуйста, ваш номер телефона для связи.',
          nextStep: 'lead_capture_phone',
          data: currentData
        }
      };
    }

    return {
      project: 'construction',
      result: {
        reply:
          'Отлично 👍 Тогда зафиксирую заявку и передаю менеджеру.\n\n' +
          'Подскажите, пожалуйста, как к вам можно обращаться?',
        nextStep: 'lead_capture_name',
        data: currentData
      }
    };
  }

  // После завершённой заявки уже не крутим клиента по кругу
  if (session?.step === 'completed') {
    return {
      project: 'construction',
      result: {
        reply:
          'Спасибо 🙌\n\n' +
          'Заявка уже передана менеджеру. Он свяжется с вами в ближайшее время.\n\n' +
          'Если появятся вопросы — можете написать здесь 👍',
        nextStep: 'completed',
        data: currentData
      }
    };
  }

  // Сбор имени
  if (session?.step === 'lead_capture_name') {
    const name = extractName(text);

    return {
      project: 'construction',
      result: {
        reply: `${name || 'Отлично'} 👍\nТеперь напишите, пожалуйста, ваш номер телефона для связи.`,
        nextStep: 'lead_capture_phone',
        data: {
          ...currentData,
          name: name || text
        }
      }
    };
  }

  // Сбор телефона и завершение
  if (session?.step === 'lead_capture_phone') {
    if (looksLikePhone(text)) {
      return {
        project: 'construction',
        result: {
          reply:
            'Спасибо 🙌\n\n' +
            'Заявку зафиксировал. Передаю информацию менеджеру — он свяжется с вами, чтобы уточнить детали и подготовить предварительный расчёт.',
          nextStep: 'completed',
          data: {
            ...currentData,
            phone: text.replace(/\D/g, '')
          }
        }
      };
    }

    return {
      project: 'construction',
      result: {
        reply: 'Подскажите, пожалуйста, номер телефона в удобном формате для связи.',
        nextStep: 'lead_capture_phone',
        data: currentData
      }
    };
  }

  // Активный AI-диалог
  if (session?.step === 'ai_dialog') {
    const mergedData = { ...currentData };

    if (looksLikeSize(text)) mergedData.size = text;
    if (looksLikeLocation(text)) mergedData.location = text;
    if (normalized.includes('проект')) mergedData.projectStatus = text;
    if (normalized.includes('дом')) mergedData.direction = 'Строительство дома / коттеджа';

    const signals = countLeadSignals(text, { data: mergedData });

    if (signals >= 3 && !mergedData.name) {
      return {
        project: 'construction',
        result: {
          reply:
            'Отлично, уже можно предметно передать ваш запрос менеджеру 👍\n\n' +
            'Подскажите, пожалуйста, как к вам можно обращаться?',
          nextStep: 'lead_capture_name',
          data: mergedData
        }
      };
    }

    const aiReply = await getAIReply({
      message: text,
      session: {
        ...session,
        data: mergedData
      }
    });

    if (aiReply) {
      return {
        project: 'construction',
        result: {
          reply: aiReply,
          nextStep: 'ai_dialog',
          data: mergedData
        }
      };
    }

    return {
      project: 'construction',
      result: {
        reply:
          'Понял вас 👍\n\n' +
          'Если хотите, могу помочь быстро сориентироваться по вашему объекту — напишите площадь, локацию и что именно планируете делать.',
        nextStep: 'ai_dialog',
        data: mergedData
      }
    };
  }

  // Свободный вход -> ИИ
  if (shouldUseAI(text, session)) {
    const mergedData = { ...currentData };

    if (looksLikeSize(text)) mergedData.size = text;
    if (looksLikeLocation(text)) mergedData.location = text;
    if (normalized.includes('проект')) mergedData.projectStatus = text;
    if (normalized.includes('дом')) mergedData.direction = 'Строительство дома / коттеджа';

    const signals = countLeadSignals(text, { data: mergedData });

    if (signals >= 3 && !mergedData.name) {
      return {
        project: 'construction',
        result: {
          reply:
            'Хорошо, уже есть базовое понимание по вашему объекту 👍\n\n' +
            'Чтобы я передал запрос менеджеру, подскажите, пожалуйста, как к вам можно обращаться?',
          nextStep: 'lead_capture_name',
          data: mergedData
        }
      };
    }

    const aiReply = await getAIReply({
      message: text,
      session: {
        ...session,
        data: mergedData
      }
    });

    if (aiReply) {
      return {
        project: 'construction',
        result: {
          reply: aiReply,
          nextStep: 'ai_dialog',
          data: mergedData
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