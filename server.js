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
  let streamHeader = null;

  io.on("connection", (socket) => {
    connectedUsers++;
    console.log("Client connected:", socket.id, "Total:", connectedUsers);
    
    // Envoyer le nombre d'utilisateurs à tout le monde
    io.emit("user-count", connectedUsers);

    // Envoyer le statut live et le header si existant
    socket.emit("live-status", isLive);
    if (isLive && streamHeader) {
      socket.emit("audio-stream", streamHeader);
    }

    // Broadcast audio data from admin to all listeners
    socket.on("audio-data", (data) => {
      if (!isLive) {
        isLive = true;
        adminSocketId = socket.id;
        streamHeader = data; // Stocker le premier paquet (contient les headers WebM)
        io.emit("live-status", true);
      }
      socket.broadcast.emit("audio-stream", data);
    });

    socket.on("stop-stream", () => {
      isLive = false;
      adminSocketId = null;
      streamHeader = null;
      io.emit("live-status", false);
    });

    socket.on("send-chat-message", (msg) => {
      socket.broadcast.emit("chat-message", msg);
    });

    socket.on("disconnect", () => {
      connectedUsers--;
      console.log("Client disconnected:", socket.id, "Total:", connectedUsers);
      io.emit("user-count", connectedUsers);
      
      // Si l'admin se déconnecte, on arrête le live
      if (socket.id === adminSocketId) {
        isLive = false;
        adminSocketId = null;
        io.emit("live-status", false);
      }
    });
  });

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${PORT}`);
  });
});
