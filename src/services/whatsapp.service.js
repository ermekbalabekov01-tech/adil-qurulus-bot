const axios = require("axios");

const API_BASE = "https://graph.facebook.com/v23.0";

async function sendRequest(payload) {
  const url = `${API_BASE}/${process.env.PHONE_NUMBER_ID}/messages`;

  const { data } = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    timeout: 30000,
  });

  return data;
}

async function sendTextMessage(to, body) {
  return sendRequest({
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body },
  });
}

async function sendReplyButtons(to, body, buttons, headerText = null, footerText = null) {
  return sendRequest({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      ...(headerText ? { header: { type: "text", text: headerText } } : {}),
      body: { text: body },
      ...(footerText ? { footer: { text: footerText } } : {}),
      action: {
        buttons: buttons.map((btn) => ({
          type: "reply",
          reply: {
            id: btn.id,
            title: btn.title,
          },
        })),
      },
    },
  });
}

async function sendListMessage(to, body, buttonText, sections, headerText = null, footerText = null) {
  return sendRequest({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      ...(headerText ? { header: { type: "text", text: headerText } } : {}),
      body: { text: body },
      ...(footerText ? { footer: { text: footerText } } : {}),
      action: {
        button: buttonText,
        sections,
      },
    },
  });
}

module.exports = {
  sendTextMessage,
  sendReplyButtons,
  sendListMessage,
};