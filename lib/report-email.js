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
  const gmailPassword = (process.env.GMAIL_APP_PASSWORD || "").replace(/\s/g, "");
  const recipient = (process.env.REPORT_RECIPIENT || DEFAULT_RECIPIENT).trim();

  if (!gmailUser || !gmailPassword) {
    throw new Error(
      "GMAIL_USER, GMAIL_APP_PASSWORD 환경변수가 필요합니다. " +
        "2차 인증 계정은 일반 비밀번호가 아닌 Gmail 앱 비밀번호를 Vercel에 설정해 주세요."
    );
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: gmailUser, pass: gmailPassword },
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

function toFriendlyEmailError(error) {
  const message = String(error?.message || error || "");
  if (message.includes("Application-specific password required")) {
    return (
      "Gmail 앱 비밀번호가 필요합니다. Vercel의 GMAIL_APP_PASSWORD에 " +
      "일반 비밀번호가 아닌 앱 비밀번호를 넣어 주세요. (2차 인증 사용 중이어도 가능)"
    );
  }
  if (message.includes("Invalid login")) {
    return "Gmail 로그인에 실패했습니다. GMAIL_USER와 GMAIL_APP_PASSWORD를 확인해 주세요.";
  }
  return message || "이메일 발송에 실패했습니다.";
}

module.exports = { sendReportEmail, toFriendlyEmailError, DEFAULT_RECIPIENT };
