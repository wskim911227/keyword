const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
const USERINFO_EMAIL_SCOPE = "https://www.googleapis.com/auth/userinfo.email";
const TOKEN_KEY = "gmail_access_token";
const EMAIL_KEY = "gmail_user_email";

let googleClientId = "";
let reportRecipient = "won911227@gmail.com";
let tokenClient = null;
let googleUserEmail = null;

function getStoredToken() {
  return sessionStorage.getItem(TOKEN_KEY) || "";
}

function clearGoogleSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(EMAIL_KEY);
  googleUserEmail = null;
}

function utf8ToBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return btoa(binary);
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

async function loadPublicConfig() {
  const response = await fetch("/api/config");
  const data = await response.json();
  googleClientId = data.googleClientId || "";
  reportRecipient = data.reportRecipient || reportRecipient;
  return data;
}

function waitForGoogleScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }

    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (window.google?.accounts?.oauth2) {
        window.clearInterval(timer);
        resolve();
        return;
      }
      if (attempts > 50) {
        window.clearInterval(timer);
        reject(new Error("Google 로그인 스크립트를 불러오지 못했습니다."));
      }
    }, 100);
  });
}

function initGoogleAuth() {
  if (!googleClientId || !window.google?.accounts?.oauth2) {
    return false;
  }

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: googleClientId,
    scope: `${GMAIL_SEND_SCOPE} ${USERINFO_EMAIL_SCOPE}`,
    callback: () => {},
  });

  return true;
}

function requestGoogleToken({ prompt = "" } = {}) {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error("GOOGLE_CLIENT_ID가 설정되지 않았습니다. Vercel 환경변수를 확인해 주세요."));
      return;
    }

    tokenClient.callback = async (response) => {
      if (response.error) {
        reject(new Error("Google 로그인에 실패했습니다."));
        return;
      }

      sessionStorage.setItem(TOKEN_KEY, response.access_token);
      try {
        await fetchGoogleUserEmail(response.access_token);
      } catch (error) {
        reject(error);
        return;
      }
      resolve(response.access_token);
    };

    tokenClient.requestAccessToken({ prompt });
  });
}

async function fetchGoogleUserEmail(accessToken) {
  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error("Google 계정 정보를 가져오지 못했습니다.");
  }

  const data = await response.json();
  googleUserEmail = data.email || null;
  if (googleUserEmail) {
    sessionStorage.setItem(EMAIL_KEY, googleUserEmail);
  }
  return googleUserEmail;
}

async function ensureGoogleAuth() {
  const existingToken = getStoredToken();
  if (existingToken) {
    if (!googleUserEmail) {
      const storedEmail = sessionStorage.getItem(EMAIL_KEY);
      if (storedEmail) {
        googleUserEmail = storedEmail;
      } else {
        await fetchGoogleUserEmail(existingToken);
      }
    }
    return existingToken;
  }

  return requestGoogleToken({ prompt: "consent" });
}

async function sendReportViaGmail({ title, report, accessToken }) {
  const response = await fetch("https://www.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      raw: buildRawEmail({
        to: reportRecipient,
        subject: title,
        body: report,
      }),
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    if (response.status === 401) {
      clearGoogleSession();
      throw new Error("Google 로그인이 만료되었습니다. 다시 로그인해 주세요.");
    }
    throw new Error(errorBody || "Gmail API 발송에 실패했습니다.");
  }

  return reportRecipient;
}

function restoreGoogleSession() {
  const storedEmail = sessionStorage.getItem(EMAIL_KEY);
  if (storedEmail && getStoredToken()) {
    googleUserEmail = storedEmail;
  }
}

function isGoogleConnected() {
  return Boolean(getStoredToken() && googleUserEmail);
}

function getGoogleUserEmail() {
  return googleUserEmail;
}

function getReportRecipient() {
  return reportRecipient;
}

window.GmailAuth = {
  loadPublicConfig,
  waitForGoogleScript,
  initGoogleAuth,
  requestGoogleToken,
  ensureGoogleAuth,
  sendReportViaGmail,
  restoreGoogleSession,
  isGoogleConnected,
  getGoogleUserEmail,
  getReportRecipient,
  clearGoogleSession,
  hasClientId: () => Boolean(googleClientId),
};
