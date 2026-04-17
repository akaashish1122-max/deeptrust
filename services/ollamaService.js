const fetchModule = require("node-fetch");
const fetch = fetchModule.default || fetchModule;

const OLLAMA_URL = String(process.env.OLLAMA_URL || "http://localhost:11434/api/generate").trim();
const OLLAMA_MODEL = String(process.env.OLLAMA_MODEL || "phi3:mini").trim();

async function queryOllama(prompt) {
  const response = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(errorText || `Ollama request failed with status ${response.status}`);
  }

  const data = await response.json();
  return String(data.response || "").trim();
}

function normalizeLabel(value) {
  const label = String(value || "").trim().toUpperCase();

  if (label.includes("MISLEADING")) return "MISLEADING";
  if (label.includes("FAKE")) return "FAKE";
  if (label.includes("REAL")) return "REAL";
  return "MISLEADING";
}

function buildFactCheckPrompt(userQuery) {
  return `
You are a strict fact-checking AI.

Classify the claim into one of:
REAL, FAKE, or MISLEADING.

Rules:
- If the claim is scientifically incorrect or a common myth -> FAKE
- If partially true or exaggerated -> MISLEADING
- If correct and supported -> REAL
- NEVER say "no evidence" without giving a label
- ALWAYS give final decision

Claim: "${String(userQuery || "").trim()}"

Output format:
Label: <REAL or FAKE or MISLEADING>
Reason: <clear short explanation>
`;
}

function parseFactCheckResponse(raw) {
  const text = String(raw || "").trim();
  const labelMatch = text.match(/Label:\s*(REAL|FAKE|MISLEADING)/i);
  const reasonMatch = text.match(/Reason:\s*([\s\S]+)/i);
  const label = normalizeLabel(labelMatch?.[1] || text);
  const reason = String(reasonMatch?.[1] || text).trim() || "No explanation provided.";

  return {
    label,
    reason,
    raw: text,
  };
}

async function analyzeClaimWithOllama(claim) {
  const prompt = buildFactCheckPrompt(claim);
  const raw = await queryOllama(prompt);
  return parseFactCheckResponse(raw);
}

module.exports = {
  analyzeClaimWithOllama,
  buildFactCheckPrompt,
  queryOllama,
};
