import { createServer } from "http";
import next from "next";
import { Server as SocketIOServer } from "socket.io";

import { setSocketServer } from "./lib/socket/server";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  const io = new SocketIOServer(httpServer, {
    path: "/api/socket/io",
    addTrailingSlash: false,
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  // Store singleton reference for service emissions
  setSocketServer(io);

  io.on("connection", (socket) => {
    const userId = socket.handshake.auth?.userId || socket.handshake.query?.userId;

    if (userId && typeof userId === "string") {
      socket.join(`user:${userId}`);
    }

    socket.on("join-user-room", (id: string) => {
      if (id && typeof id === "string") {
        socket.join(`user:${id}`);
      }
    });

    socket.on("leave-user-room", (id: string) => {
      if (id && typeof id === "string") {
        socket.leave(`user:${id}`);
      }
    });
  });

  httpServer.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
