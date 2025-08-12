const express = require("express");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "homepage.html"));
});

let waiting = null;

io.on("connection", (socket) => {
  console.log("socket connected:", socket.id);

  socket.on("join", (info) => {
    socket.data.info = info || {};
    socket.data.room = null;

    if (waiting && waiting.connected) {
      const partner = waiting;
      waiting = null;

      const room = `room_${partner.id}_${socket.id}`;
      socket.join(room);
      partner.join(room);

      socket.data.room = room;
      partner.data.room = room;

      const partnerGenderForSocket = partner.data.info?.gender || "unknown";
      const partnerGenderForPartner = socket.data.info?.gender || "unknown";

      socket.emit("matched", { partnerGender: partnerGenderForSocket });
      partner.emit("matched", { partnerGender: partnerGenderForPartner });

      io.to(room).emit("system", "You are now connected to a stranger. Say hi!");
    } else {
      waiting = socket;
      socket.emit("system", "Waiting for a stranger to connect...");
    }
  });

  socket.on("chat message", (msg) => {
    const room = socket.data.room;
    if (room) {
      socket.to(room).emit("chat message", msg);
    } else {
      socket.emit("system", "Still searching for a partner...");
    }
  });

  socket.on("next", () => {
    const room = socket.data.room;
    if (room) {
      socket.to(room).emit("system", "Partner left the chat. Searching for new partner...");
      const clients = Array.from(io.sockets.adapter.rooms.get(room) || []);
      clients.forEach((id) => {
        const s = io.sockets.sockets.get(id);
        if (s) {
          s.leave(room);
          s.data.room = null;
        }
      });
      const partnerId = clients.find((id) => id !== socket.id);
      if (partnerId) {
        const partnerSocket = io.sockets.sockets.get(partnerId);
        if (partnerSocket && (!waiting || !waiting.connected)) {
          waiting = partnerSocket;
        }
      }
    }

    if (!waiting || !waiting.connected) {
      waiting = socket;
      socket.data.room = null;
      socket.emit("system", "Searching for a new partner...");
    }
  });

  socket.on("leave", () => {
    const room = socket.data.room;
    if (room) {
      socket.to(room).emit("system", "Partner left the chat.");
      const clients = Array.from(io.sockets.adapter.rooms.get(room) || []);
      clients.forEach((id) => {
        const s = io.sockets.sockets.get(id);
        if (s) {
          s.leave(room);
          s.data.room = null;
        }
      });
    }
    socket.disconnect();
  });

  socket.on("disconnect", () => {
    console.log("socket disconnected:", socket.id);
    if (waiting && waiting.id === socket.id) waiting = null;

    const room = socket.data.room;
    if (room) {
      socket.to(room).emit("system", "Partner disconnected. Searching for new partner...");
      const clients = Array.from(io.sockets.adapter.rooms.get(room) || []);
      clients.forEach((id) => {
        const s = io.sockets.sockets.get(id);
        if (s) {
          s.leave(room);
          s.data.room = null;
          if (!waiting || !waiting.connected) waiting = s;
        }
      });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server ready on http://localhost:${PORT}`));
