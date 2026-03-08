require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const { getPredictions } = require("./predictor");
const { formatPredictions } = require("./formatter");

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("❌ TELEGRAM_BOT_TOKEN not set in .env");
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

// Per-user session state
const sessions = {};

const LEAGUES = [
  { id: "Premier League", label: "🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League" },
  { id: "La Liga", label: "🇪🇸 La Liga" },
  { id: "Bundesliga", label: "🇩🇪 Bundesliga" },
  { id: "Serie A", label: "🇮🇹 Serie A" },
  { id: "Ligue 1", label: "🇫🇷 Ligue 1" },
  { id: "Champions League", label: "🏆 Champions League" },
  { id: "Europa League", label: "🟠 Europa League" },
  { id: "MLS", label: "🇺🇸 MLS" },
];

function getSession(chatId) {
  if (!sessions[chatId]) {
    sessions[chatId] = {
      selectedLeagues: [],
      mode: "high_confidence",
      step: "idle",
    };
  }
  return sessions[chatId];
}

function buildLeagueKeyboard(selected) {
  const rows = [];
  for (let i = 0; i < LEAGUES.length; i += 2) {
    const row = [];
    [LEAGUES[i], LEAGUES[i + 1]].forEach((league) => {
      if (!league) return;
      const isSelected = selected.includes(league.id);
      row.push({
        text: `${isSelected ? "✅ " : ""}${league.label}`,
        callback_data: `toggle_${league.id}`,
      });
    });
    rows.push(row);
  }
  rows.push([
    { text: "✅ Done — Choose Mode", callback_data: "choose_mode" },
    { text: "🔄 Clear", callback_data: "clear_leagues" },
  ]);
  return { inline_keyboard: rows };
}

function buildModeKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "🎯 High Confidence (2-4 elite picks)", callback_data: "mode_high_confidence" },
      ],
      [
        { text: "💰 Value Mode (up to 10 picks)", callback_data: "mode_value" },
      ],
    ],
  };
}

function buildPostResultKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "🔄 New Picks", callback_data: "new_picks" },
        { text: "♻️ Same Leagues", callback_data: "same_leagues" },
      ],
      [
        { text: "🔀 Switch Mode", callback_data: "switch_mode" },
      ],
    ],
  };
}


// ─── HELPERS ─────────────────────────────────────────────────

function splitMessage(text, maxLen) {
  maxLen = maxLen || 4000;
  if (text.length <= maxLen) return [text];
  var chunks = [];
  var lines = text.split('\n');
  var current = '';
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if ((current + '\n' + line).length > maxLen) {
      if (current) chunks.push(current.trim());
      current = line;
    } else {
      current = current ? current + '\n' + line : line;
    }
  }
  if (current) chunks.push(current.trim());
  return chunks;
}

// ─── COMMANDS ────────────────────────────────────────────────

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  getSession(chatId).step = "idle";

  bot.sendMessage(chatId,
    `⚽ *Welcome to Match Oracle\\!*\n\n` +
    `I deliver AI\\-powered football betting picks straight to Telegram \\— with direct SporyBet links so you can act instantly\\.\n\n` +
    `*Two modes:*\n` +
    `🎯 *High Confidence* — 2\\-4 elite picks at 78%\\+ confidence\n` +
    `💰 *Value Mode* — up to 10 value bets at 60%\\+\n\n` +
    `*Commands:*\n` +
    `/picks — Get predictions\n` +
    `/help — How to use\n\n` +
    `_Powered by Claude AI_`,
    { parse_mode: "MarkdownV2" }
  );
});

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id,
    `🤖 *How Match Oracle Works*\n\n` +
    `1\\. Send /picks\n` +
    `2\\. Select your leagues\n` +
    `3\\. Choose your mode \\(High Confidence or Value\\)\n` +
    `4\\. Add optional context or /skip\n` +
    `5\\. Get picks with SporyBet links\\!\n\n` +
    `*🎯 High Confidence Mode*\n` +
    `2\\-4 picks at 78%\\+ confidence\\. For cautious bettors who want quality over quantity\\.\n\n` +
    `*💰 Value Mode*\n` +
    `Up to 10 picks at 60%\\+\\. For bettors who understand value and manage stakes\\.\n\n` +
    `*Bet types covered:*\n` +
    `• Match Result \\(1X2\\)\n` +
    `• Both Teams to Score \\(BTTS\\)\n` +
    `• Over\\/Under 2\\.5 Goals\n` +
    `• Asian Handicap\n` +
    `• Draw No Bet\n` +
    `• Double Chance\n\n` +
    `⚠️ _Never bet more than you can afford to lose\\._`,
    { parse_mode: "MarkdownV2" }
  );
});

bot.onText(/\/picks/, (msg) => {
  const chatId = msg.chat.id;
  const session = getSession(chatId);
  session.selectedLeagues = [];
  session.step = "selecting_leagues";

  bot.sendMessage(chatId,
    `🏆 *Step 1 — Select leagues:*\n_Tap to toggle, then press Done_`,
    {
      parse_mode: "MarkdownV2",
      reply_markup: buildLeagueKeyboard(session.selectedLeagues),
    }
  );
});

// ─── CALLBACK QUERIES ─────────────────────────────────────────

bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const data = query.data;
  const session = getSession(chatId);

  // Toggle league
  if (data.startsWith("toggle_")) {
    const leagueId = data.replace("toggle_", "");
    const idx = session.selectedLeagues.indexOf(leagueId);
    if (idx === -1) session.selectedLeagues.push(leagueId);
    else session.selectedLeagues.splice(idx, 1);

    await bot.editMessageReplyMarkup(
      buildLeagueKeyboard(session.selectedLeagues),
      { chat_id: chatId, message_id: messageId }
    ).catch(() => {});
    await bot.answerCallbackQuery(query.id);
    return;
  }

  // Clear leagues
  if (data === "clear_leagues") {
    session.selectedLeagues = [];
    await bot.editMessageReplyMarkup(
      buildLeagueKeyboard(session.selectedLeagues),
      { chat_id: chatId, message_id: messageId }
    ).catch(() => {});
    await bot.answerCallbackQuery(query.id, { text: "Selection cleared" });
    return;
  }

  // Done — go to mode selection
  if (data === "choose_mode") {
    if (session.selectedLeagues.length === 0) {
      await bot.answerCallbackQuery(query.id, {
        text: "⚠️ Select at least one league first!",
        show_alert: true,
      });
      return;
    }
    await bot.answerCallbackQuery(query.id);
    await bot.editMessageText(
      `✅ *Leagues selected:*\n${session.selectedLeagues.map(l => `• ${l}`).join("\n").replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&")}\n\n*Step 2 — Choose your mode:*`,
      {
        chat_id: chatId, message_id: messageId,
        parse_mode: "MarkdownV2",
        reply_markup: buildModeKeyboard(),
      }
    );
    return;
  }

  // Mode selected
  if (data.startsWith("mode_")) {
    const mode = data.replace("mode_", "");
    session.mode = mode;
    await bot.answerCallbackQuery(query.id);

    const modeLabel = mode === "high_confidence" ? "🎯 High Confidence" : "💰 Value Mode";
    await bot.editMessageText(
      `${modeLabel} selected\\.\n\n*Step 3 — Any extra context?*\n_Type info like injuries, specific fixtures, or send /skip_`,
      { chat_id: chatId, message_id: messageId, parse_mode: "MarkdownV2" }
    );
    session.step = "awaiting_context";
    return;
  }

  // Switch mode (post-result)
  if (data === "switch_mode") {
    await bot.answerCallbackQuery(query.id);
    session.step = "idle";
    await bot.sendMessage(chatId,
      `*Switch mode:*`,
      { parse_mode: "MarkdownV2", reply_markup: buildModeKeyboard() }
    );
    // After mode picked, go to context step
    session.step = "awaiting_context";
    return;
  }

  // New picks
  if (data === "new_picks") {
    await bot.answerCallbackQuery(query.id);
    session.selectedLeagues = [];
    session.step = "selecting_leagues";
    await bot.sendMessage(chatId,
      `🏆 *Step 1 — Select leagues:*`,
      { parse_mode: "MarkdownV2", reply_markup: buildLeagueKeyboard([]) }
    );
    return;
  }

  // Same leagues — skip to mode
  if (data === "same_leagues") {
    await bot.answerCallbackQuery(query.id);
    if (!session.selectedLeagues?.length) {
      await bot.sendMessage(chatId, "No previous leagues\\. Use /picks", { parse_mode: "MarkdownV2" });
      return;
    }
    await bot.sendMessage(chatId,
      `*Choose mode:*`,
      { parse_mode: "MarkdownV2", reply_markup: buildModeKeyboard() }
    );
    session.step = "awaiting_context";
    return;
  }
});

// ─── MESSAGE HANDLER ──────────────────────────────────────────

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const session = getSession(chatId);
  const text = msg.text || "";

  // Ignore non-context commands
  if (text.startsWith("/") && text !== "/skip") return;

  if (session.step !== "awaiting_context") return;

  const context = text === "/skip" ? "" : text;
  session.step = "loading";

  const modeLabel = session.mode === "high_confidence" ? "🎯 High Confidence" : "💰 Value Mode";
  const leagueList = session.selectedLeagues
    .map(l => `• ${l}`)
    .join("\n")
    .replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&");

  const loadingMsg = await bot.sendMessage(chatId,
    `🔍 *Running ${modeLabel} analysis\\.\\.\\.*\n\n${leagueList}\n\n_Crunching form, H2H, injuries and value data\\.\\.\\._`,
    { parse_mode: "MarkdownV2" }
  );

  try {
    const predictions = await getPredictions(session.selectedLeagues, context, session.mode);
    const formatted = formatPredictions(predictions);

    await bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});

    // Split into chunks if message exceeds Telegram's 4096 char limit
    const chunks = splitMessage(formatted, 4000);
    for (let i = 0; i < chunks.length; i++) {
      const isLast = i === chunks.length - 1;
      await bot.sendMessage(chatId, chunks[i], {
        parse_mode: "MarkdownV2",
        reply_markup: isLast ? buildPostResultKeyboard() : undefined,
        disable_web_page_preview: true,
      });
    }
  } catch (err) {
    console.error("Prediction error:", err);
    await bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});
    await bot.sendMessage(chatId,
      `❌ *Analysis failed\\.*\n\n_${String(err.message).replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&")}_\n\nTry /picks again\\.`,
      { parse_mode: "MarkdownV2" }
    );
  }

  session.step = "idle";
});

console.log("✅ Match Oracle bot is running...");
