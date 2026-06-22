const { DEFAULT_RECIPIENT, sendViaGmailApi } = require("../lib/gmail-api");

function toFriendlyEmailError(error) {
  const message = String(error?.message || error || "");
  if (error?.status === 401) {
    return "Google 로그인이 만료되었습니다. 다시 로그인한 뒤 발송해 주세요.";
  }
  if (message.includes("insufficientPermissions") || message.includes("ACCESS_TOKEN_SCOPE_INSUFFICIENT")) {
    return "Gmail 발송 권한이 없습니다. 다시 로그인해 주세요.";
  }
  return message || "이메일 자동 발송에 실패했습니다.";
}

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

  const { title, report, accessToken } = req.body || {};
  const recipient = (process.env.REPORT_RECIPIENT || DEFAULT_RECIPIENT).trim();

  if (!title || !report) {
    return res.status(400).json({
      success: false,
      error: "발송할 보고서(title, report)가 필요합니다.",
    });
  }

  if (!accessToken) {
    return res.status(401).json({
      success: false,
      error: "Google 로그인이 필요합니다. 먼저 로그인해 주세요.",
    });
  }

  try {
    await sendViaGmailApi(accessToken, { title, report, recipient });
    return res.status(200).json({ success: true, recipient });
  } catch (err) {
    console.error("send-report error:", err);
    return res.status(500).json({
      success: false,
      error: toFriendlyEmailError(err),
    });
  }
};
