const { analyzeClaimWithOllama } = require("./ollamaService");

function normalizeText(text) {
  return String(text || "").trim();
}

async function analyzeFakeNews(text, options = {}) {
  const normalizedText = normalizeText(text);
  if (!normalizedText) {
    return null;
  }

  const ollamaResult = await analyzeClaimWithOllama(normalizedText);
  const verdict = String(ollamaResult?.label || "MISLEADING").toUpperCase();

  return {
    claim: normalizedText,
    status: verdict,
    label: verdict,
    result: verdict,
    explanation: ollamaResult?.reason || "No explanation provided.",
    source: "ollama",
    model: "phi3:mini",
    rawResult: ollamaResult?.raw || "",
    mode: options.mode || "simple",
  };
}

module.exports = {
  analyzeFakeNews,
};
