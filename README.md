# Match Oracle ⚽ — Telegram Bot

AI-powered football prediction bot. Delivers 2–4 high-confidence picks via Telegram.

---

## Setup (5 minutes)

### Step 1 — Create your Telegram bot
1. Open Telegram and search for **@BotFather**
2. Send `/newbot`
3. Give it a name (e.g. `Match Oracle`) and a username (e.g. `matchoraclebot`)
4. Copy the **token** it gives you

### Step 2 — Get your Anthropic API key
- Go to [console.anthropic.com](https://console.anthropic.com)
- Create an API key and copy it

### Step 3 — Configure the bot
```bash
cp .env.example .env
```
Open `.env` and fill in:
```
TELEGRAM_BOT_TOKEN=your_token_from_botfather
ANTHROPIC_API_KEY=your_anthropic_key
```

### Step 4 — Install & run
```bash
npm install
npm start
```

Your bot is now live! Open Telegram, find your bot, and send `/start`.

---

## Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message |
| `/picks` | Start league selection and get predictions |
| `/skip` | Skip context input, go straight to predictions |
| `/help` | How to use the bot |

---

## Deploy to Railway (Free Tier — Recommended)

Railway keeps your bot running 24/7 for free.

1. Push to GitHub:
   ```bash
   git init && git add . && git commit -m "init"
   git remote add origin https://github.com/YOUR_USERNAME/match-oracle-bot.git
   git push -u origin main
   ```

2. Go to [railway.app](https://railway.app) → **New Project → Deploy from GitHub**

3. Select your repo

4. Go to **Variables** and add:
   - `TELEGRAM_BOT_TOKEN` = your token
   - `ANTHROPIC_API_KEY` = your key

5. Railway will auto-deploy. Your bot runs 24/7.

---

## Deploy to Render (Alternative Free Option)

1. Go to [render.com](https://render.com) → **New → Background Worker**
2. Connect your GitHub repo
3. Set **Build Command**: `npm install`
4. Set **Start Command**: `node bot.js`
5. Add environment variables in the dashboard
6. Deploy

---

## Project Structure

```
match-oracle-bot/
├── bot.js          ← Main bot logic, commands, conversation flow
├── predictor.js    ← Claude AI integration
├── formatter.js    ← Formats predictions into Telegram messages
├── .env.example    ← Copy to .env and fill in your keys
├── Procfile        ← For Railway/Render deployment
└── package.json
```

---

## How It Works

1. User sends `/picks`
2. Bot shows inline league selector buttons
3. User selects leagues, hits "Get Predictions"
4. Bot asks for optional extra context
5. Claude AI analyses form, H2H, injuries, motivation
6. Bot sends formatted picks with confidence scores

---

⚠️ **Responsible Gambling**: Never bet more than you can afford to lose.
