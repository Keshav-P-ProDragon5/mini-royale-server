const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// simple in-memory rooms (temporary but works)
const rooms = {};

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

    if (data.type === "join") {
      ws.roomId = data.roomId;
      rooms[ws.roomId] = rooms[ws.roomId] || [];
      rooms[ws.roomId].push(ws);
      console.log("Joined room:", ws.roomId);
    }

    if (data.type === "event" && ws.roomId) {
      const peers = rooms[ws.roomId] || [];
      for (const client of peers) {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(data));
        }
      }
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
    const room = rooms[ws.roomId];
    if (!room) return;
    rooms[ws.roomId] = room.filter(c => c !== ws);
    if (rooms[ws.roomId].length === 0) delete rooms[ws.roomId];
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
