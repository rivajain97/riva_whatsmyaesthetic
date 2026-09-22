const form = document.getElementById("ask-form");
const input = document.getElementById("ask-input");
const button = document.getElementById("ask-button");
const hint = document.getElementById("ask-hint");
const resultArea = document.getElementById("result-area");

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function inlineFormat(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+?)`/g, "<code>$1</code>");
}

// Small, dependency-free renderer for the agent's markdown-ish response:
// headings (##/###), bullet/numbered lists, and paragraphs.
function renderMarkdown(raw) {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  let html = "";
  let listBuffer = [];
  let listType = null;

  function flushList() {
    if (listBuffer.length === 0) return;
    const tag = listType === "ol" ? "ol" : "ul";
    html += `<${tag}>${listBuffer.map((item) => `<li>${inlineFormat(item)}</li>`).join("")}</${tag}>`;
    listBuffer = [];
    listType = null;
  }

  let paragraphBuffer = [];
  function flushParagraph() {
    if (paragraphBuffer.length === 0) return;
    html += `<p>${inlineFormat(paragraphBuffer.join(" "))}</p>`;
    paragraphBuffer = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      continue;
    }

    const h3 = line.match(/^###\s+(.*)$/) || line.match(/^\*\*(.+?)\*\*:?\s*$/);
    const h2 = line.match(/^##\s+(.*)$/) || line.match(/^#\s+(.*)$/);
    const bullet = line.match(/^[-*]\s+(.*)$/);
    const numbered = line.match(/^\d+\.\s+(.*)$/);
    const isRule = /^(-{3,}|\*{3,})$/.test(line);

    if (isRule) {
      flushParagraph();
      flushList();
      html += "<hr />";
    } else if (h2) {
      flushParagraph();
      flushList();
      html += `<h2>${inlineFormat(h2[1])}</h2>`;
    } else if (h3) {
      flushParagraph();
      flushList();
      html += `<h3>${inlineFormat(h3[1])}</h3>`;
    } else if (bullet) {
      flushParagraph();
      if (listType !== "ul") flushList();
      listType = "ul";
      listBuffer.push(bullet[1]);
    } else if (numbered) {
      flushParagraph();
      if (listType !== "ol") flushList();
      listType = "ol";
      listBuffer.push(numbered[1]);
    } else {
      flushList();
      paragraphBuffer.push(line);
    }
  }
  flushParagraph();
  flushList();

  return html;
}

function showLoading() {
  resultArea.innerHTML = `
    <div class="state-loading">
      <span class="dot-pulse"></span>
      Thinking about your aesthetic&hellip; this checks your favorite outfits and your real wardrobe, so it can take a minute.
    </div>
  `;
}

function showError(message) {
  resultArea.innerHTML = `<div class="state-error">${escapeHtml(message)}</div>`;
}

function showResult(recommendationText) {
  resultArea.innerHTML = `
    <div class="result-card">${renderMarkdown(recommendationText)}</div>
    <p class="result-meta">Grounded in your real wardrobe and your favorite-outfit aesthetic profile.</p>
  `;
}

function setBusy(isBusy) {
  button.disabled = isBusy;
  input.disabled = isBusy;
  button.textContent = isBusy ? "Thinking…" : "Ask";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const message = input.value.trim();
  hint.hidden = true;

  if (!message) {
    hint.textContent = "Tell me where you're going, what you're wearing, or what you need an outfit for.";
    hint.hidden = false;
    input.focus();
    return;
  }

  setBusy(true);
  showLoading();

  try {
    const response = await fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || !data || !data.recommendation) {
      const message =
        (data && data.error) || "Something went wrong while building your recommendation. Please try again.";
      showError(message);
      return;
    }

    showResult(data.recommendation);
  } catch (err) {
    showError("Couldn't reach the server. Check that it's still running and try again.");
  } finally {
    setBusy(false);
  }
});
