const { sendReportEmail, toFriendlyEmailError } = require("../lib/report-email");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "POST만 허용됩니다." });
  }

  const { title, report } = req.body || {};

  if (!title || !report) {
    return res.status(400).json({
      success: false,
      error: "발송할 보고서(title, report)가 필요합니다.",
    });
  }

  try {
    const recipient = await sendReportEmail({ title, report });
    return res.status(200).json({ success: true, recipient });
  } catch (err) {
    console.error("send-report error:", err);
    return res.status(500).json({
      success: false,
      error: toFriendlyEmailError(err),
    });
  }
};
