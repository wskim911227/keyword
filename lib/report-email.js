const DEFAULT_RECIPIENT = "won911227@gmail.com";
const DEFAULT_FROM = "이슈 보고서 <onboarding@resend.dev>";

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
  return `<div style="font-family:sans-serif;line-height:1.6;max-width:720px;">${html}</div>`;
}

async function sendReportEmail({ title, report }) {
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  const from = (process.env.RESEND_FROM || DEFAULT_FROM).trim();
  const recipient = (process.env.REPORT_RECIPIENT || DEFAULT_RECIPIENT).trim();

  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY 환경변수가 필요합니다. Resend 대시보드에서 API 키를 발급해 Vercel에 설정해 주세요."
    );
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [recipient],
      subject: title,
      text: report,
      html: markdownToHtml(report),
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data?.message || data?.error || JSON.stringify(data);
    const error = new Error(message || "Resend API 발송에 실패했습니다.");
    error.status = response.status;
    throw error;
  }

  return recipient;
}

function toFriendlyEmailError(error) {
  const message = String(error?.message || error || "");

  if (message.includes("RESEND_API_KEY")) {
    return message;
  }
  if (message.includes("domain") || message.includes("verified")) {
    return (
      "발신 도메인이 인증되지 않았습니다. Resend에서 도메인을 인증하거나 " +
      "테스트용 RESEND_FROM=이슈 보고서 <onboarding@resend.dev> 를 사용해 주세요."
    );
  }
  if (message.includes("only send testing emails")) {
    return (
      "Resend 무료 테스트 모드에서는 가입한 본인 이메일로만 발송할 수 있습니다. " +
      "도메인 인증 후 원하는 주소로 발송할 수 있습니다."
    );
  }

  return message || "이메일 발송에 실패했습니다.";
}

module.exports = { sendReportEmail, toFriendlyEmailError, DEFAULT_RECIPIENT };
