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

function formatPredictions(data) {
  const lines = [];

  lines.push(`⚽ *MATCH ORACLE — AI PICKS*`);
  lines.push(`📅 ${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}`);
  lines.push(`─────────────────────────`);
  lines.push(``);
  lines.push(`📊 *ANALYST SUMMARY*`);
  lines.push(escMd(data.summary));
  lines.push(``);

  if (!data.picks || data.picks.length === 0) {
    lines.push(`❌ *No high\\-confidence picks found today\\.*`);
    lines.push(`Avoid betting on low\\-confidence matchdays\\.`);
  } else {
    lines.push(`🎯 *TODAY'S PICKS \\(${data.picks.length}\\)*`);
    lines.push(``);

    data.picks.forEach((pick, i) => {
      const emoji = getConfidenceEmoji(pick.confidence);
      const label = getConfidenceLabel(pick.confidence);
      const bar = buildBar(pick.confidence);

      lines.push(`${emoji} *PICK ${i + 1} — ${escMd(pick.match)}*`);
      lines.push(`🏆 ${escMd(pick.league)}`);
      lines.push(``);
      lines.push(`📋 *Bet Type:* ${escMd(pick.betType)}`);
      lines.push(`✅ *Selection:* \`${escMd(pick.selection)}\``);
      lines.push(`💰 *Est\\. Odds:* ${escMd(String(pick.estimatedOdds))}`);
      lines.push(`${emoji} *Confidence:* ${pick.confidence}% — ${label}`);
      lines.push(`${bar}`);
      lines.push(``);
      lines.push(`🔍 *Analysis:*`);
      lines.push(escMd(pick.analysis));
      lines.push(``);

      if (pick.keyFactors?.length) {
        lines.push(`📌 *Key Factors:*`);
        pick.keyFactors.forEach((f) => lines.push(`• ${escMd(f)}`));
      }

      if (i < data.picks.length - 1) {
        lines.push(``);
        lines.push(`─────────────────────────`);
        lines.push(``);
      }
    });
  }

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

function buildBar(confidence) {
  const filled = Math.round(confidence / 10);
  const empty = 10 - filled;
  return `▓`.repeat(filled) + `░`.repeat(empty) + ` ${confidence}%`;
}

// Escape special MarkdownV2 chars
function escMd(text) {
  if (!text) return "";
  return String(text).replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
}

module.exports = { formatPredictions };
