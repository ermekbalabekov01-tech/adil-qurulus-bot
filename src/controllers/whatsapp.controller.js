const axios = require('axios');
const { routeMessage } = require('../router');

const sessions = new Map();

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function getSession(phone) {
  const key = normalizePhone(phone);

  if (!sessions.has(key)) {
    sessions.set(key, {
      project: null,
      step: 'start',
      data: {},
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

async function sendWhatsAppMessage(to, body, project = 'construction') {
  let token;
  let phoneNumberId;

  if (project === 'clinic') {
    token = process.env.CLINIC_ACCESS_TOKEN;
    phoneNumberId = process.env.CLINIC_PHONE_NUMBER_ID;
  } else {
    token = process.env.CONSTRUCTION_ACCESS_TOKEN;
    phoneNumberId = process.env.CONSTRUCTION_PHONE_NUMBER_ID;
  }

  if (!token || !phoneNumberId) {
    throw new Error(`Не указаны токен или phone number id для проекта: ${project}`);
  }

  const url = `https://graph.facebook.com/v23.0/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    to: normalizePhone(to),
    type: 'text',
    text: {
      body,
    },
  };

  await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
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

async function handleWebhook(req, res) {
  try {
    const body = req.body;

    res.sendStatus(200);

    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    if (!value) return;

    if (value.statuses) {
      console.log('ℹ️ Status event:', JSON.stringify(value.statuses, null, 2));
      return;
    }

    const message = value?.messages?.[0];
    if (!message) return;

    const from = message.from;
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
    } else {
      text = `[${type}]`;
    }

    console.log('📩 FROM:', from);
    console.log('📩 TEXT:', text);

    const session = getSession(from);

    const routed = routeMessage({
      text,
      from,
      session,
      projectType: session.project || null,
    });

    const project = routed.project;
    const result = routed.result || {};

    const reply = result.reply || 'Спасибо! Ваше сообщение получено.';
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

    await sendWhatsAppMessage(from, reply, project);
  } catch (error) {
    console.error('❌ handleWebhook error:', error.response?.data || error.message);
  }
}

module.exports = {
  verifyWebhook,
  handleWebhook,
};