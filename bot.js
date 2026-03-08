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

// Store per-user session state
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
    sessions[chatId] = { selectedLeagues: [], step: "idle" };
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
  rows.push([{ text: "⚡ Get Predictions", callback_data: "get_predictions" }]);
  rows.push([{ text: "🔄 Clear Selection", callback_data: "clear_leagues" }]);
  return { inline_keyboard: rows };
}

// /start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const session = getSession(chatId);
  session.step = "idle";

  bot.sendMessage(
    chatId,
    `⚽ *Welcome to Match Oracle\\!*\n\n` +
    `I analyze football matches and deliver *2\\-4 high\\-confidence picks* only\\. No noise\\.\n\n` +
    `*Commands:*\n` +
    `/picks — Get AI predictions\n` +
    `/help — How to use this bot\n\n` +
    `_Powered by Claude AI_`,
    { parse_mode: "MarkdownV2" }
  );
});

// /help command
bot.onText(/\/help/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `🤖 *How Match Oracle Works*\n\n` +
    `1\\. Send /picks\n` +
    `2\\. Select the leagues you want analysed\n` +
    `3\\. Optionally add extra context \\(injuries, specific matches\\)\n` +
    `4\\. Get your picks\\!\n\n` +
    `*Bet types covered:*\n` +
    `• Match Result \\(1X2\\)\n` +
    `• Both Teams to Score\n` +
    `• Over\\/Under 2\\.5 Goals\n` +
    `• Asian Handicap\n` +
    `• Draw No Bet\n\n` +
    `⚠️ _Only bet what you can afford to lose\\._`,
    { parse_mode: "MarkdownV2" }
  );
});

// /picks command — show league selector
bot.onText(/\/picks/, (msg) => {
  const chatId = msg.chat.id;
  const session = getSession(chatId);
  session.selectedLeagues = [];
  session.step = "selecting_leagues";

  bot.sendMessage(
    chatId,
    `🏆 *Select leagues to analyse:*\n_Tap to toggle, then hit Get Predictions_`,
    {
      parse_mode: "MarkdownV2",
      reply_markup: buildLeagueKeyboard(session.selectedLeagues),
    }
  );
});

// Handle inline button presses
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const data = query.data;
  const session = getSession(chatId);

  // Toggle a league
  if (data.startsWith("toggle_")) {
    const leagueId = data.replace("toggle_", "");
    const idx = session.selectedLeagues.indexOf(leagueId);
    if (idx === -1) {
      session.selectedLeagues.push(leagueId);
    } else {
      session.selectedLeagues.splice(idx, 1);
    }

    await bot.editMessageReplyMarkup(
      buildLeagueKeyboard(session.selectedLeagues),
      { chat_id: chatId, message_id: messageId }
    );
    await bot.answerCallbackQuery(query.id);
    return;
  }

  // Clear selection
  if (data === "clear_leagues") {
    session.selectedLeagues = [];
    await bot.editMessageReplyMarkup(
      buildLeagueKeyboard(session.selectedLeagues),
      { chat_id: chatId, message_id: messageId }
    );
    await bot.answerCallbackQuery(query.id, { text: "Selection cleared" });
    return;
  }

  // Get predictions
  if (data === "get_predictions") {
    if (session.selectedLeagues.length === 0) {
      await bot.answerCallbackQuery(query.id, {
        text: "⚠️ Please select at least one league first!",
        show_alert: true,
      });
      return;
    }

    await bot.answerCallbackQuery(query.id);
    await bot.editMessageText(
      `⏳ *Analysing ${session.selectedLeagues.join(", ")}\\.\\.\\.*\n\n_This takes 10\\-20 seconds\\._`,
      { chat_id: chatId, message_id: messageId, parse_mode: "MarkdownV2" }
    );

    // Ask for extra context
    session.step = "awaiting_context";
    session.pendingMessageId = messageId;

    await bot.sendMessage(
      chatId,
      `💬 *Any extra context?*\n\nType info like injuries, specific matches, or time range \\— or send /skip to go straight to predictions\\.`,
      { parse_mode: "MarkdownV2" }
    );
    return;
  }
});

// Handle text messages (for context input)
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const session = getSession(chatId);
  const text = msg.text || "";

  // Ignore commands other than /skip
  if (text.startsWith("/") && text !== "/skip") return;

  if (session.step === "awaiting_context") {
    const context = text === "/skip" ? "" : text;
    session.step = "loading";

    const loadingMsg = await bot.sendMessage(
      chatId,
      `🔍 *Running analysis\\.\\.\\.*\n\n` +
      `${session.selectedLeagues.map((l) => `• ${l}`).join("\n").replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&")}\n\n` +
      `_Crunching form tables, H2H records, and tactical data\\.\\.\\._`,
      { parse_mode: "MarkdownV2" }
    );

    try {
      const predictions = await getPredictions(session.selectedLeagues, context);
      const formatted = formatPredictions(predictions);

      await bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});
      await bot.sendMessage(chatId, formatted, {
        parse_mode: "MarkdownV2",
        reply_markup: {
          inline_keyboard: [[
            { text: "🔄 New Picks", callback_data: "new_picks" },
            { text: "📊 Same Leagues", callback_data: "same_leagues" },
          ]],
        },
      });
    } catch (err) {
      console.error("Prediction error:", err);
      await bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});
      await bot.sendMessage(
        chatId,
        `❌ *Analysis failed\\.*\n\n_${err.message.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&")}_\n\nTry /picks again\\.`,
        { parse_mode: "MarkdownV2" }
      );
    }

    session.step = "idle";
    return;
  }

  // Handle post-prediction buttons
  if (msg.text === "/new_picks") {
    bot.emit("text", { ...msg, text: "/picks" });
  }
});

// Handle "New Picks" and "Same Leagues" post-result buttons
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const session = getSession(chatId);

  if (query.data === "new_picks") {
    await bot.answerCallbackQuery(query.id);
    session.selectedLeagues = [];
    session.step = "selecting_leagues";
    await bot.sendMessage(
      chatId,
      `🏆 *Select leagues to analyse:*`,
      {
        parse_mode: "MarkdownV2",
        reply_markup: buildLeagueKeyboard(session.selectedLeagues),
      }
    );
    return;
  }

  if (query.data === "same_leagues") {
    await bot.answerCallbackQuery(query.id);
    if (!session.selectedLeagues?.length) {
      await bot.sendMessage(chatId, "No previous leagues found\\. Use /picks", { parse_mode: "MarkdownV2" });
      return;
    }
    session.step = "awaiting_context";
    await bot.sendMessage(
      chatId,
      `💬 *Any extra context?* Send /skip to use the same settings\\.`,
      { parse_mode: "MarkdownV2" }
    );
    return;
  }
});

console.log("✅ Match Oracle bot is running...");
