function normalizeText(text) {
  return (text || "").trim().toLowerCase();
}

function handleClinic(text, session = {}) {
  const message = normalizeText(text);
  const step = session.step || "start";

  // Первый вход
  if (!text || step === "start") {
    return {
      reply:
        "Здравствуйте! 🌸 Меня зовут Алия.\nПодскажите, пожалуйста, из какого вы города?",
      nextStep: "ask_city",
    };
  }

  // Шаг 1 — город
  if (step === "ask_city") {
    return {
      reply:
        `Спасибо 🌿\nВаш город: ${text}\n\n` +
        "Подскажите, пожалуйста, что вас интересует?\n" +
        "1. Пересадка волос\n" +
        "2. Пересадка бороды\n" +
        "3. Пересадка бровей\n" +
        "4. Пересадка ресниц\n" +
        "5. Консультация",
      nextStep: "ask_service",
      data: {
        city: text,
      },
    };
  }

  // Шаг 2 — выбор услуги
  if (step === "ask_service") {
    let service = text;

    if (message === "1" || message.includes("волос")) {
      service = "Пересадка волос";
    } else if (message === "2" || message.includes("бород")) {
      service = "Пересадка бороды";
    } else if (message === "3" || message.includes("бров")) {
      service = "Пересадка бровей";
    } else if (message === "4" || message.includes("ресниц")) {
      service = "Пересадка ресниц";
    } else if (message === "5" || message.includes("консульта")) {
      service = "Консультация";
    }

    return {
      reply:
        `Поняла вас 🌸\nИнтересует: ${service}\n\n` +
        "Подскажите, пожалуйста, вы уже были на консультации ранее?\n" +
        "1. Да\n" +
        "2. Нет",
      nextStep: "ask_consultation",
      data: {
        service,
      },
    };
  }

  // Шаг 3 — была ли консультация
  if (step === "ask_consultation") {
    let consultation = text;

    if (message === "1" || message === "да") {
      consultation = "Да";
    } else if (message === "2" || message === "нет") {
      consultation = "Нет";
    }

    return {
      reply:
        "Спасибо 🙏\n" +
        "Для предварительной оценки можете отправить фото проблемной зоны.\n" +
        "Лицо полностью отправлять не обязательно.\n\n" +
        "Если готовы, отправьте фото сейчас.\n" +
        "Если пока не готовы, просто напишите: позже",
      nextStep: "ask_photo",
      data: {
        hadConsultation: consultation,
      },
    };
  }

  // Шаг 4 — фото
  if (step === "ask_photo") {
    if (message.includes("позже")) {
      return {
        reply:
          "Хорошо 🌿\nТогда подскажите, пожалуйста, как к вам можно обратиться? Напишите ваше имя.",
        nextStep: "ask_name",
        data: {
          photoStatus: "Отправит позже",
        },
      };
    }

    return {
      reply:
        "Фото получила, спасибо 🌸\n" +
        "Теперь подскажите, пожалуйста, как к вам можно обращаться? Напишите ваше имя.",
      nextStep: "ask_name",
      data: {
        photoStatus: "Фото получено",
      },
    };
  }

  // Шаг 5 — имя
  if (step === "ask_name") {
    return {
      reply:
        `Очень приятно, ${text} 🌿\n` +
        "Подскажите, пожалуйста, ваш номер телефона для записи и связи.",
      nextStep: "ask_phone",
      data: {
        name: text,
      },
    };
  }

  // Шаг 6 — телефон
  if (step === "ask_phone") {
    return {
      reply:
        "Спасибо 🙌\n" +
        "Когда вам было бы удобно прийти на консультацию?\n" +
        "1. Сегодня\n" +
        "2. Завтра\n" +
        "3. В ближайшие дни\n" +
        "4. Нужна сначала консультация по переписке",
      nextStep: "ask_visit_time",
      data: {
        phone: text,
      },
    };
  }

  // Шаг 7 — время визита
  if (step === "ask_visit_time") {
    let visitTime = text;

    if (message === "1") {
      visitTime = "Сегодня";
    } else if (message === "2") {
      visitTime = "Завтра";
    } else if (message === "3") {
      visitTime = "В ближайшие дни";
    } else if (message === "4") {
      visitTime = "Нужна сначала консультация по переписке";
    }

    return {
      reply:
        "Спасибо 🌸\n" +
        "Наша клиника работает ежедневно с 09:00 до 20:00.\n\n" +
        "Вот наш Instagram:\n" +
        "ВСТАВЬ_ССЫЛКУ_НА_INSTAGRAM\n\n" +
        "Также отправляю адрес:\n" +
        "ВСТАВЬ_ССЫЛКУ_2GIS\n\n" +
        "Передаю вашу заявку менеджеру. С вами свяжутся для подтверждения записи 🙌",
      nextStep: "completed",
      data: {
        visitTime,
      },
    };
  }

  // Завершённый сценарий
  if (step === "completed") {
    return {
      reply:
        "Ваша заявка уже принята 🌿\nЕсли хотите, можете написать новый вопрос, и я помогу дальше.",
      nextStep: "completed",
    };
  }

  // Запасной ответ
  return {
    reply:
      "Извините, я не совсем поняла ваш ответ.\nПожалуйста, напишите сообщение ещё раз, и я помогу 🌸",
    nextStep: step,
  };
}

module.exports = { handleClinic };