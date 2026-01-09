// /socket/chat.socket.js
// namespace: /chat  → ТОЛЬКО чат

const CHAT_NAMESPACE = "/chat";

export function registerChatSockets(io, originalConsole) {
  const nsp = io.of(CHAT_NAMESPACE);

  nsp.on("connection", (socket) => {
    originalConsole.log(`💬 [CHAT] Connected: ${socket.id}`);

    const q = socket.handshake?.query || {};
    const driverId = q.driverId ? String(q.driverId) : null;
    const clientId = q.clientId ? String(q.clientId) : null;

    // авто-join по ролям (если ты это используешь)
    if (driverId) {
      socket.join("drivers");
      socket.join(`driver:${driverId}`);
      originalConsole.log(
        `🚕 [CHAT] ${socket.id} joined drivers, driver:${driverId}`
      );
    }

    if (clientId) {
      socket.join("clients");
      socket.join(`client:${clientId}`);
      originalConsole.log(
        `👤 [CHAT] ${socket.id} joined clients, client:${clientId}`
      );
    }

    // комнаты чата
    socket.on("join_chat", (chatId) => {
      if (!chatId) return;
      const room = String(chatId);
      socket.join(room);
      originalConsole.log(`📂 [CHAT] ${socket.id} joined room ${room}`);
    });

    socket.on("join_driver", (id) => {
      if (!id) return;
      const did = String(id);
      socket.join("drivers");
      socket.join(`driver:${did}`);
    });

    socket.on("disconnect", (reason) => {
      originalConsole.log(`❌ [CHAT] Disconnected ${socket.id} | ${reason}`);
    });

    socket.on("error", (err) => {
      originalConsole.error("❌ [CHAT] Socket error:", err);
    });
  });
}
