require("dotenv").config();

const express = require("express");
const pool = require("./db");
const whatsappRoutes = require("./routes/whatsapp.routes");
const { sendTelegramAdmin } = require("./services/telegramAdmin.service");

const app = express();

app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("🚀 Clinic Bot is running");
});

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

app.use("/", whatsappRoutes);

app.listen(PORT, async () => {
  console.log(`🚀 Server started on port ${PORT}`);

  try {
    await sendTelegramAdmin("🚀 Telegram admin подключен и работает");
    console.log("✅ Telegram test sent");
  } catch (e) {
    console.log("❌ Telegram test error:", e.message);
  }
});