require("dotenv").config();

const app = require("./app");

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);

  setTimeout(() => {
    try {
      const { sendTelegramAdmin } = require("./services/telegramAdmin.service");
      sendTelegramAdmin("🚀 Telegram admin подключен");
      console.log("✅ Telegram async started");
    } catch (e) {
      console.log("❌ Telegram error:", e.message);
    }
  }, 2000);
});