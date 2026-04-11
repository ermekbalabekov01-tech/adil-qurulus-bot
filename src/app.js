require("dotenv").config();

const express = require("express");
const pool = require("./db");
const whatsappRoutes = require("./routes/whatsapp.routes");

const app = express();

app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 3000;

// Главная
app.get("/", (req, res) => {
  res.send("🚀 Multi Bot System Running");
});

// Проверка базы
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

// WhatsApp
app.use("/", whatsappRoutes);

// 🚀 Запуск
app.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);

  // 🔥 Telegram запускаем БЕЗ await
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