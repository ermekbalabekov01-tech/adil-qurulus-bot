const express = require("express");
const router = express.Router();

const {
  verifyWebhook,
  handleWebhook,
} = require("../controllers/whatsapp.controller");

// Meta webhook verify
router.get("/webhook", verifyWebhook);

// Incoming WhatsApp events
router.post("/webhook", handleWebhook);

module.exports = router;