const nodemailer = require("nodemailer");

const MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const DEFAULT_RECIPIENT = "won911227@gmail.com";

function parseKeywords(raw) {
  return String(raw || "")
    .split(/[,\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function buildPrompt(keywords, today) {
  const start = new Date(today);
  start.setDate(start.getDate() - 7);
  const startDate = formatDate(start);
  const endDate = formatDate(today);
  const keywordText = keywords.join(", ");

  return `당신은 뉴스·이슈 분석 전문가입니다.
Google 검색을 활용해 아래 키워드와 관련된 **최근 7일(${startDate} ~ ${endDate})** 주요 이슈를 조사하고 한국어 보고서를 작성하세요.

검색 키워드: ${keywordText}

보고서 작성 규칙:
1. 반드시 최근 7일 이내의 이슈만 포함하세요. 오래된 내용은 제외하세요.
2. 각 이슈마다 제목, 핵심 요약(3~5문장), 영향/시사점을 포함하세요.
3. 이슈는 중요도 순으로 5~10개까지 정리하세요.
4. 사실과 추측을 구분하고, 확인되지 않은 내용은 명시하세요.
5. 보고서 본문에 언급한 기사·콘텐츠는 가능한 한 구체적으로 인용하세요.

보고서 구조:
## 요약
(전체 이슈 2~3문장 요약)

## 주요 이슈
### 1. [이슈 제목]
- **발생 시점**:
- **핵심 내용**:
- **영향/시사점**:

(이하 동일 형식으로 이어서 작성)

## 종합 인사이트
(키워드 전반에 대한 종합 분석)`;
}

function extractSources(candidate) {
  const metadata = candidate?.groundingMetadata || {};
  const searchQueries = [...new Set(metadata.webSearchQueries || [])].filter(Boolean);
  const sources = [];
  const seen = new Set();

  for (const chunk of metadata.groundingChunks || []) {
    const url = chunk?.web?.uri;
    const title = chunk?.web?.title || "출처";
    if (!url || seen.has(url)) continue;
    seen.add(url);
    sources.push({ title, url });
  }

  return { searchQueries, sources };
}

function buildReportTitle(keywords, generatedAt) {
  const keywordText = keywords.join(", ");
  const dateText = formatDate(generatedAt);
  return `[이슈 보고서] ${keywordText} (${dateText})`;
}

function toMarkdown({ keywords, generatedAt, body, searchQueries, sources }) {
  const lines = [
    `# ${buildReportTitle(keywords, generatedAt)}`,
    "",
    `- 생성 시각: ${generatedAt.toISOString().replace("T", " ").slice(0, 19)}`,
    `- 검색 키워드: ${keywords.join(", ")}`,
    "- 수집 기간: 최근 7일",
    "",
  ];

  if (searchQueries.length > 0) {
    lines.push("## 사용된 검색 쿼리", "", ...searchQueries.map((q) => `- ${q}`), "");
  }

  lines.push("## 보고서", "", body, "");

  if (sources.length > 0) {
    lines.push("## 참조 출처", "");
    sources.forEach((source, index) => {
      lines.push(`${index + 1}. [${source.title}](${source.url})`);
    });
  }

  return `${lines.join("\n").trim()}\n`;
}

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

async function generateIssueReport(apiKey, keywords) {
  const generatedAt = new Date();
  const prompt = buildPrompt(keywords, generatedAt);

  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.4 },
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    console.error("Gemini API error:", errBody);
    throw new Error("Gemini API 호출에 실패했습니다.");
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  const body = candidate?.content?.parts?.map((part) => part.text || "").join("").trim();

  if (!body) {
    throw new Error("Gemini API가 빈 응답을 반환했습니다.");
  }

  const { searchQueries, sources } = extractSources(candidate);

  return {
    keywords,
    generatedAt,
    body,
    searchQueries,
    sources,
    markdown: toMarkdown({ keywords, generatedAt, body, searchQueries, sources }),
    title: buildReportTitle(keywords, generatedAt),
  };
}

async function sendReportEmail(report) {
  const gmailUser = (process.env.GMAIL_USER || "").trim();
  const gmailPassword = (process.env.GMAIL_APP_PASSWORD || "").trim();
  const recipient = (process.env.REPORT_RECIPIENT || DEFAULT_RECIPIENT).trim();

  if (!gmailUser || !gmailPassword) {
    throw new Error(
      "GMAIL_USER, GMAIL_APP_PASSWORD 환경변수가 필요합니다. Vercel 대시보드에서 설정해 주세요."
    );
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
    subject: report.title,
    text: report.markdown,
    html: markdownToHtml(report.markdown),
  });

  return recipient;
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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      success: false,
      error: "GEMINI_API_KEY 환경변수가 설정되지 않았습니다. Vercel 대시보드에서 설정해 주세요.",
    });
  }

  const keywords = parseKeywords(req.body?.keywords);
  if (keywords.length === 0) {
    return res.status(400).json({ success: false, error: "키워드를 입력해 주세요." });
  }

  try {
    const report = await generateIssueReport(apiKey, keywords);
    const recipient = await sendReportEmail(report);

    return res.status(200).json({
      success: true,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: report.title,
      keywords: report.keywords,
      generated_at: report.generatedAt.toISOString(),
      body: report.body,
      report: report.markdown,
      sources: report.sources,
      recipient,
      source_count: report.sources.length,
      search_queries: report.searchQueries,
    });
  } catch (err) {
    console.error("generate-report error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "보고서 생성 중 오류가 발생했습니다.",
    });
  }
};
