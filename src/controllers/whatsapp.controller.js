const axios = require('axios');
const { routeMessage } = require('../router');
const { sendTelegramLead, sendTelegramMessage } = require('../services/telegram.service');
const { sendLeadToBitrix } = require('../services/bitrix.service');
const { scheduleFollowUps } = require('../services/followup.service');

const sessions = new Map();

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function getSession(phone) {
  const key = normalizePhone(phone);

  if (!sessions.has(key)) {
    sessions.set(key, {
      project: 'construction',
      mode: 'scenario', // scenario | support
      step: 'start',
      data: {},
      leadSent: false,
      bitrixSent: false,
      followUpScheduled: false,
      closedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
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
      ...(updates.data || {}),
    },
    updatedAt: new Date().toISOString(),
  };

  sessions.set(key, next);
  return next;
}

function getProjectConfig(project = 'construction') {
  if (project === 'clinic') {
    return {
      token: process.env.CLINIC_ACCESS_TOKEN,
      phoneNumberId: process.env.CLINIC_PHONE_NUMBER_ID,
    };
  }

  return {
    token: process.env.CONSTRUCTION_ACCESS_TOKEN,
    phoneNumberId: process.env.CONSTRUCTION_PHONE_NUMBER_ID,
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
        message_id: messageId,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
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
      text: { body },
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
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

function buildSupportTelegramNote(from, text, session) {
  const lines = [
    '🟡 Уточнение от клиента после заявки',
    '',
    `WhatsApp: ${from}`,
  ];

  if (session?.data?.name) lines.push(`Имя: ${session.data.name}`);
  if (session?.data?.phone) lines.push(`Телефон: ${session.data.phone}`);
  lines.push(`Сообщение: ${text}`);

  return lines.join('\n');
}

function isRecentlyClosed(session) {
  if (!session?.closedAt) return false;

  const closedMs = new Date(session.closedAt).getTime();
  const nowMs = Date.now();
  const diffMinutes = (nowMs - closedMs) / (1000 * 60);

  return diffMinutes <= 24 * 60; // 24 часа держим в support-режиме
}

function detectSupportIntent(text = '') {
  const lower = String(text || '').toLowerCase().trim();

  if (!lower) return 'generic';

  if (
    lower.includes('расчет') ||
    lower.includes('расчёт') ||
    lower.includes('фундамент') ||
    lower.includes('смет') ||
    lower.includes('стоим') ||
    lower.includes('цена') ||
    lower.includes('сколько')
  ) {
    return 'estimate';
  }

  if (
    lower.includes('когда') ||
    lower.includes('срок') ||
    lower.includes('ждать') ||
    lower.includes('перезвон') ||
    lower.includes('связ') ||
    lower.includes('менеджер')
  ) {
    return 'timing';
  }

  if (
    lower.includes('привет') ||
    lower.includes('здравств') ||
    lower.includes('добрый')
  ) {
    return 'greeting';
  }

  return 'generic';
}

async function handleSupportMode({ from, text, messageId, session }) {
  const project = session.project || 'construction';
  const intent = detectSupportIntent(text);

  await markMessageAsRead(messageId, project);

  let reply = '';

  if (intent === 'greeting') {
    reply =
      'Здравствуйте 👋\n\n' +
      'Ваша заявка уже у менеджера. Если хотите что-то уточнить по объекту или расчёту — напишите сообщением, я сразу передам.';
  } else if (intent === 'timing') {
    reply =
      'Менеджер уже получил вашу заявку 👍\n\n' +
      'Если вопрос срочный, я могу передать повторное уточнение прямо сейчас.';
  } else if (intent === 'estimate') {
    reply =
      'Понял вас 👍\n\n' +
      'Передаю менеджеру, что вам нужен уточнённый расчёт. Он свяжется с вами по этому вопросу.';
  } else {
    reply =
      'Я на связи 👍\n\n' +
      'Написал ваше уточнение менеджеру. Если есть ещё детали по объекту, можете отправить их сюда одним сообщением.';
  }

  // Любое осмысленное сообщение после заявки передаём менеджеру в Telegram
  if (String(text || '').trim()) {
    const note = buildSupportTelegramNote(from, text, session);
    await sendTelegramMessage(note);
  }

  const delay = getTypingDelay(reply);
  await new Promise((resolve) => setTimeout(resolve, delay));
  await sendWhatsAppMessage(from, reply, project);
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

    // Если заявка уже завершена, не крутим сценарий заново
    if (session.mode === 'support' || isRecentlyClosed(session)) {
      if (session.mode !== 'support') {
        updateSession(from, { mode: 'support' });
      }

      await handleSupportMode({
        from,
        text,
        messageId,
        session: getSession(from),
      });

      return;
    }

    const routed = await routeMessage({
      text,
      session,
      projectType: session.project || 'construction',
    });

    const project = routed.project || 'construction';
    const result = routed.result || {};

    const reply = result.reply || '';
    const nextStep = result.nextStep || session.step || 'start';
    const data = result.data || {};

    updateSession(from, {
      project,
      step: nextStep,
      data,
    });

    console.log('📌 PROJECT:', project);
    console.log('📌 NEXT STEP:', nextStep);
    console.log('📌 REPLY:', reply);

    await markMessageAsRead(messageId, project);

    if (nextStep === 'completed') {
      console.log('🔥 COMPLETED BLOCK START');

      const freshSession = getSession(from);

      if (!freshSession.leadSent) {
        const telegramOk = await sendTelegramLead({
          whatsapp: from,
          ...freshSession.data,
        });

        console.log('📨 TELEGRAM SENT RESULT:', telegramOk);

        if (telegramOk) {
          updateSession(from, { leadSent: true });
        }
      } else {
        console.log('⛔ TELEGRAM ALREADY SENT');
      }

      const finalSession = getSession(from);

      if (!finalSession.bitrixSent) {
        const bitrixOk = await sendLeadToBitrix({
          name: finalSession.data?.name || 'Не указано',
          phone: finalSession.data?.phone || from,
          comment: buildBitrixComment(finalSession.data || {}, from),
        });

        console.log('📤 BITRIX SENT RESULT:', bitrixOk);

        if (bitrixOk) {
          updateSession(from, { bitrixSent: true });
        }
      } else {
        console.log('⛔ BITRIX ALREADY SENT');
      }

      if (!finalSession.followUpScheduled) {
        try {
          scheduleFollowUps(from, {
            project,
            data: finalSession.data,
          });

          updateSession(from, { followUpScheduled: true });
          console.log('✅ FOLLOW-UP SCHEDULED');
        } catch (error) {
          console.error('❌ FOLLOW-UP ERROR:', error.message);
        }
      }

      // Ключевое: после завершения переводим в support, чтобы не было круга
      updateSession(from, {
        step: 'done',
        mode: 'support',
        closedAt: new Date().toISOString(),
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
  handleWebhook,
};