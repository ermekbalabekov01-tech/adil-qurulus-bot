const axios = require('axios');
const { routeMessage } = require('../router');
const { sendTelegramLead } = require('../services/telegram.service');
const { sendLeadToBitrix } = require('../services/bitrix.service');

const sessions = new Map();

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function getSession(phone) {
  const key = normalizePhone(phone);

  if (!sessions.has(key)) {
    sessions.set(key, {
      project: 'construction',
      step: 'start',
      data: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      leadSent: false,
      bitrixSent: false,
      closedAt: null
    });
  }

  return sessions.get(key);
}

function updateSession(phone, updates = {}) {
  const key = normalizePhone(phone);
  const current = getSession(key);

  const next = {
    ...current,
    ...updates,
    data: {
      ...(current.data || {}),
      ...(updates.data || {})
    },
    updatedAt: new Date().toISOString()
  };

  sessions.set(key, next);
  return next;
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

async function markMessageAsRead(messageId, project = 'construction') {
  try {
    const { token, phoneNumberId } = getProjectConfig(project);

    if (!token || !phoneNumberId || !messageId) return;

    const url = `https://graph.facebook.com/v23.0/${phoneNumberId}/messages`;

    await axios.post(
      url,
      {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    console.error('❌ markMessageAsRead error:', error.response?.data || error.message);
  }
}

async function sendWhatsAppMessage(to, body, project = 'construction') {
  const { token, phoneNumberId } = getProjectConfig(project);

  if (!token || !phoneNumberId) {
    throw new Error(`Не указаны token или phoneNumberId для проекта: ${project}`);
  }

  const url = `https://graph.facebook.com/v23.0/${phoneNumberId}/messages`;

  await axios.post(
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
}

function verifyWebhook(req, res) {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
      console.log('✅ WEBHOOK VERIFIED');
      return res.status(200).send(challenge);
    }

    return res.sendStatus(403);
  } catch (error) {
    console.error('❌ verifyWebhook error:', error.message);
    return res.sendStatus(500);
  }
}

function getTypingDelay(reply = '') {
  const length = String(reply || '').length;

  if (length <= 80) return 900;
  if (length <= 180) return 1500;
  if (length <= 320) return 2300;
  return 3000;
}

function buildBitrixComment(data = {}, from = '') {
  const parts = [];

  if (from) parts.push(`WhatsApp: ${from}`);
  if (data.direction) parts.push(`Направление: ${data.direction}`);
  if (data.houseStage) parts.push(`Этап: ${data.houseStage}`);
  if (data.location) parts.push(`Локация: ${data.location}`);
  if (data.projectStatus) parts.push(`Проект: ${data.projectStatus}`);
  if (data.size) parts.push(`Размер: ${data.size}`);
  if (data.timing) parts.push(`Сроки: ${data.timing}`);
  if (data.budget) parts.push(`Бюджет: ${data.budget}`);
  if (data.repairObject) parts.push(`Объект: ${data.repairObject}`);
  if (data.repairType) parts.push(`Тип ремонта: ${data.repairType}`);
  if (data.area) parts.push(`Площадь: ${data.area}`);
  if (data.serviceType) parts.push(`Услуга: ${data.serviceType}`);
  if (data.scope) parts.push(`Объём работ: ${data.scope}`);
  if (data.calcType) parts.push(`Тип расчёта: ${data.calcType}`);
  if (data.calcRequest) parts.push(`Запрос: ${data.calcRequest}`);

  return parts.join('\n');
}

function isFreshClosedSession(session) {
  if (!session?.closedAt) return false;

  const closedMs = new Date(session.closedAt).getTime();
  const nowMs = Date.now();
  const diffMinutes = (nowMs - closedMs) / (1000 * 60);

  return diffMinutes <= 30;
}

function buildFollowUpReply(text = '') {
  const lowerText = String(text || '').toLowerCase().trim();

  if (
    lowerText.includes('привет') ||
    lowerText.includes('здравствуйте') ||
    lowerText.includes('добрый')
  ) {
    return (
      'Здравствуйте 👋\n\n' +
      'Я уже передал вашу заявку менеджеру.\n' +
      'Он свяжется с вами в ближайшее время 👍'
    );
  }

  if (
    lowerText.includes('когда') ||
    lowerText.includes('срок') ||
    lowerText.includes('ждать') ||
    lowerText.includes('скоро')
  ) {
    return (
      'Обычно менеджер связывается в ближайшее время 👍\n\n' +
      'Если будет задержка — напишите сюда, я дополнительно передам сообщение.'
    );
  }

  if (
    lowerText.includes('цена') ||
    lowerText.includes('стоимость') ||
    lowerText.includes('сколько')
  ) {
    return (
      'По стоимости лучше точно сориентирует менеджер после уточнения деталей 👍\n\n' +
      'Ваша заявка уже передана, он скоро свяжется с вами.'
    );
  }

  if (
    lowerText.includes('менеджер') ||
    lowerText.includes('связь') ||
    lowerText.includes('перезвон')
  ) {
    return (
      'Да, конечно 👍\n\n' +
      'Менеджер уже получил вашу заявку. Если хотите, можете здесь написать уточнение — я это тоже учту.'
    );
  }

  return (
    'Я на связи 👍\n\n' +
    'Если хотите что-то уточнить по заявке — напишите сообщением, я передам это менеджеру.'
  );
}

async function handleWebhook(req, res) {
  try {
    const body = req.body;

    res.sendStatus(200);

    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    if (!value) return;

    if (value.statuses) {
      console.log('ℹ️ STATUS EVENT:', JSON.stringify(value.statuses, null, 2));
      return;
    }

    const message = value?.messages?.[0];
    if (!message) return;

    const from = message.from;
    const messageId = message.id;
    const type = message.type;

    let text = '';

    if (type === 'text') {
      text = message.text?.body || '';
    } else if (type === 'interactive') {
      text =
        message.interactive?.button_reply?.title ||
        message.interactive?.list_reply?.title ||
        '';
    } else if (type === 'button') {
      text = message.button?.text || '';
    } else if (type === 'image') {
      text = '[image]';
    } else if (type === 'document') {
      text = '[document]';
    } else {
      text = `[${type}]`;
    }

    console.log('📩 FROM:', from);
    console.log('📩 TEXT:', text);

    const session = getSession(from);

    // Если заявка уже была закрыта недавно — не гоняем человека заново по сценарию
    if (isFreshClosedSession(session)) {
      const followUpReply = buildFollowUpReply(text);

      await markMessageAsRead(messageId, session.project || 'construction');

      const delay = getTypingDelay(followUpReply);
      await new Promise((resolve) => setTimeout(resolve, delay));

      await sendWhatsAppMessage(from, followUpReply, session.project || 'construction');
      return;
    }

    const routed = await routeMessage({
      text,
      session,
      projectType: session.project || 'construction'
    });

    const project = routed.project || 'construction';
    const result = routed.result || {};

    const reply = result.reply || '';
    const nextStep = result.nextStep || session.step || 'start';
    const data = result.data || {};

    updateSession(from, {
      project,
      step: nextStep,
      data
    });

    console.log('📌 PROJECT:', project);
    console.log('📌 NEXT STEP:', nextStep);
    console.log('📌 REPLY:', reply);

    await markMessageAsRead(messageId, project);

    if (nextStep === 'completed') {
      console.log('🔥 COMPLETED BLOCK START');

      const freshSession = getSession(from);

      if (!freshSession.leadSent) {
        console.log('📨 TELEGRAM ABOUT TO SEND');

        const telegramOk = await sendTelegramLead({
          whatsapp: from,
          ...freshSession.data
        });

        console.log('📨 TELEGRAM SENT RESULT:', telegramOk);

        if (telegramOk) {
          updateSession(from, {
            leadSent: true
          });
        }
      } else {
        console.log('⛔ TELEGRAM ALREADY SENT');
      }

      const finalSession = getSession(from);

      if (!finalSession.bitrixSent) {
        console.log('📤 BITRIX ABOUT TO SEND');

        const bitrixOk = await sendLeadToBitrix({
          name: finalSession.data?.name || 'Не указано',
          phone: finalSession.data?.phone || from,
          comment: buildBitrixComment(finalSession.data || {}, from)
        });

        console.log('📤 BITRIX SENT RESULT:', bitrixOk);

        if (bitrixOk) {
          updateSession(from, {
            bitrixSent: true
          });
        }
      } else {
        console.log('⛔ BITRIX ALREADY SENT');
      }

      updateSession(from, {
        step: 'done',
        closedAt: new Date().toISOString()
      });
    }

    if (!reply) return;

    const delay = getTypingDelay(reply);
    await new Promise((resolve) => setTimeout(resolve, delay));

    await sendWhatsAppMessage(from, reply, project);
  } catch (error) {
    console.error('❌ handleWebhook error:', error.response?.data || error.message);
  }
}

module.exports = {
  verifyWebhook,
  handleWebhook
};