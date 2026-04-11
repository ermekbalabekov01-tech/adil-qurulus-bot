require("dotenv").config();

const express = require("express");
const pool = require("./db");
const whatsappRoutes = require("./routes/whatsapp.routes");

// 👉 Telegram admin (клиника)
const { sendTelegramAdmin } = require("./services/telegramAdmin.service");

const app = express();

app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 3000;

// 🔥 Главная проверка
app.get("/", (req, res) => {
  res.send("🚀 Clinic Bot is running");
});

// 🔥 Проверка базы
app.get("/db-test", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({
      ok: true,
      time: result.rows[0],
    });
  } catch (err) {
    console.error("DB TEST ERROR:", err);
    res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});

// 🔥 WhatsApp webhook
app.use("/", whatsappRoutes);

// 🚀 Запуск сервера
app.listen(PORT, async () => {
  console.log(`🚀 Server started on port ${PORT}`);

  // 👉 ТЕСТ TELEGRAM (один раз при старте)
  try {
    await sendTelegramAdmin("🚀 Telegram admin подключен и работает");
  } catch (e) {
    console.log("Telegram test error:", e.message);
  }
});