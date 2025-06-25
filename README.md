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
- Track game state, logs, turns, and HP
- Play cards via text commands (easily testable via `curl`)
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

> Replace `<URL>` with your Codespaces domain (e.g. `https://animated-bassoon-jqq44xj75qwfqw4g-3000.app.github.dev`)

### ✅ Test the server

```bash
curl -k <URL>/game/test
```

### 🎮 Start a new game

```bash
curl -k -X POST <URL>/game/start
```

### 🔥 Play a card

```bash
curl -k -X POST <URL>/game/play-card \
  -H "Content-Type: application/json" \
  -d '{"player": "A", "card": "fireball"}'
```

### 📊 Get current game state

```bash
curl -k <URL>/game/state
```

---

## 📘 Swagger Documentation

Accessible at:

```
<URL>/api
```

---

## 🧱 Architecture

- `GameModule` → Handles all match logic  
- `GameService` → Controls state and rules  
- `GameController` → Exposes REST endpoints for actions  
- `PlayCardDto` → DTO for incoming move commands  
- `GameState` → Tracks players, turn, logs, HP, etc.

---

## 📅 Roadmap

- [ ] Card database and unique effects  
- [ ] Life points and match end  
- [ ] Deck system and shuffling  
- [ ] Multiplayer with WebSocket  
- [ ] PvE support (bot as opponent)

---

## ⚖ License

- none yet