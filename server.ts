import express from "express";
import path from "path";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import { parse } from "csv-parse/sync";

const PORT = 3000;
const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const TICK_RATE = 60;
const GAME_DURATION = 5 * 60 * 1000; // 5 minutes

interface Player {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  score: number;
  isP1: boolean;
  isNPC: boolean;
  facing: 1 | -1;
  isJumping: boolean;
}

interface Item {
  id: string;
  type: "red" | "yellow" | "diamond" | "bomb";
  x: number;
  y: number;
  points: number;
}

interface GameState {
  players: { [id: string]: Player };
  items: Item[];
  timer: number;
  platforms: { x: number; y: number; w: number; h: number }[];
}

const gameState: GameState = {
  players: {},
  items: [],
  timer: GAME_DURATION,
  platforms: [
    { x: 0, y: 550, w: 800, h: 50 }, // Ground
    { x: 100, y: 450, w: 200, h: 20 },
    { x: 500, y: 450, w: 200, h: 20 },
    { x: 300, y: 350, w: 200, h: 20 },
    { x: 100, y: 250, w: 200, h: 20 },
    { x: 500, y: 250, w: 200, h: 20 },
    { x: 300, y: 150, w: 200, h: 20 },
  ],
};

let itemCounter = 0;
let lastTick = Date.now();
let gameRunning = false;

async function fetchUsers() {
  try {
    const response = await axios.get(
      "https://docs.google.com/spreadsheets/d/1FM6pUWt414vao1ePQps_D5KeXOFeg5UcZJFU2y5ox1o/export?format=csv"
    );
    const records = parse(response.data, {
      columns: true,
      skip_empty_lines: true,
    });
    // Expect columns: id, password (case insensitive or as defined in sheet)
    return records;
  } catch (err) {
    console.error("Failed to fetch users from Google Sheets:", err);
    return [];
  }
}

function spawnItem() {
  if (gameState.items.length >= 10) return;
  const types: ("red" | "yellow" | "diamond" | "bomb")[] = ["red", "yellow", "diamond", "bomb"];
  const type = types[Math.floor(Math.random() * types.length)];
  let points = 0;
  if (type === "red") points = 10;
  if (type === "yellow") points = 20;
  if (type === "diamond") points = 50;
  if (type === "bomb") points = -50;

  const item: Item = {
    id: `item_${itemCounter++}`,
    type,
    x: Math.random() * (GAME_WIDTH - 40) + 20,
    y: Math.random() * (GAME_HEIGHT - 100) + 50,
    points,
  };
  gameState.items.push(item);
}

function resetGame() {
  gameState.timer = GAME_DURATION;
  gameState.items = [];
  for (const id in gameState.players) {
    gameState.players[id].score = 0;
    gameState.players[id].x = gameState.players[id].isP1 ? 100 : 700;
    gameState.players[id].y = 500;
    gameState.players[id].vx = 0;
    gameState.players[id].vy = 0;
  }
  gameRunning = true;
}

function updateNPC(npc: Player) {
  if (gameState.items.length === 0) return;

  // Find nearest non-bomb item if possible, or just nearest
  const target = gameState.items.reduce((prev, curr) => {
    const distPrev = Math.sqrt((prev.x - npc.x) ** 2 + (prev.y - npc.y) ** 2);
    const distCurr = Math.sqrt((curr.x - npc.x) ** 2 + (curr.y - npc.y) ** 2);
    
    // Avoid bombs unless forced? Let's say NPC avoids bombs if distance < 100
    if (curr.type === "bomb" && distCurr < 100) return prev;
    return distCurr < distPrev ? curr : prev;
  });

  if (target.x > npc.x + 5) npc.vx = 4;
  else if (target.x < npc.x - 5) npc.vx = -4;
  else npc.vx = 0;

  // Simple jump logic: if target is higher and we are on ground or platform
  if (target.y < npc.y - 10 && !npc.isJumping) {
    // Check if we need to jump to reach the target's height
    npc.vy = -12;
    npc.isJumping = true;
  }
  
  // Random jump if stuck
  if (Math.random() < 0.01 && !npc.isJumping) {
    npc.vy = -10;
    npc.isJumping = true;
  }
}

function gameLoop() {
  const now = Date.now();
  // const dt = (now - lastTick) / 1000;
  lastTick = now;

  if (!gameRunning) {
    // Check if we should start
    const pCountSize = Object.values(gameState.players).filter(p => !p.isNPC).length;
    if (pCountSize > 0) {
      // In practice, we handle auto-npc creation in connection logic
    }
  }

  if (gameRunning) {
    gameState.timer -= 1000 / TICK_RATE;
    if (gameState.timer <= 0) {
      gameState.timer = 0;
      gameRunning = false;
    }

    if (Math.random() < 0.02) spawnItem();

    for (const id in gameState.players) {
      const p = gameState.players[id];
      if (p.isNPC) updateNPC(p);

      p.vy += 0.5; // Gravity
      p.x += p.vx;
      p.y += p.vy;

      // Wrap-around or bounds
      if (p.x < 0) p.x = 0;
      if (p.x > GAME_WIDTH - 40) p.x = GAME_WIDTH - 40;

      // Collisions
      p.isJumping = true;
      for (const plat of gameState.platforms) {
        if (
          p.vy > 0 &&
          p.x + 30 > plat.x &&
          p.x + 10 < plat.x + plat.w &&
          p.y + 40 >= plat.y &&
          p.y + 40 <= plat.y + 10
        ) {
          p.y = plat.y - 40;
          p.vy = 0;
          p.isJumping = false;
        }
      }

      // Ground
      if (p.y > GAME_HEIGHT - 90) {
        p.y = GAME_HEIGHT - 90;
        p.vy = 0;
        p.isJumping = false;
      }

      // Item Pickup
      gameState.items = gameState.items.filter((item) => {
        const dist = Math.sqrt((item.x - (p.x + 20)) ** 2 + (item.y - (p.y + 20)) ** 2);
        if (dist < 30) {
          p.score += item.points;
          // Broadcast pickup event with coordinates for particles
          broadcast({ 
            type: "pickup", 
            itemId: item.id, 
            playerId: id, 
            itemType: item.type,
            x: item.x,
            y: item.y
          });
          return false;
        }
        return true;
      });
    }
  }

  broadcast({ type: "state", state: gameState });
}

let wss: WebSocketServer;
function broadcast(data: any) {
  const msg = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  wss = new WebSocketServer({ server });

  app.use(express.json());

  app.post("/api/login", async (req, res) => {
    const { id, password } = req.body;
    const users = await fetchUsers();
    const user = users.find((u: any) => {
      const uId = String(u.ID || u.id || u.accountId || u.loginId || "").trim();
      const uPwd = String(u.PW || u.pw || u.password || u.Password || "").trim();
      return uId === String(id).trim() && uPwd === String(password).trim();
    });

    if (user) {
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, message: "Invalid ID or Password" });
    }
  });

  wss.on("connection", (ws) => {
    let playerId: string | null = null;

    ws.on("message", (message) => {
      const data = JSON.parse(message.toString());

      if (data.type === "join") {
        playerId = data.id;
        const realPlayersCount = Object.values(gameState.players).filter(p => !p.isNPC).length;
        
        // Remove NPC if it exists and we are the second player
        if (realPlayersCount === 1) {
          for (const id in gameState.players) {
            if (gameState.players[id].isNPC) delete gameState.players[id];
          }
          resetGame();
        } else if (realPlayersCount === 0) {
          // First player joins, add NPC
          gameState.players["NPC_COM"] = {
            id: "NPC_COM",
            x: 700,
            y: 500,
            vx: 0,
            vy: 0,
            score: 0,
            isP1: false,
            isNPC: true,
            facing: -1,
            isJumping: false,
          };
          resetGame();
        }

        gameState.players[playerId!] = {
          id: playerId!,
          x: realPlayersCount === 0 ? 100 : 700,
          y: 500,
          vx: 0,
          vy: 0,
          score: 0,
          isP1: realPlayersCount === 0,
          isNPC: false,
          facing: realPlayersCount === 0 ? 1 : -1,
          isJumping: false,
        };
      }

      if (data.type === "input" && playerId && gameState.players[playerId]) {
        const p = gameState.players[playerId];
        if (data.input === "left") { p.vx = -5; p.facing = -1; }
        if (data.input === "right") { p.vx = 5; p.facing = 1; }
        if (data.input === "stopX") { p.vx = 0; }
        if (data.input === "jump" && !p.isJumping) {
          p.vy = -12;
          p.isJumping = true;
        }
      }
    });

    ws.on("close", () => {
      if (playerId) {
        delete gameState.players[playerId];
        // If no real players left, stop game and remove NPC
        const realPlayersCount = Object.values(gameState.players).filter(p => !p.isNPC).length;
        if (realPlayersCount === 0) {
          delete gameState.players["NPC_COM"];
          gameRunning = false;
        }
      }
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  setInterval(gameLoop, 1000 / TICK_RATE);

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
