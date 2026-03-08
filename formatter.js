function getConfidenceEmoji(confidence) {
  if (confidence >= 85) return "🟢";
  if (confidence >= 75) return "🟡";
  if (confidence >= 65) return "🟠";
  return "🔴";
}

function getConfidenceLabel(confidence) {
  if (confidence >= 85) return "STRONG";
  if (confidence >= 75) return "GOOD";
  if (confidence >= 65) return "MODERATE";
  return "RISKY";
}

function getValueEmoji(valueRating) {
  if (!valueRating) return "💡";
  if (valueRating.includes("HIGH")) return "🔥";
  if (valueRating.includes("GOOD")) return "💰";
  return "📊";
}

function buildSportybetLink(searchTerm) {
  if (!searchTerm) return null;
  const encoded = encodeURIComponent(searchTerm);
  return `https://www.sportybet.com/gh/sport/football?query=${encoded}`;
}

function buildBar(confidence) {
  const filled = Math.round(confidence / 10);
  const empty = 10 - filled;
  return `${"▓".repeat(filled)}${"░".repeat(empty)} ${confidence}%`;
}

function escMd(text) {
  if (!text) return "";
  return String(text).replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
}

function formatPredictions(data) {
  const lines = [];
  const isValue = data.mode === "value";
  const modeLabel = isValue ? "VALUE MODE 💰" : "HIGH CONFIDENCE 🎯";

  lines.push(`⚽ *MATCH ORACLE — ${modeLabel}*`);
  lines.push(`📅 ${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}`);
  lines.push(`─────────────────────────`);
  lines.push(``);
  lines.push(`📊 *ANALYST SUMMARY*`);
  lines.push(escMd(data.summary));
  lines.push(``);

  if (!data.picks || data.picks.length === 0) {
    lines.push(`❌ *No qualifying picks found today\\.*`);
    lines.push(`_Avoid betting on low\\-confidence matchdays\\._`);
  } else {
    const pickCount = data.picks.length;
    lines.push(`🎯 *${pickCount} PICK${pickCount > 1 ? "S" : ""} TODAY*`);
    lines.push(``);

    data.picks.forEach((pick, i) => {
      const emoji = getConfidenceEmoji(pick.confidence);
      const label = getConfidenceLabel(pick.confidence);
      const bar = buildBar(pick.confidence);
      const sportyLink = buildSportybetLink(pick.sportybet_search || pick.match);

      lines.push(`${emoji} *PICK ${i + 1} — ${escMd(pick.match)}*`);
      lines.push(`🏆 ${escMd(pick.league)}`);
      lines.push(``);

      if (isValue && pick.valueRating) {
        lines.push(`${getValueEmoji(pick.valueRating)} *Value:* ${escMd(pick.valueRating)}`);
      }

      lines.push(`📋 *Bet Type:* ${escMd(pick.betType)}`);
      lines.push(`✅ *Selection:* \`${escMd(pick.selection)}\``);
      lines.push(`💰 *Est\\. Odds:* ${escMd(String(pick.estimatedOdds))}`);
      lines.push(`${emoji} *Confidence:* ${pick.confidence}% — ${escMd(label)}`);
      lines.push(`${escMd(bar)}`);
      lines.push(``);
      lines.push(`🔍 *Analysis:*`);
      lines.push(escMd(pick.analysis));
      lines.push(``);

      if (pick.keyFactors?.length) {
        lines.push(`📌 *Key Factors:*`);
        pick.keyFactors.forEach((f) => lines.push(`• ${escMd(f)}`));
        lines.push(``);
      }

      // SporyBet button (as inline link in text)
      if (sportyLink) {
        lines.push(`🎰 [Bet on SporyBet](${sportyLink})`);
      }

      if (i < data.picks.length - 1) {
        lines.push(``);
        lines.push(`─────────────────────────`);
        lines.push(``);
      }
    });
  }

  // Accumulator tip
  if (data.accumulatorTip) {
    lines.push(``);
    lines.push(`─────────────────────────`);
    lines.push(``);
    lines.push(`🔗 *ACCUMULATOR TIP*`);
    lines.push(escMd(data.accumulatorTip));
  }

  // Avoid matches
  if (data.avoidMatches?.length) {
    lines.push(``);
    lines.push(`─────────────────────────`);
    lines.push(``);
    lines.push(`🚫 *MATCHES TO AVOID*`);
    data.avoidMatches.forEach((m) => {
      lines.push(`• *${escMd(m.match)}*`);
      lines.push(`  _${escMd(m.reason)}_`);
    });
  }

  lines.push(``);
  lines.push(`─────────────────────────`);
  lines.push(``);
  lines.push(`💼 *BANKROLL TIP*`);
  lines.push(escMd(data.bankrollAdvice));
  lines.push(``);
  lines.push(`⚠️ _Predictions are for info only\\. Gamble responsibly\\._`);

  return lines.join("\n");
}

module.exports = { formatPredictions };
