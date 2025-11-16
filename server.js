const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// rooms[roomId] = [ws, ws]
const rooms = {};
// players waiting for a match
const waiting = [];

wss.on("connection", (ws) => {
  console.log("Client connected");

  ws.on("message", (msg) => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch (e) {
      console.error("Bad message:", msg.toString());
      return;
    }

    // --- QUEUE / MATCHMAKING ---
    if (data.type === "queue") {
      // already in a room? ignore
      if (ws.roomId) return;

      // already waiting? ignore
      if (waiting.includes(ws)) return;

      if (waiting.length > 0) {
        const other = waiting.shift();

        const roomId =
          "room-" + Date.now() + "-" + Math.floor(Math.random() * 10000);

        ws.roomId = roomId;
        other.roomId = roomId;
        rooms[roomId] = [ws, other];

        console.log("Paired players into", roomId);

        ws.send(
          JSON.stringify({
            type: "queueStatus",
            state: "paired",
            roomId,
          })
        );
        other.send(
          JSON.stringify({
            type: "queueStatus",
            state: "paired",
            roomId,
          })
        );
      } else {
        waiting.push(ws);
        ws.send(
          JSON.stringify({
            type: "queueStatus",
            state: "waiting",
          })
        );
      }
      return;
    }

    // --- Relay card deploy events inside a room ---
    if (data.type === "event" && ws.roomId) {
      const peers = rooms[ws.roomId] || [];
      for (const client of peers) {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(data));
        }
      }
      return;
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");

    // remove from waiting queue
    const idx = waiting.indexOf(ws);
    if (idx !== -1) waiting.splice(idx, 1);

    // remove from room
    const roomId = ws.roomId;
    if (roomId && rooms[roomId]) {
      rooms[roomId] = rooms[roomId].filter((c) => c !== ws);
      if (rooms[roomId].length === 0) {
        delete rooms[roomId];
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
