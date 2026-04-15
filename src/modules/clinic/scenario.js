function normalizeText(text) {
  return String(text || "").trim().toLowerCase();
}

function isGreeting(text) {
  const t = normalizeText(text);
  return (
    t.includes("привет") ||
    t.includes("здравствуйте") ||
    t.includes("здраствуйте") ||
    t.includes("добрый день") ||
    t.includes("добрый вечер") ||
    t.includes("доброе утро") ||
    t.includes("салам") ||
    t.includes("салем") ||
    t.includes("сәлем") ||
    t.includes("hello") ||
    t.includes("hi")
  );
}

function isRestart(text) {
  const t = normalizeText(text);
  return (
    t === "привет" ||
    t === "здравствуйте" ||
    t === "заново" ||
    t === "начать заново" ||
    t === "сначала" ||
    t === "/start"
  );
}

function looksLikePhone(text) {
  const n = String(text || "").replace(/\D/g, "");
  return n.length >= 10 && n.length <= 15;
}

function parseName(text) {
  return String(text || "")
    .replace(/[0-9]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseAge(text) {
  const m = String(text || "").match(/(\d{1,2})/);
  if (!m) return null;
  const age = Number(m[1]);
  if (age < 18 || age > 75) return null;
  return age;
}

function parseNameAndAge(text) {
  return {
    name: parseName(text),
    age: parseAge(text),
  };
}

function detectService(text) {
  const t = normalizeText(text);

  if (t.includes("волос")) return "Пересадка волос";
  if (t.includes("бород")) return "Пересадка бороды";
  if (t.includes("бров")) return "Пересадка бровей";
  if (t.includes("ресниц")) return "Пересадка ресниц";
  if (t.includes("консульта")) return "Бесплатная консультация";

  if (t === "1") return "Пересадка волос";
  if (t === "2") return "Пересадка бороды";
  if (t === "3") return "Пересадка бровей";
  if (t === "4") return "Пересадка ресниц";
  if (t === "5") return "Бесплатная консультация";

  return text;
}

function detectConsultationAnswer(text) {
  const t = normalizeText(text);

  if (t === "1" || t === "да" || t.includes("был") || t.includes("была")) return "Да";
  if (t === "2" || t === "нет" || t.includes("не был") || t.includes("не была")) return "Нет";

  return text;
}

function detectPhotoAnswer(text, isImage = false) {
  const t = normalizeText(text);

  if (isImage) {
    return {
      photoReceived: true,
      photoStatus: "Фото получено",
    };
  }

  if (
    t.includes("без фото") ||
    t.includes("позже") ||
    t.includes("потом") ||
    t.includes("не могу фото") ||
    t.includes("неудобно")
  ) {
    return {
      photoReceived: false,
      photoStatus: "Без фото / позже",
    };
  }

  return null;
}

function detectVisitPreference(text) {
  const t = normalizeText(text);

  if (t === "1" || t.includes("сегодня")) return "Сегодня";
  if (t === "2" || t.includes("завтра")) return "Завтра";
  if (t === "3" || t.includes("в ближайшие дни")) return "В ближайшие дни";
  if (t === "4" || t.includes("по переписке")) return "Нужна сначала консультация по переписке";

  return text;
}

function buildFinalReply(data = {}) {
  const instagram = process.env.CLINIC_INSTAGRAM_URL || "ВСТАВЬ_ССЫЛКУ_НА_INSTAGRAM";
  const map = process.env.CLINIC_MAP_URL || "ВСТАВЬ_ССЫЛКУ_2GIS";

  return (
    `Спасибо, ${data.name || "Вам"} 🌸\n\n` +
    "Я зафиксировала вашу заявку и передаю администратору.\n\n" +
    `📍 Город: ${data.city || "-"}\n` +
    `💼 Услуга: ${data.service || "-"}\n` +
    `📅 Когда удобно: ${data.visitTime || "-"}\n\n` +
    "Администратор свяжется с вами для подтверждения записи 🙌\n\n" +
    "Instagram:\n" +
    `${instagram}\n\n` +
    "Адрес:\n" +
    `${map}`
  );
}

function buildSupportReply(text) {
  const t = normalizeText(text);

  if (
    t.includes("когда") ||
    t.includes("во сколько") ||
    t.includes("скоро") ||
    t.includes("жду") ||
    t.includes("свяжутся")
  ) {
    return (
      "Администратор уже получил вашу заявку 👍\n\n" +
      "С вами свяжутся в ближайшее время для подтверждения записи."
    );
  }

  if (
    t.includes("цена") ||
    t.includes("стоимость") ||
    t.includes("сколько") ||
    t.includes("сколько стоит")
  ) {
    return (
      "Поняла вас 🌿\n\n" +
      "Точный ответ по стоимости администратор даст после уточнения деталей."
    );
  }

  return (
    "Я на связи 🌸\n\n" +
    "Если хотите что-то уточнить по записи, можете написать сюда — я передам администратору."
  );
}

function handleClinic(text, session = {}) {
  const step = session.step || "start";
  const message = normalizeText(text);
  const currentData = session.data || {};

  // Рестарт
  if (!text || step === "start" || isRestart(text)) {
    return {
      reply:
        "Здравствуйте! 🌸\n" +
        "Меня зовут Алия.\n\n" +
        "Вы обратились в клинику Dr.Aitimbetova.\n" +
        "С радостью помогу Вам подобрать подходящую процедуру и записаться на консультацию.\n\n" +
        "Подскажите, пожалуйста, из какого Вы города?",
      nextStep: "ask_city",
      data: {},
    };
  }

  // После завершения не пускаем по кругу
  if (step === "completed") {
    return {
      reply: buildSupportReply(text),
      nextStep: "completed",
      data: currentData,
    };
  }

  // Город
  if (step === "ask_city") {
    return {
      reply:
        "Благодарю 🌿\n\n" +
        "Подскажите, пожалуйста, что Вас интересует?\n\n" +
        "1. Пересадка волос\n" +
        "2. Пересадка бороды\n" +
        "3. Пересадка бровей\n" +
        "4. Пересадка ресниц\n" +
        "5. Бесплатная консультация",
      nextStep: "ask_service",
      data: {
        ...currentData,
        city: text,
      },
    };
  }

  // Услуга
  if (step === "ask_service") {
    const service = detectService(text);

    return {
      reply:
        `Поняла Вас 😊\n\n` +
        `По услуге «${service}» я помогу Вам дальше.\n\n` +
        "Чтобы точнее сориентировать Вас, можно отправить фото зоны без лица.\n" +
        "Если сейчас неудобно — продолжим без фото и запишем Вас на консультацию.",
      nextStep: "ask_photo",
      data: {
        ...currentData,
        service,
      },
    };
  }

  // Фото / без фото
  if (step === "ask_photo") {
    const photoDecision = detectPhotoAnswer(text, message === "[image]" || message === "image");

    if (!photoDecision) {
      return {
        reply:
          "Если удобно — отправьте фото зоны без лица.\n\n" +
          "Если хотите продолжить без фото, напишите: Без фото",
        nextStep: "ask_photo",
        data: currentData,
      };
    }

    return {
      reply:
        photoDecision.photoReceived
          ? "Спасибо 🌸 Фото получила.\n\nТеперь подскажите, пожалуйста, как я могу к Вам обращаться и Ваш возраст?"
          : "Хорошо 🌿 Продолжим без фото.\n\nПодскажите, пожалуйста, как я могу к Вам обращаться и Ваш возраст?",
      nextStep: "ask_name_age",
      data: {
        ...currentData,
        photoStatus: photoDecision.photoStatus,
        photoReceived: photoDecision.photoReceived,
      },
    };
  }

  // Имя и возраст
  if (step === "ask_name_age") {
    const parsed = parseNameAndAge(text);

    if (!parsed.name || !parsed.age) {
      return {
        reply:
          "Подскажите, пожалуйста, имя и возраст одним сообщением.\n\n" +
          "Например: Ермек 36 лет",
        nextStep: "ask_name_age",
        data: currentData,
      };
    }

    return {
      reply:
        `Очень приятно, ${parsed.name} 🌿\n\n` +
        "Подскажите, пожалуйста, Вы уже были ранее на консультации?\n" +
        "1. Да\n" +
        "2. Нет",
      nextStep: "ask_consultation",
      data: {
        ...currentData,
        name: parsed.name,
        age: parsed.age,
      },
    };
  }

  // Была ли консультация
  if (step === "ask_consultation") {
    const hadConsultation = detectConsultationAnswer(text);

    return {
      reply:
        "Спасибо 🙏\n\n" +
        "Когда Вам было бы удобно прийти на консультацию?\n" +
        "1. Сегодня\n" +
        "2. Завтра\n" +
        "3. В ближайшие дни\n" +
        "4. Нужна сначала консультация по переписке",
      nextStep: "ask_visit_time",
      data: {
        ...currentData,
        hadConsultation,
      },
    };
  }

  // Когда удобно
  if (step === "ask_visit_time") {
    const visitTime = detectVisitPreference(text);

    return {
      reply: buildFinalReply({
        ...currentData,
        visitTime,
      }),
      nextStep: "completed",
      data: {
        ...currentData,
        visitTime,
      },
    };
  }

  return {
    reply:
      "Извините, я не совсем поняла ваш ответ 🌸\n\n" +
      "Пожалуйста, напишите ещё раз, и я помогу дальше.",
    nextStep: step,
    data: currentData,
  };
}

module.exports = { handleClinic };