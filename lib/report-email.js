const nodemailer = require("nodemailer");

const DEFAULT_RECIPIENT = "won911227@gmail.com";

function markdownToHtml(markdown) {
  let html = markdown;
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener">$1</a>'
  );
  html = html.replace(/^- (.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (block) => `<ul>${block}</ul>`);
  html = html.replace(/\n\n/g, "<br><br>").replace(/\n/g, "<br>");
  return `<html><body style="font-family:sans-serif;line-height:1.6;">${html}</body></html>`;
}

async function sendReportEmail({ title, report }) {
  const gmailUser = (process.env.GMAIL_USER || "").trim();
  const gmailPassword = (process.env.GMAIL_APP_PASSWORD || "").trim();
  const recipient = (process.env.REPORT_RECIPIENT || DEFAULT_RECIPIENT).trim();

  if (!gmailUser || !gmailPassword) {
    throw new Error(
      "GMAIL_USER, GMAIL_APP_PASSWORD 환경변수가 필요합니다. Vercel 대시보드에서 설정해 주세요."
    );
  }

  if (!title || !report) {
    throw new Error("발송할 보고서 정보가 없습니다.");
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: gmailUser,
      pass: gmailPassword,
    },
  });

  await transporter.sendMail({
    from: gmailUser,
    to: recipient,
    subject: title,
    text: report,
    html: markdownToHtml(report),
  });

  return recipient;
}

module.exports = { sendReportEmail, DEFAULT_RECIPIENT };
