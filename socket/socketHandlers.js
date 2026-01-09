// ИЗМЕНЕНО: Добавляем обработку логов, которые прилетают с мобильного приложения
export const registerSocketHandlers = (io, originalConsole) => {
  io.on("connection", (socket) => {
    originalConsole.log(`🔌 [SOCKET] New connection: ${socket.id}`);

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

    // --- НОВАЯ ЛОГИКА ДЛЯ ДЕБАГА МОБИЛКИ ---

    // ДОБАВЛЕНО: Обработка консольных логов с мобилки
    socket.on("app_log", (data) => {
      const { level, message, content, time } = data;
      // Выводим в консоль сервера так, чтобы это было заметно
      originalConsole[level](
        `📱 [MOBILE-LOG] [${time}] ${message || ""}`,
        content || ""
      );

      // ИЗМЕНЕНО: Пересылаем эти логи в комнату админов, если открыта панель управления
      io.to("admins").emit("backend_log", {
        level,
        message: `📱 Mobile: ${message}`,
        context: content,
        time,
      });
    });

    // ДОБАВЛЕНО: Обработка сетевых запросов (Network Logger)
    socket.on("app_network", (data) => {
      const { method, url, status, time } = data;
      originalConsole.log(
        `🌐 [MOBILE-NET] [${time}] ${method} ${url} | Status: ${status}`
      );

      // Пересылаем админам
      io.to("admins").emit("backend_log", {
        level: "log",
        message: `🌐 Net: ${method} ${url} [${status}]`,
        context: data,
        time,
      });
    });

    // --- КОНЕЦ ЛОГИКИ ДЕБАГА ---

    socket.on("join_admin", () => {
      socket.join("admins");
      originalConsole.log(`🛡️ [SOCKET] ${socket.id} joined ADMIN channel`);
    });

    socket.on("join_driver", (id) => {
      if (!id) return;
      const did = String(id);
      socket.join("drivers");
      socket.join(`driver:${did}`);
    });

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
