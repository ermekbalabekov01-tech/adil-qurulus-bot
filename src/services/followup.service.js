const axios = require('axios');

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function getProjectConfig(project = 'construction') {
  if (project === 'clinic') {
    return {
      token: process.env.CLINIC_ACCESS_TOKEN,
      phoneNumberId: process.env.CLINIC_PHONE_NUMBER_ID
    };
  }

  return {
    token: process.env.CONSTRUCTION_ACCESS_TOKEN,
    phoneNumberId: process.env.CONSTRUCTION_PHONE_NUMBER_ID
  };
}

async function sendWhatsAppMessage(to, body, project = 'construction') {
  try {
    const { token, phoneNumberId } = getProjectConfig(project);

    if (!token || !phoneNumberId) {
      console.log(`⚠️ Follow-up: не указан token или phoneNumberId для проекта ${project}`);
      return false;
    }

    const url = `https://graph.facebook.com/v23.0/${phoneNumberId}/messages`;

    const response = await axios.post(
      url,
      {
        messaging_product: 'whatsapp',
        to: normalizePhone(to),
        type: 'text',
        text: { body }
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ FOLLOW-UP SENT:', response.data);
    return true;
  } catch (error) {
    console.error('❌ FOLLOW-UP ERROR:', error.response?.data || error.message);
    return false;
  }
}

function buildFollowUpMessages(sessionData = {}) {
  const data = sessionData?.data || {};
  const name = data.name || 'друг';

  const direction =
    data.direction ||
    data.serviceType ||
    data.calcType ||
    'вашему проекту';

  const locationText = data.location ? ` по объекту в ${data.location}` : '';
  const sizeText = data.size ? ` (${data.size})` : '';

  return [
    `Здравствуйте, ${name} 👋

Напомню по вашей заявке${locationText}${sizeText}.

Менеджер уже получил запрос по ${direction}. Удобно ли вам сейчас принять звонок?`,

    `Напомню о вашей заявке 👍

Если хотите, можем быстрее сориентировать по стоимости и дальнейшим шагам.

Для этого менеджер просто уточнит пару деталей и даст понятный ответ.`,

    `Последнее сообщение по вашей заявке 👋

Если вопрос ещё актуален, напишите одним словом:
— Да
— Актуально
— Можно связаться

И менеджер сразу возьмёт вас в работу 👍`
  ];
}

function scheduleFollowUps(phone, sessionData = {}) {
  const project = sessionData.project || 'construction';
  const messages = buildFollowUpMessages(sessionData);

  console.log('⏰ START FOLLOW-UP CHAIN FOR:', phone);

  // 10 минут
  setTimeout(async () => {
    await sendWhatsAppMessage(phone, messages[0], project);
  }, 10 * 60 * 1000);

  // 30 минут
  setTimeout(async () => {
    await sendWhatsAppMessage(phone, messages[1], project);
  }, 30 * 60 * 1000);

  // 2 часа
  setTimeout(async () => {
    await sendWhatsAppMessage(phone, messages[2], project);
  }, 2 * 60 * 60 * 1000);
}

module.exports = {
  scheduleFollowUps
};