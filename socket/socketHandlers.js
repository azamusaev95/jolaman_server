// ПЕРЕНЕСЕНО: Вся логика обработки соединений сокетов
export const registerSocketHandlers = (io, originalConsole) => {
  io.on("connection", (socket) => {
    originalConsole.log(`🔌 [SOCKET] New connection: ${socket.id}`);

    // ✅ Авто-джоин по query
    const q = socket.handshake?.query || {};
    const driverId = q.driverId ? String(q.driverId) : null;
    const clientId = q.clientId ? String(q.clientId) : null;

    if (driverId) {
      socket.join("drivers");
      socket.join(`driver:${driverId}`);
      originalConsole.log(
        `🚕 [SOCKET] ${socket.id} auto-joined rooms: drivers, driver:${driverId}`
      );
    }

    if (clientId) {
      socket.join("clients");
      socket.join(`client:${clientId}`);
      originalConsole.log(
        `👤 [SOCKET] ${socket.id} auto-joined rooms: clients, client:${clientId}`
      );
    }

    // Админский канал
    socket.on("join_admin", () => {
      socket.join("admins");
      originalConsole.log(`🛡️ [SOCKET] ${socket.id} joined ADMIN channel`);
    });

    // Явное подключение к ролям
    socket.on("join_driver", (id) => {
      if (!id) return;
      const did = String(id);
      socket.join("drivers");
      socket.join(`driver:${did}`);
      originalConsole.log(
        `🚕 [SOCKET] ${socket.id} joined driver rooms: drivers, driver:${did}`
      );
    });

    socket.on("join_client", (id) => {
      if (!id) return;
      const cid = String(id);
      socket.join("clients");
      socket.join(`client:${cid}`);
      originalConsole.log(
        `👤 [SOCKET] ${socket.id} joined client rooms: clients, client:${cid}`
      );
    });

    // Вход в конкретный чат
    socket.on("join_chat", (chatId) => {
      if (chatId) {
        const roomName = String(chatId);
        socket.join(roomName);
        originalConsole.log(
          `📂 [SOCKET] ${socket.id} joined room: ${roomName}`
        );
      }
    });

    socket.on("disconnect", (reason) => {
      originalConsole.log(
        `❌ [SOCKET] Disconnected: ${socket.id} | reason=${reason}`
      );
    });

    socket.on("error", (err) => {
      originalConsole.error("❌ [SOCKET] Socket error:", err);
    });
  });
};
