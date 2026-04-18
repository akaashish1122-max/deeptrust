const fetchModule = require("node-fetch");
const fetch = fetchModule.default || fetchModule;

const OLLAMA_URL = String(process.env.OLLAMA_URL || "http://127.0.0.1:11434/api/generate").trim();
const OLLAMA_MODEL = String(process.env.OLLAMA_MODEL || "mistral:latest").trim();
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 75000);
const MAX_CLAIM_LENGTH = 500;

function cleanJsonText(value) {
  return String(value || "")
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

function normalizeModelVerdict(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized === "REAL" ? "REAL" : "FAKE";
}

async function queryOllama(prompt) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

  try {
    const response = await fetch(OLLAMA_URL, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        format: "json",
        prompt,
        options: {
          temperature: 0.1,
          top_p: 0.9,
          repeat_penalty: 1.05,
          num_predict: 120,
          seed: 42,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(errorText || `Ollama request failed with status ${response.status}`);
    }

    const data = await response.json();
    const content = String(data?.response || data?.message?.content || "").trim();

    if (!content) {
      throw new Error("Ollama returned an empty response.");
    }

    return content;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`Ollama request timed out after ${OLLAMA_TIMEOUT_MS}ms.`);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeClaim(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, MAX_CLAIM_LENGTH);
}

function buildFallbackExplanation(claim, verdict) {
  const normalizedClaim = normalizeClaim(claim);
  const loweredClaim = normalizedClaim.toLowerCase();

  if (verdict === "REAL") {
    if (/\bwater|hydration|sleep|exercise|vegetable|fruit\b/.test(loweredClaim)) {
      return "This claim is generally real because it matches common health guidance, but it is still a simplified statement. Good health depends on multiple factors, so the claim should be understood as broadly helpful rather than universally complete.";
    }

    return "This claim appears real because it aligns with broadly accepted facts and does not conflict with basic logic. The statement may be simplified, but its core idea is generally supported.";
  }

  if (/\bwater|hydration|sleep|exercise|vitamin|medicine|cure|healthy\b/.test(loweredClaim)) {
    return "This claim is likely fake or misleading because it is too absolute for a health statement. Healthy outcomes usually depend on several factors, so a broad claim like this needs more nuance and evidence.";
  }

  return "This claim is likely fake or misleading because it appears exaggerated, oversimplified, or unsupported by widely accepted facts. Claims stated with certainty need clear evidence, and that support is missing here.";
}

function buildFactCheckPrompt(userQuery) {
  return `Return valid JSON only with this exact shape: {"verdict":"REAL","explanation":"..."}.
Choose REAL if the claim is broadly correct, even if simplified.
Choose FAKE only if the core factual meaning is wrong or misleading.
Keep the explanation to 2 short sentences and do not use markdown.
Claim: "${normalizeClaim(userQuery)}"`;
}

function inferVerdictFromText(text) {
  const normalized = String(text || "").toLowerCase();

  if (/\b(fake|false|incorrect|inaccurate|misleading|myth|not true)\b/.test(normalized)) {
    return "FAKE";
  }

  if (/\b(real|true|correct|accurate|supported|factual)\b/.test(normalized)) {
    return "REAL";
  }

  return "FAKE";
}

function parseFactCheckResponse(rawResponse, claim = "") {
  const rawText = String(rawResponse || "").trim();
  const cleanedText = cleanJsonText(rawText);

  try {
    const parsed = JSON.parse(cleanedText);
    const verdict = normalizeModelVerdict(parsed.verdict);
    const explanation = String(parsed.explanation || "").replace(/\*\*/g, "").trim();

    return {
      verdict,
      explanation: explanation || buildFallbackExplanation(claim, verdict),
      raw: cleanedText,
    };
  } catch {
    const verdictMatch = cleanedText.match(/verdict\s*[:=]\s*(real|fake)/i);
    const explanationMatch = cleanedText.match(/explanation\s*[:=]\s*([\s\S]*)/i);

    const verdict = verdictMatch ? verdictMatch[1].toUpperCase() : inferVerdictFromText(cleanedText);
    const explanation = String(
      explanationMatch ? explanationMatch[1] : cleanedText.replace(/verdict\s*[:=]\s*(real|fake)/i, "")
    )
      .replace(/\*\*/g, "")
      .trim();

    return {
      verdict,
      explanation: explanation || buildFallbackExplanation(claim, verdict),
      raw: cleanedText,
    };
  }
}

async function analyzeClaimWithOllama(claim) {
  const prompt = buildFactCheckPrompt(claim);
  const rawResponse = await queryOllama(prompt);
  return parseFactCheckResponse(rawResponse, claim);
}

module.exports = {
  analyzeClaimWithOllama,
  buildFallbackExplanation,
  buildFactCheckPrompt,
  parseFactCheckResponse,
  queryOllama,
};
