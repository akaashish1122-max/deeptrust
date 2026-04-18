const { analyzeClaimWithOllama } = require("./ollamaService");

function normalizeText(text) {
  return String(text || "").trim();
}

async function analyzeFakeNews(text, options = {}) {
  const normalizedText = normalizeText(text);
  if (!normalizedText) {
    return null;
  }

  const analysis = await analyzeClaimWithOllama(normalizedText);

  return {
    claim: normalizedText,
    verdict: analysis.verdict,
    explanation: analysis.explanation,
    result: analysis.raw,
    source: "ollama",
    model: process.env.OLLAMA_MODEL || "mistral:latest",
    mode: options.mode || "simple",
  };
}

module.exports = {
  analyzeFakeNews,
};
