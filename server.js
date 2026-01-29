const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(server, {
    cors: {
      origin: "*",
    },
  });

  let isLive = false;
  let connectedUsers = 0;
  let adminSocketId = null;
  let currentShowTitle = "RTO";
  let schedule = [
    { time: "08:00", title: "Matines & Prières du Matin", host: "Père Seraphim" },
  ];

  io.on("connection", (socket) => {
    connectedUsers++;
    console.log("Client connected:", socket.id, "Total:", connectedUsers);
    
    // Envoyer toutes les infos initiales
    io.emit("user-count", connectedUsers);
    socket.emit("live-status", isLive);
    socket.emit("current-show", currentShowTitle);
    socket.emit("update-schedule", schedule);

    // Broadcast audio data from admin to all listeners
    socket.on("audio-data", (data) => {
      if (!isLive) {
        isLive = true;
        adminSocketId = socket.id;
        io.emit("live-status", true);
      }
      socket.broadcast.emit("audio-stream", data);
    });

    socket.on("start-stream", (title) => {
      isLive = true;
      adminSocketId = socket.id;
      currentShowTitle = title || "RTO";
      io.emit("live-status", true);
      io.emit("current-show", currentShowTitle);
    });

    socket.on("stop-stream", () => {
      isLive = false;
      adminSocketId = null;
      currentShowTitle = "RTO";
      io.emit("live-status", false);
      io.emit("current-show", currentShowTitle);
    });

    socket.on("update-schedule", (newSchedule) => {
      schedule = newSchedule;
      io.emit("update-schedule", schedule);
    });

    socket.on("send-chat-message", (msg) => {
      socket.broadcast.emit("chat-message", msg);
    });

    socket.on("disconnect", () => {
      connectedUsers--;
      io.emit("user-count", connectedUsers);
      
      if (socket.id === adminSocketId) {
        isLive = false;
        adminSocketId = null;
        currentShowTitle = "RTO";
        io.emit("live-status", false);
        io.emit("current-show", currentShowTitle);
      }
    });
  });

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${PORT}`);
  });
});
