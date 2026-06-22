const DEFAULT_RECIPIENT = "won911227@gmail.com";

function utf8ToBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return Buffer.from(binary, "binary").toString("base64");
}

function toBase64Url(text) {
  return utf8ToBase64(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function encodeMimeHeader(text) {
  return `=?UTF-8?B?${utf8ToBase64(text)}?=`;
}

function buildRawEmail({ to, subject, body }) {
  const content = [
    `To: ${to}`,
    `Subject: ${encodeMimeHeader(subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    utf8ToBase64(body),
  ].join("\r\n");

  return toBase64Url(content);
}

async function sendViaGmailApi(accessToken, { title, report, recipient }) {
  const response = await fetch("https://www.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      raw: buildRawEmail({
        to: recipient,
        subject: title,
        body: report,
      }),
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    const error = new Error(errorBody || "Gmail API 발송에 실패했습니다.");
    error.status = response.status;
    throw error;
  }

  return recipient;
}

module.exports = {
  DEFAULT_RECIPIENT,
  sendViaGmailApi,
};
