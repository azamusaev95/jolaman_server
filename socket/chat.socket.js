// /socket/chat.socket.js
const CHAT_NAMESPACE = "/chat";

export function registerChatSockets(io, originalConsole) {
  const nsp = io.of(CHAT_NAMESPACE);

  nsp.on("connection", (socket) => {
    originalConsole.log(`💬 [CHAT] Connected: ${socket.id}`);

    const q = socket.handshake?.query || {};
    const driverId = q.driverId ? String(q.driverId) : null;
    const clientId = q.clientId ? String(q.clientId) : null;
    const isAdmin = q.isAdmin === "true"; // ДОБАВЛЕНО: флаг для админа

    // ИЗМЕНЕНО: Добавлена комната для админов
    if (isAdmin) {
      socket.join("admins");
      originalConsole.log(`🛡️ [CHAT] ${socket.id} joined admins room`);
    }

    if (driverId) {
      socket.join("drivers");
      socket.join(`driver:${driverId}`);
      originalConsole.log(`搬 [CHAT] ${socket.id} joined driver:${driverId}`);
    }

    if (clientId) {
      socket.join("clients");
      socket.join(`client:${clientId}`);
      originalConsole.log(`👤 [CHAT] ${socket.id} joined client:${clientId}`);
    }

    socket.on("join_chat", (chatId) => {
      if (!chatId) return;
      socket.join(String(chatId));
      originalConsole.log(`📂 [CHAT] ${socket.id} joined room ${chatId}`);
    });

    socket.on("disconnect", (reason) => {
      originalConsole.log(`❌ [CHAT] Disconnected ${socket.id} | ${reason}`);
    });
  });
}
