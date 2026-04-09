const steps = {
  START: 'START',
  CITY: 'CITY',
  TYPE: 'TYPE',
  SIZE: 'SIZE',
  TIMING: 'TIMING',
  OFFER: 'OFFER',
  CONTACT: 'CONTACT',
  DONE: 'DONE'
};

function getReply(user, text) {
  text = text.toLowerCase();

  switch (user.step) {
    case steps.START:
      user.step = steps.CITY;
      return `Здравствуйте! 👋  
Я Алия, помощник строительной компании.

Подскажите, пожалуйста, из какого вы города?`;

    case steps.CITY:
      user.city = text;
      user.step = steps.TYPE;

      return `Отлично 👍

Скажите, что планируете строить?
• дом под ключ  
• фундамент  
• коробка дома`;

    case steps.TYPE:
      user.type = text;
      user.step = steps.SIZE;

      return `Хорошо 👌

Примерно какой размер дома планируете?  
Например: 10×10 или 120 м²`;

    case steps.SIZE:
      user.size = text;
      user.step = steps.TIMING;

      return `Поняла 👍

Когда планируете начать строительство?`;

    case steps.TIMING:
      user.timing = text;
      user.step = steps.OFFER;

      return `Отлично 👌

Мы можем сделать для вас:
✔ предварительный расчет  
✔ подобрать оптимальный вариант  
✔ показать примеры работ  

Хотите, сделаем быстрый расчет для вас?`;

    case steps.OFFER:
      if (text.includes('да') || text.includes('хочу')) {
        user.step = steps.CONTACT;

        return `Хорошо 👍

Оставьте, пожалуйста, ваш номер телефона, чтобы специалист связался с вами и сделал точный расчет 🙌`;
      } else {
        return `Понимаю 🙂

Если что, можем в любое время сделать расчет и проконсультировать вас бесплатно 👍`;
      }

    case steps.CONTACT:
      user.phone = text;
      user.step = steps.DONE;

      return `Спасибо 🙌

Наш специалист свяжется с вами в ближайшее время.

Пока можете посмотреть наши работы:  
📸 Instagram: ${process.env.INSTAGRAM_URL || 'ссылка скоро будет'}

Также можем отправить сертификаты и кейсы 👍`;

    case steps.DONE:
      return `Если появятся вопросы — пишите, всегда на связи 😊`;

    default:
      user.step = steps.START;
      return `Здравствуйте! 👋`;
  }
}

module.exports = {
  getReply,
  steps
};