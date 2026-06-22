const DEFAULT_RECIPIENT = "won911227@gmail.com";

module.exports = (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");

  res.status(200).json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || "",
    reportRecipient: (process.env.REPORT_RECIPIENT || DEFAULT_RECIPIENT).trim(),
  });
};
