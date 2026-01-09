// /socket/debug.socket.js
// namespace: /debug → network + console (ТОЛЬКО дебаг)

const DEBUG_NAMESPACE = "/debug";

export function registerDebugSockets(io, originalConsole) {
  const nsp = io.of(DEBUG_NAMESPACE);

  nsp.on("connection", (socket) => {
    originalConsole.log(`🐞 [DEBUG] Connected: ${socket.id}`);

    // админка должна вызывать это на /debug сокете
    socket.on("join_admin_debug", (_, cb) => {
      socket.join("admins");
      originalConsole.log(`🛡️ [DEBUG] ${socket.id} joined admins`);
      cb?.({ ok: true });
    });

    // консольные логи с мобилки
    socket.on("app_log", (data = {}, cb) => {
      try {
        const level = ["log", "warn", "error"].includes(data.level)
          ? data.level
          : "log";

        const text = String(data.message || data.title || "");
        const time = data.time || "";
        const content = data.content;

        (originalConsole[level] || originalConsole.log)(
          `📱 [MOBILE-LOG] [${time}] ${text}`,
          content ?? ""
        );

        nsp.to("admins").emit("backend_log", {
          level,
          message: `📱 Mobile: ${text}`,
          context: content,
          time,
        });

        cb?.({ ok: true });
      } catch (e) {
        originalConsole.error("❌ [DEBUG] app_log error:", e);
        cb?.({ ok: false });
      }
    });

    // network логи с мобилки
    socket.on("app_network", (data = {}, cb) => {
      try {
        const { method, url, status, time } = data;

        originalConsole.log(
          `🌐 [MOBILE-NET] [${time}] ${method} ${url} | ${status}`
        );

        nsp.to("admins").emit("backend_log", {
          level: "log",
          message: `🌐 Net: ${method} ${url} [${status}]`,
          context: data,
          time,
        });

        cb?.({ ok: true });
      } catch (e) {
        originalConsole.error("❌ [DEBUG] app_network error:", e);
        cb?.({ ok: false });
      }
    });

    socket.on("disconnect", (reason) => {
      originalConsole.log(`❌ [DEBUG] Disconnected ${socket.id} | ${reason}`);
    });

    socket.on("error", (err) => {
      originalConsole.error("❌ [DEBUG] Socket error:", err);
    });
  });
}
