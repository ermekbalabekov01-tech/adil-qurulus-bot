const axios = require('axios');
const { routeMessage } = require('../router');
const { sendTelegramMessage } = require('../services/telegram.service');

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
      leadSent: false
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

  // если пользователь вышел из completed в новый диалог — разрешаем новый лид
  if (updates.step && updates.step !== 'completed') {
    next.leadSent = false;
  }

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
  const length = reply.length;

  if (length <= 60) return 800;
  if (length <= 160) return 1400;
  if (length <= 300) return 2200;
  return 3000;
}

function formatLeadMessage(project, data = {}, from = '') {
  const title =
    project === 'clinic'
      ? '🏥 Новая заявка — Клиника'
      : '🏗 Новая заявка — Adil Qurulus';

  const lines = [title, ''];

  if (from) {
    lines.push(`WhatsApp: ${from}`);
  }

  const fields = [
    ['direction', 'Направление'],
    ['houseStage', 'Этап'],
    ['location', 'Локация'],
    ['projectStatus', 'Проект'],
    ['size', 'Размер'],
    ['timing', 'Сроки'],
    ['budget', 'Бюджет'],
    ['repairObject', 'Объект'],
    ['repairType', 'Тип ремонта'],
    ['area', 'Площадь'],
    ['serviceType', 'Услуга'],
    ['scope', 'Объём работ'],
    ['calcType', 'Тип расчёта'],
    ['calcRequest', 'Запрос'],
    ['name', 'Имя'],
    ['phone', 'Телефон']
  ];

  for (const [key, label] of fields) {
    if (data[key]) {
      lines.push(`${label}: ${data[key]}`);
    }
  }

  return lines.join('\n');
}

async function handleWebhook(req, res) {
  try {
    const body = req.body;

    // отвечаем Meta сразу
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

    const updatedSession = updateSession(from, {
      project,
      step: nextStep,
      data
    });

    console.log('📌 PROJECT:', project);
    console.log('📌 NEXT STEP:', nextStep);
    console.log('📌 REPLY:', reply);

    if (nextStep === 'completed' && !updatedSession.leadSent) {
      const leadText = formatLeadMessage(project, updatedSession.data || {}, from);
      await sendTelegramMessage(leadText);

      updateSession(from, {
        leadSent: true
      });
    }

    await markMessageAsRead(messageId, project);

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