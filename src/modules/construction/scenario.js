function normalizeText(text) {
  return (text || '').trim().toLowerCase();
}

function hasAny(text, arr = []) {
  return arr.some((item) => text.includes(item));
}

function cleanPhone(text) {
  return String(text || '').replace(/\D/g, '');
}

function looksLikePhone(text) {
  const n = cleanPhone(text);
  return n.length >= 10 && n.length <= 15;
}

function withData(sessionData, extra = {}) {
  return {
    ...(sessionData || {}),
    ...extra
  };
}

function mainMenuText() {
  return (
    'Подскажите, пожалуйста, что вас сейчас интересует:\n\n' +
    '1. Хочу построить дом / коттедж\n' +
    '2. Нужен ремонт\n' +
    '3. Нужны отдельные строительные работы\n' +
    '4. Хочу посмотреть работы / получить консультацию'
  );
}

function detectMainIntent(message) {
  if (message === '1' || hasAny(message, ['дом', 'коттедж', 'построить', 'строительство'])) {
    return 'house';
  }

  if (message === '2' || hasAny(message, ['ремонт', 'отделка'])) {
    return 'repair';
  }

  if (
    message === '3' ||
    hasAny(message, [
      'фундамент',
      'кровл',
      'фасад',
      'сантех',
      'электрик',
      'забор',
      'брусчат',
      'благо',
      'отдельные работы',
      'строительные работы'
    ])
  ) {
    return 'services';
  }

  if (
    message === '4' ||
    hasAny(message, ['работы', 'инст', 'консультац', 'менедж', '2гис', 'адрес', 'сертифик'])
  ) {
    return 'trust';
  }

  return null;
}

function detectHouseStage(message) {
  if (message === '1' || hasAny(message, ['под ключ'])) return 'Дом под ключ';
  if (message === '2' || hasAny(message, ['короб'])) return 'Коробка дома';
  if (message === '3' || hasAny(message, ['фундамент'])) return 'Фундамент';
  if (message === '4' || hasAny(message, ['консультац'])) return 'Консультация';
  return null;
}

function detectLocation(message) {
  if (message === '1' || hasAny(message, ['астана'])) return 'Астана';
  if (message === '2' || hasAny(message, ['пригород', 'косшы', 'рядом с астаной'])) {
    return 'Пригород / рядом с Астаной';
  }
  if (message === '3' || hasAny(message, ['не выбрали участок', 'ещё не выбрали', 'пока нет участка'])) {
    return 'Пока ещё не выбрали участок';
  }
  if (message === '4' || hasAny(message, ['другой регион', 'регион'])) {
    return 'Другой регион';
  }
  return null;
}

function detectProjectStatus(message) {
  if (message === '1' || hasAny(message, ['да', 'есть'])) return 'Да';
  if (message === '2' || hasAny(message, ['нет', 'нужен проект'])) return 'Нет, нужен проект';
  if (message === '3' || hasAny(message, ['в процессе', 'пока ещё'])) return 'Пока ещё в процессе';
  return null;
}

function detectTiming(message) {
  if (message === '1' || hasAny(message, ['срочно'])) return 'Срочно';
  if (message === '2' || hasAny(message, ['в течение месяца', 'месяц'])) return 'В течение месяца';
  if (message === '3' || hasAny(message, ['1–3', '1-3', '1 3', 'ближайшие'])) {
    return 'В ближайшие 1–3 месяца';
  }
  if (message === '4' || hasAny(message, ['позже'])) return 'Позже';
  return null;
}

function detectBudget(message) {
  if (message === '1' || hasAny(message, ['до 10'])) return 'До 10 млн тг';
  if (message === '2' || hasAny(message, ['10–20', '10-20'])) return '10–20 млн тг';
  if (message === '3' || hasAny(message, ['20–50', '20-50'])) return '20–50 млн тг';
  if (message === '4' || hasAny(message, ['50+'])) return '50+ млн тг';
  if (message === '5' || hasAny(message, ['не знаю', 'пока не знаю'])) return 'Пока не знаю';
  return null;
}

function detectRepairObject(message) {
  if (message === '1' || hasAny(message, ['квартира'])) return 'Квартира';
  if (message === '2' || hasAny(message, ['частный дом', 'дом'])) return 'Частный дом';
  if (message === '3' || hasAny(message, ['коммер', 'помещ'])) return 'Коммерческое помещение';
  return null;
}

function detectRepairType(message) {
  if (message === '1' || hasAny(message, ['под ключ'])) return 'Под ключ';
  if (message === '2' || hasAny(message, ['чернов'])) return 'Черновой';
  if (message === '3' || hasAny(message, ['частич', 'отдельные'])) return 'Частичный / отдельные работы';
  return null;
}

function detectServiceType(message) {
  if (message === '1' || hasAny(message, ['фундамент'])) return 'Фундамент';
  if (message === '2' || hasAny(message, ['кровл'])) return 'Кровля';
  if (message === '3' || hasAny(message, ['фасад'])) return 'Фасад';
  if (message === '4' || hasAny(message, ['сантех'])) return 'Сантехника';
  if (message === '5' || hasAny(message, ['электрик'])) return 'Электрика';
  if (message === '6' || hasAny(message, ['забор'])) return 'Забор';
  if (message === '7' || hasAny(message, ['брусчат'])) return 'Брусчатка';
  if (message === '8' || hasAny(message, ['благо'])) return 'Благоустройство';
  if (message === '9' || hasAny(message, ['другое'])) return 'Другое';
  return null;
}

function detectTrustChoice(message) {
  if (message === '1' || hasAny(message, ['работы', 'инст'])) return 'portfolio';
  if (message === '2' || hasAny(message, ['2гис', 'адрес'])) return 'map';
  if (message === '3' || hasAny(message, ['компан', 'сертифик', 'довер'])) return 'about';
  if (message === '4' || hasAny(message, ['менедж'])) return 'manager';
  if (message === '5' || hasAny(message, ['расч', 'стоим', 'кальк'])) return 'calc';
  return null;
}

function detectCalcType(message) {
  if (message === '1' || hasAny(message, ['фундамент'])) return 'Фундамент';
  if (message === '2' || hasAny(message, ['дом', 'коттедж'])) return 'Дом / коттедж';
  if (message === '3' || hasAny(message, ['ремонт'])) return 'Ремонт';
  if (message === '4' || hasAny(message, ['менедж', 'консультац'])) return 'Консультация менеджера';
  return null;
}

function handleConstruction(text, session = {}) {
  const message = normalizeText(text);
  const step = session.step || 'start';
  const data = session.data || {};

  const INSTAGRAM_URL =
    process.env.INSTAGRAM_URL ||
    'https://www.instagram.com/adil_qurulus?igsh=eTJxdDU2bGJvcjd1';

  const MAP_URL =
    process.env.CONSTRUCTION_2GIS_URL ||
    'https://2gis.kz/astana/geo/70000001102004976';

  const CERT_URL = process.env.CONSTRUCTION_CERTIFICATE_URL || '';

  if (hasAny(message, ['меню', 'назад', 'сначала', 'заново', 'стоп'])) {
    return {
      reply: `Хорошо 👌\n\n${mainMenuText()}`,
      nextStep: 'main_menu',
      data: {}
    };
  }

  if (!text || step === 'start') {
    return {
      reply:
        'Здравствуйте! 👋\n\n' +
        'Вы написали в Adil Qurulus.\n' +
        'Подскажу по строительству, ремонту и отдельным работам.\n\n' +
        mainMenuText(),
      nextStep: 'main_menu',
      data: {}
    };
  }

  if (step === 'main_menu') {
    const intent = detectMainIntent(message);

    if (intent === 'house') {
      return {
        reply:
          'Отлично 👍\n\n' +
          'Что вас интересует на данном этапе?\n' +
          '1. Дом под ключ\n' +
          '2. Коробка дома\n' +
          '3. Фундамент\n' +
          '4. Нужна консультация',
        nextStep: 'house_stage',
        data: withData(data, { direction: 'Строительство дома / коттеджа' })
      };
    }

    if (intent === 'repair') {
      return {
        reply:
          'Хорошо 👌\n\n' +
          'Какой объект планируете ремонтировать?\n' +
          '1. Квартира\n' +
          '2. Частный дом\n' +
          '3. Коммерческое помещение',
        nextStep: 'repair_object',
        data: withData(data, { direction: 'Ремонт' })
      };
    }

    if (intent === 'services') {
      return {
        reply:
          'Понял вас 👍\n\n' +
          'Какие именно работы вас интересуют?\n' +
          '1. Фундамент\n' +
          '2. Кровля\n' +
          '3. Фасад\n' +
          '4. Сантехника\n' +
          '5. Электрика\n' +
          '6. Забор\n' +
          '7. Брусчатка\n' +
          '8. Благоустройство\n' +
          '9. Другое',
        nextStep: 'service_type',
        data: withData(data, { direction: 'Отдельные строительные работы' })
      };
    }

    if (intent === 'trust') {
      return {
        reply:
          'Конечно 👌\n\n' +
          'Что вам удобнее сейчас?\n' +
          '1. Посмотреть наши работы\n' +
          '2. Получить адрес в 2ГИС\n' +
          '3. О компании / доверие\n' +
          '4. Связаться с менеджером\n' +
          '5. Предварительный расчёт',
        nextStep: 'trust_menu',
        data
      };
    }

    return {
      reply:
        'Чтобы не ошибиться, выберите, пожалуйста, один из вариантов:\n\n' +
        mainMenuText(),
      nextStep: 'main_menu',
      data
    };
  }

  if (step === 'house_stage') {
    const houseStage = detectHouseStage(message) || text;

    return {
      reply:
        'Подскажите, пожалуйста, где находится объект или участок?\n' +
        '1. Астана\n' +
        '2. Пригород / рядом с Астаной\n' +
        '3. Пока ещё не выбрали участок\n' +
        '4. Другой регион',
      nextStep: 'house_location',
      data: withData(data, { houseStage })
    };
  }

  if (step === 'house_location') {
    const location = detectLocation(message) || text;

    return {
      reply:
        'Понял вас 👍\n\n' +
        'Есть ли уже проект дома?\n' +
        '1. Да\n' +
        '2. Нет, нужен проект\n' +
        '3. Пока ещё в процессе',
      nextStep: 'house_project',
      data: withData(data, { location })
    };
  }

  if (step === 'house_project') {
    const projectStatus = detectProjectStatus(message) || text;

    return {
      reply:
        'Хорошо 👌\n\n' +
        'Напишите, пожалуйста, примерную площадь дома или размеры объекта.\n' +
        'Например: 10x12, 120 м² и т.д.',
      nextStep: 'house_size',
      data: withData(data, { projectStatus })
    };
  }

  if (step === 'house_size') {
    return {
      reply:
        'Спасибо, этого уже достаточно для ориентира.\n\n' +
        'Когда ориентировочно хотите начать строительство?\n' +
        '1. Срочно\n' +
        '2. В течение месяца\n' +
        '3. В ближайшие 1–3 месяца\n' +
        '4. Позже',
      nextStep: 'house_timing',
      data: withData(data, { size: text })
    };
  }

  if (step === 'house_timing') {
    const timing = detectTiming(message) || text;

    return {
      reply:
        'И ещё сориентируйте, пожалуйста, по бюджету. Можно ориентировочно.\n' +
        '1. До 10 млн тг\n' +
        '2. 10–20 млн тг\n' +
        '3. 20–50 млн тг\n' +
        '4. 50+ млн тг\n' +
        '5. Пока не знаю',
      nextStep: 'house_budget',
      data: withData(data, { timing })
    };
  }

  if (step === 'house_budget') {
    const budget = detectBudget(message) || text;

    return {
      reply:
        'Хорошо, записал 👍\n' +
        'Подскажите, пожалуйста, как к вам можно обращаться?',
      nextStep: 'house_name',
      data: withData(data, { budget })
    };
  }

  if (step === 'house_name') {
    return {
      reply: `Очень приятно, ${text}.\nТеперь напишите, пожалуйста, ваш номер телефона для связи.`,
      nextStep: 'house_phone',
      data: withData(data, { name: text })
    };
  }

  if (step === 'house_phone') {
    const phone = looksLikePhone(text) ? cleanPhone(text) : text;

    return {
      reply:
        'Спасибо 🙌\n\n' +
        'Заявку зафиксировал. Передаю информацию менеджеру — он свяжется с вами, чтобы уточнить детали и подготовить предварительный расчёт.\n\n' +
        `Наши работы:\n${INSTAGRAM_URL}\n\n` +
        `2ГИС:\n${MAP_URL}` +
        (CERT_URL ? `\n\nСертификат:\n${CERT_URL}` : ''),
      nextStep: 'completed',
      data: withData(data, { phone })
    };
  }

  if (step === 'repair_object') {
    const repairObject = detectRepairObject(message) || text;

    return {
      reply:
        'Хорошо 👌\n\n' +
        'Подскажите, пожалуйста, где находится объект?\n' +
        '1. Астана\n' +
        '2. Пригород / рядом с Астаной\n' +
        '3. Другой регион',
      nextStep: 'repair_location',
      data: withData(data, { repairObject })
    };
  }

  if (step === 'repair_location') {
    return {
      reply: 'Напишите, пожалуйста, площадь объекта или примерные размеры.',
      nextStep: 'repair_area',
      data: withData(data, { location: text })
    };
  }

  if (step === 'repair_area') {
    return {
      reply:
        'Какой ремонт вас интересует?\n' +
        '1. Под ключ\n' +
        '2. Черновой\n' +
        '3. Частичный / отдельные работы',
      nextStep: 'repair_type',
      data: withData(data, { area: text })
    };
  }

  if (step === 'repair_type') {
    const repairType = detectRepairType(message) || text;

    return {
      reply:
        'Когда ориентировочно хотите начать?\n' +
        '1. Срочно\n' +
        '2. В течение месяца\n' +
        '3. Позже',
      nextStep: 'repair_timing',
      data: withData(data, { repairType })
    };
  }

  if (step === 'repair_timing') {
    return {
      reply: 'Подскажите, пожалуйста, ваше имя.',
      nextStep: 'repair_name',
      data: withData(data, { timing: text })
    };
  }

  if (step === 'repair_name') {
    return {
      reply: `Очень приятно, ${text}.\nТеперь напишите ваш номер телефона для связи.`,
      nextStep: 'repair_phone',
      data: withData(data, { name: text })
    };
  }

  if (step === 'repair_phone') {
    const phone = looksLikePhone(text) ? cleanPhone(text) : text;

    return {
      reply:
        'Спасибо 🙌\n' +
        'Заявка по ремонту принята. Наш менеджер свяжется с вами для уточнения деталей.',
      nextStep: 'completed',
      data: withData(data, { phone })
    };
  }

  if (step === 'service_type') {
    const serviceType = detectServiceType(message) || text;

    return {
      reply:
        'Понял вас 👍\n\n' +
        'Подскажите, пожалуйста, где находится объект?\n' +
        '1. Астана\n' +
        '2. Пригород / рядом с Астаной\n' +
        '3. Другой регион',
      nextStep: 'service_location',
      data: withData(data, { serviceType })
    };
  }

  if (step === 'service_location') {
    return {
      reply: 'Опишите, пожалуйста, кратко задачу или объём работ.',
      nextStep: 'service_scope',
      data: withData(data, { location: text })
    };
  }

  if (step === 'service_scope') {
    return {
      reply:
        'Есть ли у вас фото, проект или размеры объекта?\n' +
        '1. Да\n' +
        '2. Пока нет\n' +
        '3. Отправлю позже',
      nextStep: 'service_materials',
      data: withData(data, { scope: text })
    };
  }

  if (step === 'service_materials') {
    return {
      reply: 'Подскажите, пожалуйста, ваше имя.',
      nextStep: 'service_name',
      data: withData(data, { materialsInfo: text })
    };
  }

  if (step === 'service_name') {
    return {
      reply: `Очень приятно, ${text}.\nТеперь напишите ваш номер телефона для связи.`,
      nextStep: 'service_phone',
      data: withData(data, { name: text })
    };
  }

  if (step === 'service_phone') {
    const phone = looksLikePhone(text) ? cleanPhone(text) : text;

    return {
      reply:
        'Спасибо 🙌\n' +
        'Ваша заявка принята. Наш специалист свяжется с вами для уточнения деталей.',
      nextStep: 'completed',
      data: withData(data, { phone })
    };
  }

  if (step === 'trust_menu') {
    const choice = detectTrustChoice(message);

    if (choice === 'portfolio') {
      return {
        reply:
          `Вот наша страница с примерами работ:\n${INSTAGRAM_URL}\n\n` +
          'Если захотите, после просмотра помогу оставить заявку или связаться с менеджером.',
        nextStep: 'after_trust',
        data: withData(data, { trustChoice: 'portfolio' })
      };
    }

    if (choice === 'map') {
      return {
        reply:
          `Вот наша компания в 2ГИС:\n${MAP_URL}\n\n` +
          'Если нужно, дальше помогу оставить заявку или быстро связаться с менеджером.',
        nextStep: 'after_trust',
        data: withData(data, { trustChoice: 'map' })
      };
    }

    if (choice === 'about') {
      let reply =
        'Adil Qurulus — строительная компания по Астане и ближайшим пригородам.\n' +
        'Работаем по строительству домов, ремонту и отдельным строительным работам.';

      if (CERT_URL) {
        reply += `\n\nСертификат / подтверждение:\n${CERT_URL}`;
      }

      reply +=
        '\n\nЕсли хотите, могу сразу:\n' +
        '1. Показать наши работы\n' +
        '2. Дать адрес в 2ГИС\n' +
        '3. Связать с менеджером\n' +
        '4. Помочь оставить заявку';

      return {
        reply,
        nextStep: 'after_about',
        data: withData(data, { trustChoice: 'about' })
      };
    }

    if (choice === 'manager') {
      return {
        reply: 'Конечно. Подскажите, пожалуйста, как к вам можно обращаться?',
        nextStep: 'manager_name',
        data: withData(data, { direction: 'Связь с менеджером' })
      };
    }

    if (choice === 'calc') {
      return {
        reply:
          'Что хотите предварительно рассчитать?\n' +
          '1. Фундамент\n' +
          '2. Дом / коттедж\n' +
          '3. Ремонт\n' +
          '4. Нужна консультация менеджера',
        nextStep: 'calc_type',
        data: withData(data, { direction: 'Предварительный расчёт' })
      };
    }

    return {
      reply:
        'Выберите, пожалуйста:\n' +
        '1. Посмотреть наши работы\n' +
        '2. Получить адрес в 2ГИС\n' +
        '3. О компании / доверие\n' +
        '4. Связаться с менеджером\n' +
        '5. Предварительный расчёт',
      nextStep: 'trust_menu',
      data
    };
  }

  if (step === 'after_trust') {
    if (message === '1' || hasAny(message, ['заяв'])) {
      return {
        reply: `Хорошо 👌\n\n${mainMenuText()}`,
        nextStep: 'main_menu',
        data: {}
      };
    }

    if (message === '2' || hasAny(message, ['менедж'])) {
      return {
        reply: 'Подскажите, пожалуйста, как к вам можно обращаться?',
        nextStep: 'manager_name',
        data: withData(data, { direction: 'Связь с менеджером' })
      };
    }

    if (message === '3' || hasAny(message, ['меню', 'назад'])) {
      return {
        reply: `Хорошо 👌\n\n${mainMenuText()}`,
        nextStep: 'main_menu',
        data: {}
      };
    }

    return {
      reply:
        'Если хотите продолжить:\n' +
        '1. Оставить заявку\n' +
        '2. Связаться с менеджером\n' +
        '3. Вернуться в меню',
      nextStep: 'after_trust',
      data
    };
  }

  if (step === 'after_about') {
    if (message === '1' || hasAny(message, ['работы', 'инст'])) {
      return {
        reply: `Вот наша страница с работами:\n${INSTAGRAM_URL}`,
        nextStep: 'after_trust',
        data: withData(data, { trustChoice: 'portfolio' })
      };
    }

    if (message === '2' || hasAny(message, ['2гис', 'адрес'])) {
      return {
        reply: `Вот наша компания в 2ГИС:\n${MAP_URL}`,
        nextStep: 'after_trust',
        data: withData(data, { trustChoice: 'map' })
      };
    }

    if (message === '3' || hasAny(message, ['менедж'])) {
      return {
        reply: 'Подскажите, пожалуйста, как к вам можно обращаться?',
        nextStep: 'manager_name',
        data: withData(data, { direction: 'Связь с менеджером' })
      };
    }

    if (message === '4' || hasAny(message, ['заяв'])) {
      return {
        reply: `Хорошо 👌\n\n${mainMenuText()}`,
        nextStep: 'main_menu',
        data: {}
      };
    }

    return {
      reply:
        'Могу помочь дальше:\n' +
        '1. Показать наши работы\n' +
        '2. Дать адрес в 2ГИС\n' +
        '3. Связать с менеджером\n' +
        '4. Помочь оставить заявку',
      nextStep: 'after_about',
      data
    };
  }

  if (step === 'calc_type') {
    const calcType = detectCalcType(message) || text;

    if (calcType === 'Консультация менеджера') {
      return {
        reply: 'Подскажите, пожалуйста, ваше имя.',
        nextStep: 'manager_name',
        data: withData(data, { direction: 'Консультация по расчёту' })
      };
    }

    return {
      reply:
        'Напишите кратко, что именно хотите рассчитать.\n' +
        'Например:\n' +
        '— фундамент 10x10\n' +
        '— дом 120 м²\n' +
        '— ремонт квартиры 65 м²',
      nextStep: 'calc_request',
      data: withData(data, { calcType })
    };
  }

  if (step === 'calc_request') {
    return {
      reply: 'Подскажите, пожалуйста, ваше имя.',
      nextStep: 'calc_name',
      data: withData(data, { calcRequest: text })
    };
  }

  if (step === 'calc_name') {
    return {
      reply: `Спасибо, ${text}.\nТеперь напишите ваш номер телефона для связи.`,
      nextStep: 'calc_phone',
      data: withData(data, { name: text })
    };
  }

  if (step === 'calc_phone') {
    const phone = looksLikePhone(text) ? cleanPhone(text) : text;

    return {
      reply:
        'Спасибо 🙌\n' +
        'Запрос на расчёт принят. Менеджер свяжется с вами для уточнения деталей.',
      nextStep: 'completed',
      data: withData(data, { phone })
    };
  }

  if (step === 'manager_name') {
    return {
      reply: `Спасибо, ${text}.\nТеперь напишите ваш номер телефона для связи.`,
      nextStep: 'manager_phone',
      data: withData(data, { name: text })
    };
  }

  if (step === 'manager_phone') {
    const phone = looksLikePhone(text) ? cleanPhone(text) : text;

    return {
      reply:
        'Спасибо 🙌\n' +
        'Передаю вашу заявку менеджеру. С вами свяжутся в ближайшее время.',
      nextStep: 'completed',
      data: withData(data, { phone })
    };
  }

  if (step === 'completed') {
    if (hasAny(message, ['новый вопрос', 'ещё вопрос', 'другой вопрос', 'меню', 'заново'])) {
      return {
        reply: `Конечно 👌\n\n${mainMenuText()}`,
        nextStep: 'main_menu',
        data: {}
      };
    }

    return {
      reply:
        'Ваша заявка уже принята 🙌\n' +
        'Если появится новый вопрос — просто напишите, и я помогу дальше.',
      nextStep: 'completed',
      data
    };
  }

  return {
    reply:
      'Я вас понял, но чтобы не ошибиться, напишите, пожалуйста, чуть подробнее или выберите нужный вариант из меню.\n\n' +
      mainMenuText(),
    nextStep: 'main_menu',
    data: {}
  };
}

module.exports = { handleConstruction };
