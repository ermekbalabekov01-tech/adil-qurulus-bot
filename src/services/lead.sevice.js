const pool = require("../db");

async function createLead({
  clientId,
  serviceKey = null,
  serviceTitle = null,
  branch = "astana",
  status = "new",
}) {
  const result = await pool.query(
    `
    INSERT INTO leads (
      client_id,
      service_key,
      service_title,
      branch,
      status
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
    `,
    [clientId, serviceKey, serviceTitle, branch, status]
  );

  return result.rows[0];
}

module.exports = {
  createLead,
};