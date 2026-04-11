require("dotenv").config();

const express = require("express");
const pool = require("./db");
const whatsappRoutes = require("./routes/whatsapp.routes");

const app = express();

app.use(express.json({ limit: "10mb" }));

app.get("/", (req, res) => {
  res.send("🚀 Multi Bot System Running");
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

module.exports = app;