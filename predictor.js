const fetch = require("node-fetch");

const SYSTEM_PROMPT = `You are an elite football (soccer) betting analyst with 20+ years of experience. Your job is to analyze upcoming matches and provide HIGH-CONFIDENCE predictions with surgical precision.

RULES:
- Only recommend 2-4 picks maximum. Quality over quantity.
- Each pick must have a confidence score (60%-95%)
- Only recommend picks with 70%+ confidence
- Analyze: team form (last 5 games), head-to-head records, home/away performance, injuries, motivation, tactical matchups
- Bet types: Match Result (1X2), Both Teams to Score, Over/Under 2.5 goals, Asian Handicap, Draw No Bet
- Be brutally honest. If no high-confidence picks exist, say so.
- Format your response as JSON only, no markdown, no backticks:

{
  "summary": "Brief 1-2 sentence overview",
  "picks": [
    {
      "match": "Team A vs Team B",
      "league": "League Name",
      "betType": "Bet type",
      "selection": "Exact selection",
      "estimatedOdds": "1.85",
      "confidence": 78,
      "analysis": "Sharp reasoning in 2-3 sentences",
      "keyFactors": ["Factor 1", "Factor 2", "Factor 3"]
    }
  ],
  "avoidMatches": [
    { "match": "Team C vs Team D", "reason": "Why to avoid" }
  ],
  "bankrollAdvice": "One sentence tip"
}`;

async function getPredictions(leagues, context = "") {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const userPrompt = `Analyze upcoming football matches for: ${leagues.join(", ")}.
Today: ${today}.
${context ? `Extra context: ${context}` : ""}
Provide only 2-4 high-confidence picks. Quality over quantity.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || "Anthropic API error");
  }

  const data = await response.json();
  const text = data.content?.map((b) => b.text || "").join("") || "";
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

module.exports = { getPredictions };
