const STORAGE_KEY = "issueReports";
const MAX_HISTORY = 30;

const form = document.getElementById("report-form");
const statusEl = document.getElementById("status");
const generateBtn = document.getElementById("generate-btn");
const sendEmailBtn = document.getElementById("send-email-btn");
const historyList = document.getElementById("history-list");
const viewer = document.getElementById("report-viewer");
const viewerTitle = document.getElementById("viewer-title");
const viewerMeta = document.getElementById("viewer-meta");
const reportContent = document.getElementById("report-content");
const sourcesPanel = document.getElementById("sources-panel");
const queriesPanel = document.getElementById("queries-panel");
const copyBtn = document.getElementById("copy-report-btn");

let currentReportId = null;

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function markdownToHtml(markdown) {
  const lines = String(markdown || "").split("\n");
  const html = [];
  let inList = false;

  function closeList() {
    if (inList) {
      html.push("</ul>");
      inList = false;
    }
  }

  for (const line of lines) {
    if (/^### (.+)$/.test(line)) {
      closeList();
      html.push(`<h3>${escapeHtml(line.slice(4))}</h3>`);
      continue;
    }
    if (/^## (.+)$/.test(line)) {
      closeList();
      html.push(`<h2>${escapeHtml(line.slice(3))}</h2>`);
      continue;
    }
    if (/^# (.+)$/.test(line)) {
      closeList();
      html.push(`<h1>${escapeHtml(line.slice(2))}</h1>`);
      continue;
    }
    if (/^- (.+)$/.test(line)) {
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      const item = line
        .slice(2)
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(
          /\[([^\]]+)\]\(([^)]+)\)/g,
          '<a href="$2" target="_blank" rel="noopener">$1</a>'
        );
      html.push(`<li>${item}</li>`);
      continue;
    }

    closeList();
    if (!line.trim()) {
      html.push("<br>");
      continue;
    }

    const paragraph = escapeHtml(line)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener">$1</a>'
      );
    html.push(`<p>${paragraph}</p>`);
  }

  closeList();
  return html.join("");
}

function formatDateTime(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("ko-KR");
}

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveHistory(reports) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports.slice(0, MAX_HISTORY)));
}

function updateReportInHistory(report) {
  const reports = loadHistory().map((item) => (item.id === report.id ? report : item));
  saveHistory(reports);
  renderHistory();
}

function getCurrentReport() {
  if (!currentReportId) return null;
  return loadHistory().find((item) => item.id === currentReportId) || null;
}

function updateEmailButton(report) {
  if (!report) {
    sendEmailBtn.disabled = true;
    sendEmailBtn.textContent = "이메일 발송";
    return;
  }

  sendEmailBtn.disabled = false;
  sendEmailBtn.textContent = report.email_sent ? "이메일 재발송" : "이메일 발송";
}

function addToHistory(report) {
  const reports = loadHistory().filter((item) => item.id !== report.id);
  reports.unshift(report);
  saveHistory(reports);
  renderHistory();
}

function renderHistory() {
  const reports = loadHistory();
  historyList.innerHTML = "";

  if (reports.length === 0) {
    historyList.innerHTML =
      '<p class="history-empty">아직 생성된 보고서가 없습니다.<br>키워드를 입력해 첫 보고서를 만들어 보세요.</p>';
    return;
  }

  reports.forEach((report) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `history-item${report.id === currentReportId ? " active" : ""}`;
    button.innerHTML = `
      <strong>${escapeHtml(report.title)}</strong>
      <span>${escapeHtml(formatDateTime(report.generated_at))}</span>
    `;
    button.addEventListener("click", () => {
      showReport(report);
      location.hash = `report/${report.id}`;
    });
    historyList.appendChild(button);
  });
}

function renderSources(sources) {
  if (!sources || sources.length === 0) {
    sourcesPanel.innerHTML = '<p class="history-empty">참조 출처가 없습니다.</p>';
    return;
  }

  sourcesPanel.innerHTML = `<div class="source-list">${sources
    .map(
      (source, index) => `
      <article class="source-card">
        <a href="${escapeHtml(source.url)}" target="_blank" rel="noopener">
          ${index + 1}. ${escapeHtml(source.title)}
        </a>
        <p>${escapeHtml(source.url)}</p>
      </article>
    `
    )
    .join("")}</div>`;
}

function renderQueries(queries) {
  if (!queries || queries.length === 0) {
    queriesPanel.innerHTML = '<p class="history-empty">검색 쿼리 정보가 없습니다.</p>';
    return;
  }

  queriesPanel.innerHTML = `<div class="query-list">${queries
    .map((query) => `<span class="query-chip">${escapeHtml(query)}</span>`)
    .join("")}</div>`;
}

function setActiveTab(tabName) {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === tabName);
  });
  document.querySelectorAll(".panel").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.panel === tabName);
  });
}

function showReport(report) {
  currentReportId = report.id;
  viewer.classList.add("show");
  viewerTitle.textContent = report.title;

  const emailStatus = report.email_sent
    ? `발송 완료 (${escapeHtml(report.recipient || "won911227@gmail.com")})`
    : "미발송";

  viewerMeta.innerHTML = `
    생성 시각: ${escapeHtml(formatDateTime(report.generated_at))}<br>
    검색 키워드: ${escapeHtml((report.keywords || []).join(", "))}<br>
    수집 기간: 최근 7일<br>
    이메일: ${emailStatus}
  `;

  reportContent.innerHTML = markdownToHtml(report.body || "");
  renderSources(report.sources || []);
  renderQueries(report.search_queries || []);
  setActiveTab("report");
  updateEmailButton(report);
  renderHistory();
  viewer.scrollIntoView({ behavior: "smooth", block: "start" });
}

function setStatus(type, message) {
  statusEl.className = `status show ${type}`;
  statusEl.textContent = message;
}

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => setActiveTab(tab.dataset.tab));
});

copyBtn.addEventListener("click", async () => {
  const report = getCurrentReport();
  if (!report?.report) return;

  try {
    await navigator.clipboard.writeText(report.report);
    copyBtn.textContent = "복사 완료";
    setTimeout(() => {
      copyBtn.textContent = "전체 복사";
    }, 1500);
  } catch {
    setStatus("error", "클립보드 복사에 실패했습니다.");
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const keywords = document.getElementById("keywords").value.trim();
  if (!keywords) return;

  generateBtn.disabled = true;
  setStatus(
    "loading",
    "Google 검색으로 최근 7일 이슈를 수집하고 보고서를 생성 중입니다...\n완료까지 30초~2분 정도 걸릴 수 있습니다."
  );

  try {
    const response = await fetch("/api/generate-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keywords }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || "보고서 생성에 실패했습니다.");
    }

    const report = {
      id: data.id,
      title: data.title,
      keywords: data.keywords,
      generated_at: data.generated_at,
      body: data.body,
      report: data.report,
      sources: data.sources,
      search_queries: data.search_queries,
      email_sent: false,
      recipient: null,
    };

    addToHistory(report);
    showReport(report);
    location.hash = `report/${report.id}`;

    setStatus(
      "success",
      `보고서 생성 완료!\n웹에서 아래 보고서를 확인한 뒤, 필요하면 이메일 발송 버튼을 눌러 주세요.\n참조 출처: ${data.source_count}건`
    );
  } catch (error) {
    setStatus("error", error.message);
  } finally {
    generateBtn.disabled = false;
  }
});

sendEmailBtn.addEventListener("click", async () => {
  const report = getCurrentReport();
  if (!report?.report) {
    setStatus("error", "먼저 보고서를 생성하거나 선택해 주세요.");
    return;
  }

  sendEmailBtn.disabled = true;
  setStatus("loading", "이메일을 발송 중입니다...");

  try {
    const response = await fetch("/api/send-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: report.title,
        report: report.report,
      }),
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || "이메일 발송에 실패했습니다.");
    }

    const updatedReport = {
      ...report,
      email_sent: true,
      recipient: data.recipient,
    };
    updateReportInHistory(updatedReport);
    showReport(updatedReport);

    setStatus("success", `이메일 발송 완료!\n수신: ${data.recipient}`);
  } catch (error) {
    setStatus("error", error.message);
    updateEmailButton(report);
  } finally {
    if (!getCurrentReport()?.email_sent) {
      sendEmailBtn.disabled = false;
    } else {
      updateEmailButton(getCurrentReport());
    }
  }
});

function openReportFromHash() {
  const match = location.hash.match(/^#report\/(.+)$/);
  if (!match) return;

  const report = loadHistory().find((item) => item.id === match[1]);
  if (report) {
    showReport(report);
  }
}

window.addEventListener("hashchange", openReportFromHash);
renderHistory();
openReportFromHash();
updateEmailButton(getCurrentReport());
