const axios = require("axios");

const verifyWebhook = (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
};

const handleWebhook = async (req, res) => {
  try {
    const message = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!message) {
      return res.sendStatus(200);
    }

    const from = message.from;
    const text = message.text?.body?.trim() || "";

    console.log("PHONE:", from);
    console.log("TEXT:", text);

    await axios.post(
      `https://graph.facebook.com/v23.0/${process.env.PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: from,
        type: "text",
        text: {
          body: `Вы написали: ${text}`,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    return res.sendStatus(200);
  } catch (err) {
    console.error("WEBHOOK ERROR:", err.response?.data || err.message || err);
    return res.sendStatus(500);
  }
};

module.exports = {
  verifyWebhook,
  handleWebhook,
};