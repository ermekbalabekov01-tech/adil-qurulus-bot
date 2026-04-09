function normalizeText(text) {
  return (text || '').trim().toLowerCase();
}

function pickOption(message, optionsMap = {}) {
  if (optionsMap[message]) return optionsMap[message];

  for (const key of Object.keys(optionsMap)) {
    if (message.includes(key)) return optionsMap[key];
  }

  return null;
}

function handleConstruction(text, session = {}) {
  const message = normalizeText(text);
  const step = session.step || 'start';

  const INSTAGRAM_URL = 'https://www.instagram.com/adil_qurulus?igsh=eTJxdDU2bGJvcjd1';
  const MAP_URL = 'https://2gis.kz/astana/geo/70000001102004976';

  // =========================
  // START
  // =========================
  if (!text || step === 'start') {
    return {
      reply:
        'Здравствуйте! 👋\n\n' +
        'Спасибо за обращение в строительную компанию Adil Qurulus.\n' +
        'Подскажите, пожалуйста, что сейчас для вас актуально?\n\n' +
        '1. Строительство дома / коттеджа\n' +
        '2. Ремонт\n' +
        '3. Отдельные строительные работы\n' +
        '4. Хочу посмотреть работы / получить консультацию',
      nextStep: 'main_menu',
    };
  }

  // =========================
  // MAIN MENU
  // =========================
  if (step === 'main_menu') {
    const selected = pickOption(message, {
      '1': 'house',
      'дом': 'house',
      'коттедж': 'house',
      'строитель': 'house',

      '2': 'repair',
      'ремонт': 'repair',

      '3': 'services',
      'работ': 'services',
      'фундамент': 'services',
      'кровл': 'services',
      'фасад': 'services',
      'электрик': 'services',
      'сантех': 'services',
      'забор': 'services',
      'брусчат': 'services',

      '4': 'trust',
      'работы': 'trust',
      'инст': 'trust',
      'консульт': 'trust',
      'сертифик': 'trust',
      'довер': 'trust',
      'менедж': 'trust',
    });

    if (selected === 'house') {
      return {
        reply:
          'Отлично 👍\n' +
          'Поможем по строительству дома.\n\n' +
          'Подскажите, пожалуйста, что вас интересует на данном этапе?\n' +
          '1. Дом под ключ\n' +
          '2. Коробка дома\n' +
          '3. Фундамент\n' +
          '4. Нужна консультация',
        nextStep: 'house_interest',
        data: { direction: 'Строительство дома / коттеджа' },
      };
    }

    if (selected === 'repair') {
      return {
        reply:
          'Понял вас 👍\n' +
          'Подскажите, пожалуйста, какой объект планируете ремонтировать?\n' +
          '1. Квартира\n' +
          '2. Частный дом\n' +
          '3. Коммерческое помещение',
        nextStep: 'repair_object',
        data: { direction: 'Ремонт' },
      };
    }

    if (selected === 'services') {
      return {
        reply:
          'Хорошо 👌\n' +
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
        data: { direction: 'Отдельные строительные работы' },
      };
    }

    if (selected === 'trust') {
      return {
        reply:
          'Хорошо.\n' +
          'Что вам удобнее сейчас?\n' +
          '1. Посмотреть наши работы\n' +
          '2. Получить адрес в 2ГИС\n' +
          '3. О компании и доверии\n' +
          '4. Связаться с менеджером\n' +
          '5. Предварительный расчёт',
        nextStep: 'trust_menu',
      };
    }

    return {
      reply:
        'Подскажите, пожалуйста, что вас интересует:\n' +
        '1. Строительство дома / коттеджа\n' +
        '2. Ремонт\n' +
        '3. Отдельные строительные работы\n' +
        '4. Хочу посмотреть работы / получить консультацию',
      nextStep: 'main_menu',
    };
  }

  // =========================
  // TRUST MENU
  // =========================
  if (step === 'trust_menu') {
    const selected = pickOption(message, {
      '1': 'portfolio',
      'работы': 'portfolio',
      'инст': 'portfolio',

      '2': 'map',
      '2гис': 'map',
      'адрес': 'map',

      '3': 'about',
      'компан': 'about',
      'сертифик': 'about',
      'довер': 'about',
      'союз': 'about',

      '4': 'manager',
      'менедж': 'manager',

      '5': 'calc',
      'расч': 'calc',
      'стоим': 'calc',
      'кальк': 'calc',
    });

    if (selected === 'portfolio') {
      return {
        reply:
          'Вот наша страница с работами и объектами:\n' +
          `${INSTAGRAM_URL}\n\n` +
          'Можете посмотреть примеры выполненных работ.\n' +
          'Если захотите, после этого помогу оставить заявку.',
        nextStep: 'after_portfolio',
      };
    }

    if (selected === 'map') {
      return {
        reply:
          'Вот наша компания в 2ГИС:\n' +
          `${MAP_URL}\n\n` +
          'Если захотите, дальше помогу оставить заявку или связать вас с менеджером.',
        nextStep: 'after_map',
      };
    }

    if (selected === 'about') {
      return {
        reply:
          'Adil Qurulus — строительная компания по Астане и ближайшим пригородам.\n\n' +
          'Выполняем строительство домов, ремонт и отдельные строительные работы.\n' +
          'Компания состоит в Союзе строителей Казахстана.\n\n' +
          'Могу дальше:\n' +
          '1. Показать наши работы\n' +
          '2. Дать адрес в 2ГИС\n' +
          '3. Связать с менеджером\n' +
          '4. Помочь оставить заявку',
        nextStep: 'after_about',
      };
    }

    if (selected === 'manager') {
      return {
        reply:
          'Хорошо.\n' +
          'Подскажите, пожалуйста, как к вам можно обращаться?',
        nextStep: 'manager_name',
        data: { direction: 'Связь с менеджером' },
      };
    }

    if (selected === 'calc') {
      return {
        reply:
          'Что хотите предварительно рассчитать?\n' +
          '1. Фундамент\n' +
          '2. Дом / коттедж\n' +
          '3. Ремонт\n' +
          '4. Нужна консультация менеджера',
        nextStep: 'calculation_type',
        data: { direction: 'Предварительный расчёт' },
      };
    }

    return {
      reply:
        'Выберите, пожалуйста:\n' +
        '1. Посмотреть наши работы\n' +
        '2. Получить адрес в 2ГИС\n' +
        '3. О компании и доверии\n' +
        '4. Связаться с менеджером\n' +
        '5. Предварительный расчёт',
      nextStep: 'trust_menu',
    };
  }

  // =========================
  // AFTER PORTFOLIO
  // =========================
  if (step === 'after_portfolio') {
    const selected = pickOption(message, {
      '1': 'lead',
      'заяв': 'lead',
      '2': 'manager',
      'менедж': 'manager',
      '3': 'menu',
      'назад': 'menu',
      'меню': 'menu',
    });

    if (selected === 'lead') {
      return {
        reply:
          'Хорошо.\nЧто вас интересует?\n' +
          '1. Строительство дома / коттеджа\n' +
          '2. Ремонт\n' +
          '3. Отдельные строительные работы\n' +
          '4. Хочу посмотреть работы / получить консультацию',
        nextStep: 'main_menu',
      };
    }

    if (selected === 'manager') {
      return {
        reply: 'Подскажите, пожалуйста, как к вам можно обращаться?',
        nextStep: 'manager_name',
        data: { direction: 'Связь с менеджером' },
      };
    }

    if (selected === 'menu') {
      return {
        reply:
          'Хорошо, возвращаемся.\n' +
          '1. Строительство дома / коттеджа\n' +
          '2. Ремонт\n' +
          '3. Отдельные строительные работы\n' +
          '4. Хочу посмотреть работы / получить консультацию',
        nextStep: 'main_menu',
      };
    }

    return {
      reply:
        'Если захотите продолжить, можете выбрать:\n' +
        '1. Оставить заявку\n' +
        '2. Связаться с менеджером\n' +
        '3. Вернуться в меню',
      nextStep: 'after_portfolio',
    };
  }

  // =========================
  // AFTER MAP
  // =========================
  if (step === 'after_map') {
    const selected = pickOption(message, {
      '1': 'lead',
      'заяв': 'lead',
      '2': 'manager',
      'менедж': 'manager',
      '3': 'portfolio',
      'работы': 'portfolio',
      'инст': 'portfolio',
    });

    if (selected === 'lead') {
      return {
        reply:
          'Хорошо.\nЧто вас интересует?\n' +
          '1. Строительство дома / коттеджа\n' +
          '2. Ремонт\n' +
          '3. Отдельные строительные работы\n' +
          '4. Хочу посмотреть работы / получить консультацию',
        nextStep: 'main_menu',
      };
    }

    if (selected === 'manager') {
      return {
        reply: 'Подскажите, пожалуйста, как к вам можно обращаться?',
        nextStep: 'manager_name',
        data: { direction: 'Связь с менеджером' },
      };
    }

    if (selected === 'portfolio') {
      return {
        reply:
          'Вот наша страница с работами:\n' +
          `${INSTAGRAM_URL}`,
        nextStep: 'after_portfolio',
      };
    }

    return {
      reply:
        'Выберите, пожалуйста:\n' +
        '1. Оставить заявку\n' +
        '2. Связаться с менеджером\n' +
        '3. Посмотреть наши работы',
      nextStep: 'after_map',
    };
  }

  // =========================
  // AFTER ABOUT
  // =========================
  if (step === 'after_about') {
    const selected = pickOption(message, {
      '1': 'portfolio',
      'работы': 'portfolio',
      'инст': 'portfolio',
      '2': 'map',
      '2гис': 'map',
      'адрес': 'map',
      '3': 'manager',
      'менедж': 'manager',
      '4': 'lead',
      'заяв': 'lead',
    });

    if (selected === 'portfolio') {
      return {
        reply:
          'Вот наша страница с работами:\n' +
          `${INSTAGRAM_URL}`,
        nextStep: 'after_portfolio',
      };
    }

    if (selected === 'map') {
      return {
        reply:
          'Вот наша компания в 2ГИС:\n' +
          `${MAP_URL}`,
        nextStep: 'after_map',
      };
    }

    if (selected === 'manager') {
      return {
        reply: 'Подскажите, пожалуйста, как к вам можно обращаться?',
        nextStep: 'manager_name',
        data: { direction: 'Связь с менеджером' },
      };
    }

    if (selected === 'lead') {
      return {
        reply:
          'Хорошо.\nЧто вас интересует?\n' +
          '1. Строительство дома / коттеджа\n' +
          '2. Ремонт\n' +
          '3. Отдельные строительные работы\n' +
          '4. Хочу посмотреть работы / получить консультацию',
        nextStep: 'main_menu',
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
    };
  }

  // =========================
  // HOUSE FLOW
  // =========================
  if (step === 'house_interest') {
    const selected = pickOption(message, {
      '1': 'Дом под ключ',
      'под ключ': 'Дом под ключ',
      '2': 'Коробка дома',
      'короб': 'Коробка дома',
      '3': 'Фундамент',
      'фундамент': 'Фундамент',
      '4': 'Консультация',
      'консульт': 'Консультация',
    });

    return {
      reply:
        'Чтобы правильно сориентировать вас по выезду и расчёту, подскажите, пожалуйста, где находится объект или участок?\n' +
        '1. Астана\n' +
        '2. Пригород / рядом с Астаной\n' +
        '3. Пока ещё не выбрали участок\n' +
        '4. Другой регион',
      nextStep: 'house_location',
      data: { houseInterest: selected || text },
    };
  }

  if (step === 'house_location') {
    const selected = pickOption(message, {
      '1': 'Астана',
      'астана': 'Астана',
      '2': 'Пригород / рядом с Астаной',
      'пригород': 'Пригород / рядом с Астаной',
      '3': 'Пока ещё не выбрали участок',
      'не выбрали': 'Пока ещё не выбрали участок',
      '4': 'Другой регион',
      'друг': 'Другой регион',
    });

    return {
      reply:
        'Понял вас.\nЕсть ли уже проект дома?\n' +
        '1. Да\n' +
        '2. Нет, нужен проект\n' +
        '3. Пока ещё в процессе',
      nextStep: 'house_project',
      data: { location: selected || text },
    };
  }

  if (step === 'house_project') {
    const selected = pickOption(message, {
      '1': 'Да',
      'да': 'Да',
      '2': 'Нет, нужен проект',
      'нет': 'Нет, нужен проект',
      '3': 'Пока ещё в процессе',
      'процес': 'Пока ещё в процессе',
    });

    return {
      reply:
        'Хорошо.\nНапишите, пожалуйста, примерную площадь дома или размеры объекта.\n' +
        'Например: 10x12, 120 м2 и т.д.',
      nextStep: 'house_size',
      data: { hasProject: selected || text },
    };
  }

  if (step === 'house_size') {
    return {
      reply:
        'Спасибо, этого уже достаточно для ориентира.\n' +
        'Когда ориентировочно хотите начать строительство?\n' +
        '1. Срочно\n' +
        '2. В течение месяца\n' +
        '3. В ближайшие 1–3 месяца\n' +
        '4. Позже',
      nextStep: 'house_start_time',
      data: { size: text },
    };
  }

  if (step === 'house_start_time') {
    const selected = pickOption(message, {
      '1': 'Срочно',
      '2': 'В течение месяца',
      '3': 'В ближайшие 1–3 месяца',
      '4': 'Позже',
    });

    return {
      reply:
        'И ещё сориентируйте, пожалуйста, по бюджету. Можно ориентировочно.\n' +
        '1. До 10 млн тг\n' +
        '2. 10–20 млн тг\n' +
        '3. 20–50 млн тг\n' +
        '4. 50+ млн тг\n' +
        '5. Пока не знаю',
      nextStep: 'house_budget',
      data: { startTime: selected || text },
    };
  }

  if (step === 'house_budget') {
    const selected = pickOption(message, {
      '1': 'До 10 млн тг',
      '2': '10–20 млн тг',
      '3': '20–50 млн тг',
      '4': '50+ млн тг',
      '5': 'Пока не знаю',
    });

    return {
      reply:
        'Хорошо, записал.\nПодскажите, пожалуйста, как к вам можно обращаться?',
      nextStep: 'house_name',
      data: { budget: selected || text },
    };
  }

  if (step === 'house_name') {
    return {
      reply:
        `Очень приятно, ${text}.\nТеперь напишите, пожалуйста, ваш номер телефона для связи.`,
      nextStep: 'house_phone',
      data: { name: text },
    };
  }

  if (step === 'house_phone') {
    return {
      reply:
        'Спасибо, заявку зафиксировал 🙌\n' +
        'Передаю информацию менеджеру. Он свяжется с вами, чтобы уточнить детали и подготовить предварительный расчёт.\n\n' +
        'Пока можете посмотреть наши работы:\n' +
        `${INSTAGRAM_URL}\n\n` +
        'И наша локация в 2ГИС:\n' +
        `${MAP_URL}`,
      nextStep: 'completed',
      data: { phone: text },
    };
  }

  // =========================
  // REPAIR FLOW
  // =========================
  if (step === 'repair_object') {
    const selected = pickOption(message, {
      '1': 'Квартира',
      'квартир': 'Квартира',
      '2': 'Частный дом',
      'дом': 'Частный дом',
      '3': 'Коммерческое помещение',
      'коммер': 'Коммерческое помещение',
    });

    return {
      reply:
        'Хорошо.\nПодскажите, пожалуйста, где находится объект?\n' +
        '1. Астана\n' +
        '2. Пригород / рядом с Астаной\n' +
        '3. Другой регион',
      nextStep: 'repair_location',
      data: { repairObject: selected || text },
    };
  }

  if (step === 'repair_location') {
    const selected = pickOption(message, {
      '1': 'Астана',
      '2': 'Пригород / рядом с Астаной',
      '3': 'Другой регион',
    });

    return {
      reply:
        'Напишите, пожалуйста, площадь объекта или примерные размеры.',
      nextStep: 'repair_area',
      data: { location: selected || text },
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
      data: { area: text },
    };
  }

  if (step === 'repair_type') {
    const selected = pickOption(message, {
      '1': 'Под ключ',
      '2': 'Черновой',
      '3': 'Частичный / отдельные работы',
    });

    return {
      reply:
        'Когда ориентировочно хотите начать?\n' +
        '1. Срочно\n' +
        '2. В течение месяца\n' +
        '3. Позже',
      nextStep: 'repair_start_time',
      data: { repairType: selected || text },
    };
  }

  if (step === 'repair_start_time') {
    const selected = pickOption(message, {
      '1': 'Срочно',
      '2': 'В течение месяца',
      '3': 'Позже',
    });

    return {
      reply:
        'Подскажите, пожалуйста, ваше имя.',
      nextStep: 'repair_name',
      data: { startTime: selected || text },
    };
  }

  if (step === 'repair_name') {
    return {
      reply:
        `Очень приятно, ${text}.\nТеперь напишите ваш номер телефона для связи.`,
      nextStep: 'repair_phone',
      data: { name: text },
    };
  }

  if (step === 'repair_phone') {
    return {
      reply:
        'Спасибо 🙌\n' +
        'Заявка по ремонту принята.\n' +
        'Наш менеджер свяжется с вами для уточнения деталей.',
      nextStep: 'completed',
      data: { phone: text },
    };
  }

  // =========================
  // SERVICES FLOW
  // =========================
  if (step === 'service_type') {
    const selected = pickOption(message, {
      '1': 'Фундамент',
      'фундамент': 'Фундамент',
      '2': 'Кровля',
      'кровл': 'Кровля',
      '3': 'Фасад',
      'фасад': 'Фасад',
      '4': 'Сантехника',
      'сантех': 'Сантехника',
      '5': 'Электрика',
      'электрик': 'Электрика',
      '6': 'Забор',
      'забор': 'Забор',
      '7': 'Брусчатка',
      'брусчат': 'Брусчатка',
      '8': 'Благоустройство',
      'благо': 'Благоустройство',
      '9': 'Другое',
      'другое': 'Другое',
    });

    return {
      reply:
        'Понял вас.\nПодскажите, пожалуйста, где находится объект?\n' +
        '1. Астана\n' +
        '2. Пригород / рядом с Астаной\n' +
        '3. Другой регион',
      nextStep: 'service_location',
      data: { serviceType: selected || text },
    };
  }

  if (step === 'service_location') {
    const selected = pickOption(message, {
      '1': 'Астана',
      '2': 'Пригород / рядом с Астаной',
      '3': 'Другой регион',
    });

    return {
      reply:
        'Опишите, пожалуйста, кратко задачу или объём работ.',
      nextStep: 'service_volume',
      data: { location: selected || text },
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
      data: { volume: text },
    };
  }

  if (step === 'service_materials') {
    const selected = pickOption(message, {
      '1': 'Да',
      '2': 'Пока нет',
      '3': 'Отправлю позже',
    });

    return {
      reply:
        'Подскажите, пожалуйста, ваше имя.',
      nextStep: 'service_name',
      data: { materialsInfo: selected || text },
    };
  }

  if (step === 'service_name') {
    return {
      reply:
        `Очень приятно, ${text}.\nТеперь напишите ваш номер телефона для связи.`,
      nextStep: 'service_phone',
      data: { name: text },
    };
  }

  if (step === 'service_phone') {
    return {
      reply:
        'Спасибо 🙌\n' +
        'Ваша заявка принята.\n' +
        'Наш специалист свяжется с вами для уточнения деталей.',
      nextStep: 'completed',
      data: { phone: text },
    };
  }

  // =========================
  // CALC FLOW
  // =========================
  if (step === 'calculation_type') {
    const selected = pickOption(message, {
      '1': 'Фундамент',
      'фундамент': 'Фундамент',
      '2': 'Дом / коттедж',
      'дом': 'Дом / коттедж',
      'коттедж': 'Дом / коттедж',
      '3': 'Ремонт',
      'ремонт': 'Ремонт',
      '4': 'Менеджер',
      'менедж': 'Менеджер',
    });

    if (selected === 'Фундамент') {
      return {
        reply:
          'Напишите размеры в свободной форме.\n' +
          'Например: 10x10 и центральная линия 10.\n\n' +
          'Позже сюда подключим отдельный калькулятор фундамента.',
        nextStep: 'calc_foundation_request',
        data: { calcType: selected },
      };
    }

    if (selected === 'Дом / коттедж') {
      return {
        reply:
          'Напишите примерную площадь или размеры дома, чтобы менеджер мог сориентировать вас по расчёту.',
        nextStep: 'calc_house_request',
        data: { calcType: selected },
      };
    }

    if (selected === 'Ремонт') {
      return {
        reply:
          'Напишите площадь объекта и какой ремонт вас интересует.',
        nextStep: 'calc_repair_request',
        data: { calcType: selected },
      };
    }

    if (selected === 'Менеджер') {
      return {
        reply: 'Подскажите, пожалуйста, ваше имя.',
        nextStep: 'manager_name',
        data: { direction: 'Консультация по расчёту' },
      };
    }

    return {
      reply:
        'Подскажите, пожалуйста, что хотите рассчитать:\n' +
        '1. Фундамент\n' +
        '2. Дом / коттедж\n' +
        '3. Ремонт\n' +
        '4. Нужна консультация менеджера',
      nextStep: 'calculation_type',
    };
  }

  if (step === 'calc_foundation_request') {
    return {
      reply: 'Подскажите, пожалуйста, ваше имя.',
      nextStep: 'calc_foundation_name',
      data: { calcRequest: text },
    };
  }

  if (step === 'calc_foundation_name') {
    return {
      reply: `Спасибо, ${text}.\nТеперь напишите ваш номер телефона для связи.`,
      nextStep: 'calc_foundation_phone',
      data: { name: text },
    };
  }

  if (step === 'calc_foundation_phone') {
    return {
      reply:
        'Спасибо 🙌\n' +
        'Запрос на расчёт фундамента принят.\n' +
        'Менеджер свяжется с вами и сориентирует по стоимости.',
      nextStep: 'completed',
      data: { phone: text },
    };
  }

  if (step === 'calc_house_request') {
    return {
      reply: 'Подскажите, пожалуйста, ваше имя.',
      nextStep: 'calc_house_name',
      data: { calcRequest: text },
    };
  }

  if (step === 'calc_house_name') {
    return {
      reply: `Спасибо, ${text}.\nТеперь напишите ваш номер телефона для связи.`,
      nextStep: 'calc_house_phone',
      data: { name: text },
    };
  }

  if (step === 'calc_house_phone') {
    return {
      reply:
        'Спасибо 🙌\n' +
        'Запрос на расчёт принят.\n' +
        'Менеджер свяжется с вами для уточнения деталей.',
      nextStep: 'completed',
      data: { phone: text },
    };
  }

  if (step === 'calc_repair_request') {
    return {
      reply: 'Подскажите, пожалуйста, ваше имя.',
      nextStep: 'calc_repair_name',
      data: { calcRequest: text },
    };
  }

  if (step === 'calc_repair_name') {
    return {
      reply: `Спасибо, ${text}.\nТеперь напишите ваш номер телефона для связи.`,
      nextStep: 'calc_repair_phone',
      data: { name: text },
    };
  }

  if (step === 'calc_repair_phone') {
    return {
      reply:
        'Спасибо 🙌\n' +
        'Запрос на расчёт ремонта принят.\n' +
        'Менеджер свяжется с вами для уточнения деталей.',
      nextStep: 'completed',
      data: { phone: text },
    };
  }

  // =========================
  // MANAGER FLOW
  // =========================
  if (step === 'manager_name') {
    return {
      reply:
        `Спасибо, ${text}.\nТеперь напишите ваш номер телефона для связи.`,
      nextStep: 'manager_phone',
      data: { name: text },
    };
  }

  if (step === 'manager_phone') {
    return {
      reply:
        'Спасибо 🙌\n' +
        'Передаю вашу заявку менеджеру. С вами свяжутся в ближайшее время.',
      nextStep: 'completed',
      data: { phone: text },
    };
  }

  // =========================
  // COMPLETED
  // =========================
  if (step === 'completed') {
    return {
      reply:
        'Ваша заявка уже принята.\n' +
        'Если хотите, можете написать новый вопрос, и я помогу дальше.',
      nextStep: 'completed',
    };
  }

  return {
    reply:
      'Извините, я не совсем понял ваш ответ.\n' +
      'Пожалуйста, напишите сообщение ещё раз, и я помогу.',
    nextStep: step,
  };
}

module.exports = { handleConstruction };
