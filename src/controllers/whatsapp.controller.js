const axios = require("axios");
const projects = require("../config/projects.config");

function normalizePhone(phone) {
  return String(phone || "").replace(/\D/g, "");
}

async function sendWhatsAppMessageByProject(projectKey, to, body) {
  const project = projects[projectKey];
  if (!project?.accessToken || !project?.phoneNumberId) {
    console.log(`⚠️ Follow-up: нет токена или phoneNumberId для проекта ${projectKey}`);
    return false;
  }

  const url = `https://graph.facebook.com/v23.0/${project.phoneNumberId}/messages`;

  try {
    const response = await axios.post(
      url,
      {
        messaging_product: "whatsapp",
        to: normalizePhone(to),
        type: "text",
        text: { body },
      },
      {
        headers: {
          Authorization: `Bearer ${project.accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ FOLLOWUP SENT:", response.data);
    return true;
  } catch (error) {
    console.error("❌ FOLLOWUP ERROR:", error.response?.data || error.message);
    return false;
  }
}

function getFollowupMessages(projectKey, lang = "ru") {
  if (projectKey === "clinic") {
    return {
      first:
        lang === "kz"
          ? "Сәлеметсіз бе! Егер сұрағыңыз әлі де өзекті болса, осы чатқа жаза аласыз 👍"
          : "Здравствуйте! Если ваш вопрос всё ещё актуален, можете написать сюда 👍",
      second:
        lang === "kz"
          ? "Қажет болса, кез келген уақытта қайта жаза аласыз. Байланыстамыз 👍"
          : "Если будет актуально, можете написать в любое время. Будем на связи 👍",
    };
  }

  return {
    first:
      lang === "kz"
        ? "Сәлеметсіз бе! Өтініміңіз қабылданды 👍\n\nҚаласаңыз, объект бойынша қосымша мәлімет жаза аласыз."
        : "Здравствуйте! Ваша заявка принята 👍\n\nЕсли хотите, можете написать дополнительные детали по объекту.",
    second:
      lang === "kz"
        ? "Егер есептеу әлі де өзекті болса, кез келген уақытта жаза аласыз 👍"
        : "Если расчёт ещё актуален, можете написать сюда в любое время 👍",
  };
}

function scheduleFollowUps({
  projectKey,
  phone,
  lang,
  getSession,
}) {
  const msgs = getFollowupMessages(projectKey, lang);

  // мягкий follow-up #1 через 30 минут
  setTimeout(async () => {
    const session = getSession(phone);
    if (!session || session.mode !== "support") return;
    if (session.followUpCount >= 1) return;
    if (session.userRepliedAfterCompleted) return;

    const ok = await sendWhatsAppMessageByProject(projectKey, phone, msgs.first);
    if (ok) {
      session.followUpCount = 1;
    }
  }, 30 * 60 * 1000);

  // мягкий follow-up #2 через 12 часов
  setTimeout(async () => {
    const session = getSession(phone);
    if (!session || session.mode !== "support") return;
    if (session.followUpCount >= 2) return;
    if (session.userRepliedAfterCompleted) return;

    const ok = await sendWhatsAppMessageByProject(projectKey, phone, msgs.second);
    if (ok) {
      session.followUpCount = 2;
      session.mode = "silent";
    }
  }, 12 * 60 * 60 * 1000);
}

module.exports = {
  scheduleFollowUps,
};