# 🎮 iGRI Fantasy Arena — Discord Prediction Bot

A complete, production-ready Discord bot for the **iGRI FiveM Multi-Lobby Tournament Prediction Arena**. Built strictly for Discord using **TypeScript**, **Discord.js v14**, and **SQLite (WAL Mode)**.

---

## 🌟 Key Features

* **Multi-Lobby Esports Markets (BGMI / FiveM Style):**
  * 🥇 **1st Place Winner** (WWCD / Match Winner)
  * 🥉 **Top 3 Podium Finish** (1st, 2nd, or 3rd place)
  * 🎯 **Top Fragger** (Most Kills in the lobby)
* **Pari-Mutuel Season Combo Pool:**
  * 2 to 5 distinct match combinations per slip.
  * Proportional payout weights ($W_i = S_i \times \prod O_{ij}$).
  * 5% gross pool coin sink.
  * Minimum 1.05x win floor protection.
  * Capped rollover reserve (up to 100,000 coins).
* **The "Void Leg" (Push) Rule:**
  * If a FiveM match is cancelled or postponed, that leg's odds become `1.0x` instead of destroying the player's entire combo ticket!
* **Daily Mystery Box (`/daily`):**
  * 24-hour interactive lootbox with 5 rarity tiers (Common to Mega Jackpot) + daily streak multipliers (+5% per day).
* **Player Dossier & Profile (`/profile`):**
  * Accuracy %, Net Profit, Biggest Win, Equipped Titles, and Badges.
* **Ranked Season Leaderboard (`/leaderboard`):**
  * Composite scoring formula: `0.60 × Profit Score + 0.40 × Accuracy Score`.
* **Vanity Shop (`/shop`):**
  * Spend virtual coins on custom server titles, badges, and Discord roles (the ultimate coin sink).
* **One-Click Slip Copying:**
  * Players can copy friends' prediction slips straight from Discord with the **`[ 📋 Copy Ticket ]`** button.
* **Double-Entry Transaction Ledger:**
  * Strict atomic ACID database transactions preventing double-spending or race conditions.

---

## 🛠️ Quick Setup Guide

### 1. Discord Developer Portal Setup
1. Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2. Click **New Application** and name it (e.g. `iGRI Fantasy Arena`).
3. Under **Bot**:
   * Click **Add Bot**.
   * Reset/Copy the **Token**.
   * Under **Privileged Gateway Intents**, enable **Server Members Intent** and **Message Content Intent**.
4. Under **OAuth2** -> **URL Generator**:
   * Scopes: `bot`, `applications.commands`
   * Bot Permissions: `Send Messages`, `Embed Links`, `Attach Files`, `Use External Emojis`, `Manage Roles`
   * Copy the URL and invite the bot to your Discord server.

---

### 2. Configure `.env`
Edit the `.env` file in the project root:

```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_discord_application_client_id
GUILD_ID=your_discord_server_id (for instant slash command registration)
ADMIN_ROLE_ID=optional_role_id_with_admin_rights
```

---

### 3. Deploy Slash Commands & Run

```bash
# 1. Install dependencies (already installed)
npm install

# 2. Deploy slash commands to your Discord server
npm run deploy-commands

# 3. Start the bot in development mode (hot-reload)
npm run dev

# Or run the production build
npm run build
npm start
```

---

## 🕹️ Discord Commands

### Player Commands
| Command | Description |
| :--- | :--- |
| `/igri` | Central dashboard with interactive quick-action buttons. |
| `/predict` | Build and lock in a 2 to 5 match combo prediction ticket. |
| `/matches` | View upcoming open tournament lobbies, teams, and countdown locks. |
| `/balance` | Check available balance, open stakes, and transaction history. |
| `/mytickets` | Live ticket tracker with won/lost/pending leg indicators. |
| `/daily` | Open your 24-hour Daily Mystery Box for bonus coins & streaks. |
| `/profile [user]` | View player dossier, accuracy, badges, and equipped titles. |
| `/leaderboard` | Ranked season standings combining Profit (60%) and Accuracy (40%). |
| `/shop` | Browse and buy exclusive titles, badges, and roles. |

---

### Administrator Commands (Admin Only)
| Command | Description |
| :--- | :--- |
| `/admin match-create` | Create a new match lobby with participating teams and deadline. |
| `/admin match-list` | View all matches and statuses (`OPEN`, `LOCKED`, `SETTLED`). |
| `/admin result` | Enter official results: **1st Place, 2nd Place, 3rd Place, and Top Fragger**. The bot automatically updates all player tickets. |
| `/admin cancel` | Cancel a match and trigger the **Void Leg (Push)** rule or refund. |
| `/admin season-settle` | Calculate the season pool, burn the 5% sink, and distribute winnings! |
| `/admin audit` | View total money supply, active tickets, and economy telemetry. |

---

## 🧪 Simulation Testing

You can run the built-in end-to-end engine test anytime without needing a live Discord connection:

```bash
npm test
```
This tests all 10 core systems: database, wallet grants, mystery box, combo tickets, results settlement, void legs, proportional payouts, leaderboard rankings, and shop purchases.
