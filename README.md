# Chronos – Mythological Card Game Engine (Backend)

**Chronos** is the backend engine for a multiplayer online card game inspired by mythology and classic battle card mechanics (inspired by Dracomania). This service handles all game rules, player logic, turn rotation, card resolution, and battle flow.

## 🛠 Tech Stack

- [NestJS](https://nestjs.com/) – backend framework (TypeScript)
- REST API + Swagger for testing
- Future support: WebSocket for real-time interaction
- Deployment: GitHub Codespaces / Docker-ready

---

## 📦 Features

- Create and manage a match between 2 players
- Track game state, logs, turns, HP, and player hands
- Each player draws a random hand of 5 cards
- Only cards in hand can be played
- REST endpoints for game actions
- Swagger docs available at `/api`

---

## 🚀 Getting Started (Codespaces)

1. Open this repo in GitHub Codespaces
2. Run the NestJS app:
   ```bash
   npm run start:dev
   ```
3. Make port `3000` public in Codespaces

---

## 🧪 Testing the API

> You can test everything directly from the terminal using the commands below.

### ✅ Test the server

```bash
curl -k https://animated-bassoon-jqq44xj75qwfqw4g-3000.app.github.dev/game/test
```

### 🎮 Start a new game

```bash
curl -k -X POST https://animated-bassoon-jqq44xj75qwfqw4g-3000.app.github.dev/game/start
```

### 🔥 Play a card

> ⚠️ The player must have the card in hand! Check `/game/state` first.

```bash
curl -k -X POST https://animated-bassoon-jqq44xj75qwfqw4g-3000.app.github.dev/game/play-card \
  -H "Content-Type: application/json" \
  -d '{"player": "A", "card": "fireball"}'
```

### 📊 Get current game state (to see HP, hands, log)

```bash
curl -k https://animated-bassoon-jqq44xj75qwfqw4g-3000.app.github.dev/game/state
```

### 📈 Final Result Summary

```bash
curl -k https://animated-bassoon-jqq44xj75qwfqw4g-3000.app.github.dev/game/result
```

---

## 📘 Swagger Documentation

Accessible at:

```
https://animated-bassoon-jqq44xj75qwfqw4g-3000.app.github.dev/api
```

---

## 🧱 Architecture

- `GameModule` → Handles all match logic
- `GameService` → Controls state and rules
- `GameController` → Exposes REST endpoints for actions
- `PlayCardDto` → DTO for incoming move commands
- `GameState` → Tracks players, turn, logs, HP, and hands

---

## 📅 Roadmap

- [x] Random hand per player
- [x] Play only valid cards
- [x] Card database and unique effects
- [x] Life points and match end
- [x] Full deck and draw per turn
- [x] Multiplayer with WebSocket (basic events working)
- [ ] PvE support (bot as opponent)
