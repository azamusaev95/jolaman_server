// ПЕРЕНЕСЕНО: Логика перехвата консоли вынесена из основного файла для чистоты
export const setupLogger = (io) => {
  const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
  };

  ["log", "warn", "error"].forEach((method) => {
    console[method] = (...args) => {
      // ИЗМЕНЕНО: Используем оригинальный консоль для вывода в терминал
      originalConsole[method].apply(console, args);
      try {
        if (io) {
          const content = args.length > 1 ? args : args[0];
          io.emit("backend_log", {
            level: method,
            message: typeof content === "string" ? content : "Object Log",
            context: content,
            time: new Date().toLocaleTimeString(),
          });
        }
      } catch (e) {
        // Ошибка в логгере не должна вешать сервер
      }
    };
  });

  return originalConsole;
};
