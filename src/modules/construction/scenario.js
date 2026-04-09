function normalizeText(text) {
  return (text || '').trim().toLowerCase();
}

function includesAny(message, variants = []) {
  return variants.some((v) => message.includes(v));
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

  // ===== helpers =====
  const backToMenu = () => ({
    reply:
      'Хорошо 👌\n\n' +
      'Подскажите, пожалуйста, что вас сейчас интересует:\n' +
      '1. Строительство дома / коттеджа\n' +
      '2. Ремонт\n' +
      '3. Отдельные строительные работы\n' +
      '4. Посмотреть работы / консультация',
    nextStep: 'main_menu',
    data: {}
  });

  // ===== start =====
  if (!text || step === 'start') {
    return {
      reply:
        'Здравствуйте! 👋\n\n' +
        'Вы написали в строительную компанию Adil Qurulus.\n' +
        'Помогу быстро сориентироваться по строительству, ремонту или отдельным работам.\n\n' +
        'Что вас интересует?\n' +
        '1. Строительство дома / коттеджа\n' +
        '2. Ремонт под ключ\n' +
        '3. Отдельные строительные работы\n' +
        '4. Посмотреть наши работы / получить консультацию',
      nextStep: 'main_menu',
      data: {}
    };
  }

  // ===== main menu =====
  if (step === 'main_menu') {
    if (message === '1' || includesAny(message, ['дом', 'коттедж', 'строитель'])) {
      return {
        reply:
          'Отлично 👍\n\n' +
          'Подскажите, пожалуйста, что вас интересует на данном этапе?\n' +
          '1. Дом под ключ\n' +
          '2. Коробка дома\n' +
          '3. Фундамент\n' +
          '4. Нужна консультация',
        nextStep: 'house_interest',
        data: { direction: 'Строительство дома / коттеджа' }
      };
    }

    if (message === '2' || includesAny(message, ['ремонт'])) {
      return {
        reply:
          'Хорошо 👌\n\n' +
          'Какой объект планируете ремонтировать?\n' +
          '1. Квартира\n' +
          '2. Частный дом\n' +
          '3. Коммерческое помещение',
        nextStep: 'repair_object',
        data: { direction: 'Ремонт' }
      };
    }

    if (
      message === '3' ||
      includesAny(message, [
        'фундамент',
        'кровл',
        'фасад',
        'сантех',
        'электрик',
        'забор',
        'брусчат',
        'работ'
      ])
    ) {
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
        data: { direction: 'Отдельные строительные работы' }
      };
    }

    if (
      message === '4' ||
      includesAny(message, ['работы', 'инст', 'консульт', 'сертифик', 'довер', 'менедж'])
    ) {
      return {
        reply:
          'Хорошо 👌\n\n' +
          'Что вам удобнее сейчас?\n' +
          '1. Посмотреть наши работы\n' +
          '2. Получить адрес в 2ГИС\n' +
          '3. О компании / доверие\n' +
          '4. Связаться с менеджером\n' +
          '5. Предварительный расчёт',
        nextStep: 'trust_menu',
        data: {}
      };
    }

    return backToMenu();
  }

  // ===== trust menu =====
  if (step === 'trust_menu') {
    if (message === '1' || includesAny(message, ['работы', 'инст'])) {
      return {
        reply:
          'Вот наша страница с примерами работ:\n' +
          `${INSTAGRAM_URL}\n\n` +
          'Если захотите, после просмотра помогу оставить заявку или связаться с менеджером.',
        nextStep: 'after_trust',
        data: { trustSource: 'portfolio' }
      };
    }

    if (message === '2' || includesAny(message, ['2гис', 'адрес'])) {
      return {
        reply:
          'Вот наша компания в 2ГИС:\n' +
          `${MAP_URL}\n\n` +
          'Если нужно, дальше помогу оставить заявку или быстро связаться с менеджером.',
        nextStep: 'after_trust',
        data: { trustSource: 'map' }
      };
    }

    if (message === '3' || includesAny(message, ['компан', 'довер', 'сертифик', 'союз'])) {
      let reply =
        'Adil Qurulus — строительная компания по Астане и ближайшим пригородам.\n' +
        'Работаем по строительству домов, ремонту и отдельным строительным работам.\n';

      if (CERT_URL) {
        reply += `\nСертификат / подтверждение:\n${CERT_URL}\n`;
      }

      reply +=
        '\nЕсли хотите, могу сразу:\n' +
        '1. Показать наши работы\n' +
        '2. Дать адрес в 2ГИС\n' +
        '3. Связать с менеджером\n' +
        '4. Помочь оставить заявку';

      return {
        reply,
        nextStep: 'after_about',
        data
      };
    }

    if (message === '4' || includesAny(message, ['менедж'])) {
      return {
        reply: 'Конечно. Подскажите, пожалуйста, как к вам можно обращаться?',
        nextStep: 'manager_name',
        data: { direction: 'Связь с менеджером' }
      };
    }

    if (message === '5' || includesAny(message, ['расч', 'стоим', 'кальк'])) {
      return {
        reply:
          'Что хотите предварительно рассчитать?\n' +
          '1. Фундамент\n' +
          '2. Дом / коттедж\n' +
          '3. Ремонт\n' +
          '4. Нужна консультация менеджера',
        nextStep: 'calculation_type',
        data: { direction: 'Предварительный расчёт' }
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

  // ===== after about =====
  if (step === 'after_about') {
    if (message === '1' || includesAny(message, ['работы', 'инст'])) {
      return {
        reply: `Вот наша страница с работами:\n${INSTAGRAM_URL}`,
        nextStep: 'after_trust',
        data: { trustSource: 'portfolio' }
      };
    }

    if (message === '2' || includesAny(message, ['2гис', 'адрес'])) {
      return {
        reply: `Вот наша компания в 2ГИС:\n${MAP_URL}`,
        nextStep: 'after_trust',
        data: { trustSource: 'map' }
      };
    }

    if (message === '3' || includesAny(message, ['менедж'])) {
      return {
        reply: 'Подскажите, пожалуйста, как к вам можно обращаться?',
        nextStep: 'manager_name',
        data: { direction: 'Связь с менеджером' }
      };
    }

    if (message === '4' || includesAny(message, ['заяв'])) {
      return backToMenu();
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

  // ===== after trust =====
  if (step === 'after_trust') {
    if (message === '1' || includesAny(message, ['заяв'])) {
      return backToMenu();
    }

    if (message === '2' || includesAny(message, ['менедж'])) {
      return {
        reply: 'Подскажите, пожалуйста, как к вам можно обращаться?',
        nextStep: 'manager_name',
        data: { direction: 'Связь с менеджером' }
      };
    }

    if (message === '3' || includesAny(message, ['меню', 'назад'])) {
      return backToMenu();
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

  // ===== house flow =====
  if (step === 'house_interest') {
    let interest = text;

    if (message === '1' || includesAny(message, ['под ключ'])) interest = 'Дом под ключ';
    if (message === '2' || includesAny(message, ['короб'])) interest = 'Коробка дома';
    if (message === '3' || includesAny(message, ['фундамент'])) interest = 'Фундамент';
    if (message === '4' || includesAny(message, ['консульт'])) interest = 'Консультация';

    return {
      reply:
        'Чтобы правильно сориентировать вас по выезду и расчёту, подскажите, пожалуйста, где находится объект или участок?\n' +
        '1. Астана\n' +
        '2. Пригород / рядом с Астаной\n' +
        '3. Пока ещё не выбрали участок\n' +
        '4. Другой регион',
      nextStep: 'house_location',
      data: { ...data, houseInterest: interest }
    };
  }

  if (step === 'house_location') {
    return {
      reply:
        'Понял вас 👍\n\n' +
        'Есть ли уже проект дома?\n' +
        '1. Да\n' +
        '2. Нет, нужен проект\n' +
        '3. Пока ещё в процессе',
      nextStep: 'house_project',
      data: { ...data, location: text }
    };
  }

  if (step === 'house_project') {
    return {
      reply:
        'Хорошо 👌\n\n' +
        'Напишите, пожалуйста, примерную площадь дома или размеры объекта.\n' +
        'Например: 10x12, 120 м² и т.д.',
      nextStep: 'house_size',
      data: { ...data, hasProject: text }
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
      nextStep: 'house_start_time',
      data: { ...data, size: text }
    };
  }

  if (step === 'house_start_time') {
    return {
      reply:
        'И ещё сориентируйте, пожалуйста, по бюджету. Можно ориентировочно.\n' +
        '1. До 10 млн тг\n' +
        '2. 10–20 млн тг\n' +
        '3. 20–50 млн тг\n' +
        '4. 50+ млн тг\n' +
        '5. Пока не знаю',
      nextStep: 'house_budget',
      data: { ...data, startTime: text }
    };
  }

  if (step === 'house_budget') {
    return {
      reply:
        'Хорошо, записал 👍\n' +
        'Подскажите, пожалуйста, как к вам можно обращаться?',
      nextStep: 'house_name',
      data: { ...data, budget: text }
    };
  }

  if (step === 'house_name') {
    return {
      reply: `Очень приятно, ${text}.\nТеперь напишите, пожалуйста, ваш номер телефона для связи.`,
      nextStep: 'house_phone',
      data: { ...data, name: text }
    };
  }

  if (step === 'house_phone') {
    return {
      reply:
        'Спасибо 🙌\n\n' +
        'Заявку зафиксировал. Передаю информацию менеджеру — он свяжется с вами, чтобы уточнить детали и подготовить предварительный расчёт.\n\n' +
        `Наши работы:\n${INSTAGRAM_URL}\n\n` +
        `2ГИС:\n${MAP_URL}` +
        (CERT_URL ? `\n\nСертификат:\n${CERT_URL}` : ''),
      nextStep: 'completed',
      data: { ...data, phone: text }
    };
  }

  // ===== repair flow =====
  if (step === 'repair_object') {
    return {
      reply:
        'Хорошо 👌\n\n' +
        'Подскажите, пожалуйста, где находится объект?\n' +
        '1. Астана\n' +
        '2. Пригород / рядом с Астаной\n' +
        '3. Другой регион',
      nextStep: 'repair_location',
      data: { ...data, repairObject: text }
    };
  }

  if (step === 'repair_location') {
    return {
      reply: 'Напишите, пожалуйста, площадь объекта или примерные размеры.',
      nextStep: 'repair_area',
      data: { ...data, location: text }
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
      data: { ...data, area: text }
    };
  }

  if (step === 'repair_type') {
    return {
      reply:
        'Когда ориентировочно хотите начать?\n' +
        '1. Срочно\n' +
        '2. В течение месяца\n' +
        '3. Позже',
      nextStep: 'repair_start_time',
      data: { ...data, repairType: text }
    };
  }

  if (step === 'repair_start_time') {
    return {
      reply: 'Подскажите, пожалуйста, ваше имя.',
      nextStep: 'repair_name',
      data: { ...data, startTime: text }
    };
  }

  if (step === 'repair_name') {
    return {
      reply: `Очень приятно, ${text}.\nТеперь напишите ваш номер телефона для связи.`,
      nextStep: 'repair_phone',
      data: { ...data, name: text }
    };
  }

  if (step === 'repair_phone') {
    return {
      reply:
        'Спасибо 🙌\n' +
        'Заявка по ремонту принята. Наш менеджер свяжется с вами для уточнения деталей.',
      nextStep: 'completed',
      data: { ...data, phone: text }
    };
  }

  // ===== services flow =====
  if (step === 'service_type') {
    return {
      reply:
        'Понял вас 👍\n\n' +
        'Подскажите, пожалуйста, где находится объект?\n' +
        '1. Астана\n' +
        '2. Пригород / рядом с Астаной\n' +
        '3. Другой регион',
      nextStep: 'service_location',
      data: { ...data, serviceType: text }
    };
  }

  if (step === 'service_location') {
    return {
      reply: 'Опишите, пожалуйста, кратко задачу или объём работ.',
      nextStep: 'service_volume',
      data: { ...data, location: text }
    };
  }

  if (step === 'service_volume') {
    return {
      reply:
        'Есть ли у вас фото, проект или размеры объекта?\n' +
        '1. Да\n' +
        '2. Пока нет\n' +
        '3. Отправлю позже',
      nextStep: 'service_materials',
      data: { ...data, volume: text }
    };
  }

  if (step === 'service_materials') {
    return {
      reply: 'Подскажите, пожалуйста, ваше имя.',
      nextStep: 'service_name',
      data: { ...data, materialsInfo: text }
    };
  }

  if (step === 'service_name') {
    return {
      reply: `Очень приятно, ${text}.\nТеперь напишите ваш номер телефона для связи.`,
      nextStep: 'service_phone',
      data: { ...data, name: text }
    };
  }

  if (step === 'service_phone') {
    return {
      reply:
        'Спасибо 🙌\n' +
        'Ваша заявка принята. Наш специалист свяжется с вами для уточнения деталей.',
      nextStep: 'completed',
      data: { ...data, phone: text }
    };
  }

  // ===== calculation flow =====
  if (step === 'calculation_type') {
    if (message === '4' || includesAny(message, ['менедж'])) {
      return {
        reply: 'Подскажите, пожалуйста, ваше имя.',
        nextStep: 'manager_name',
        data: { ...data, direction: 'Консультация по расчёту' }
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
      data: { ...data, calcType: text }
    };
  }

  if (step === 'calc_request') {
    return {
      reply: 'Подскажите, пожалуйста, ваше имя.',
      nextStep: 'calc_name',
      data: { ...data, calcRequest: text }
    };
  }

  if (step === 'calc_name') {
    return {
      reply: `Спасибо, ${text}.\nТеперь напишите ваш номер телефона для связи.`,
      nextStep: 'calc_phone',
      data: { ...data, name: text }
    };
  }

  if (step === 'calc_phone') {
    return {
      reply:
        'Спасибо 🙌\n' +
        'Запрос на расчёт принят. Менеджер свяжется с вами для уточнения деталей.',
      nextStep: 'completed',
      data: { ...data, phone: text }
    };
  }

  // ===== manager flow =====
  if (step === 'manager_name') {
    return {
      reply: `Спасибо, ${text}.\nТеперь напишите ваш номер телефона для связи.`,
      nextStep: 'manager_phone',
      data: { ...data, name: text }
    };
  }

  if (step === 'manager_phone') {
    return {
      reply:
        'Спасибо 🙌\n' +
        'Передаю вашу заявку менеджеру. С вами свяжутся в ближайшее время.',
      nextStep: 'completed',
      data: { ...data, phone: text }
    };
  }

  // ===== completed =====
  if (step === 'completed') {
    return {
      reply:
        'Ваша заявка уже принята.\n' +
        'Если появится новый вопрос — просто напишите, и я помогу дальше.',
      nextStep: 'completed',
      data
    };
  }

  return {
    reply:
      'Извините, я не совсем понял ваш ответ.\n' +
      'Пожалуйста, напишите сообщение ещё раз, и я помогу.',
    nextStep: step,
    data
  };
}

module.exports = { handleConstruction };
