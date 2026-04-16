require("dotenv").config();

const { sendClinicTelegramLead } = require("./src/services/telegramClinic.service");

async function run() {
  const ok = await sendClinicTelegramLead({
    name: "Тест Ермек",
    phone: "+77752545478",
    whatsapp: "77752545478",
    city: "Астана",
    service: "Пересадка волос",
    hadConsultation: "Нет",
    photoStatus: "Без фото",
    visitTime: "Завтра",
  });

  console.log("RESULT:", ok);
}

run();