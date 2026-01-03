import fs from "fs";
import path from "path";

const CURRENT_DIR = process.cwd();
const OUTPUT_FILE = path.join(CURRENT_DIR, "project-matrix.html");

// =========================================================================
// 📂 СПИСОК ВСЕХ МОДУЛЕЙ
// =========================================================================
const MODULES = [
  {
    id: "user",
    name: "👤 Users & Auth",
    model: path.join(CURRENT_DIR, "features/user/user.model.js"),
    controller: path.join(CURRENT_DIR, "features/user/user.controllers.js"),
  },
  {
    id: "driver",
    name: "🚖 Drivers",
    model: path.join(CURRENT_DIR, "features/driver/driver.model.js"),
    controller: path.join(CURRENT_DIR, "features/driver/driver.controllers.js"),
  },
  {
    id: "client",
    name: "🙋‍♂️ Clients",
    model: path.join(CURRENT_DIR, "features/client/client.model.js"),
    controller: path.join(CURRENT_DIR, "features/client/client.controller.js"),
  },
  {
    id: "tariff",
    name: "💲 Tariffs",
    model: path.join(CURRENT_DIR, "features/tariff/tariff.model.js"),
    controller: path.join(CURRENT_DIR, "features/tariff/tariff.controller.js"),
  },
  {
    id: "order",
    name: "📦 Orders",
    model: path.join(CURRENT_DIR, "features/order/order.model.js"),
    controller: path.join(CURRENT_DIR, "features/order/order.controller.js"),
  },
  {
    id: "orderRoute",
    name: "📍 Order Routes",
    model: path.join(
      CURRENT_DIR,
      "features/orderRoutePoint/orderRoutePoint.model.js"
    ),
    controller: path.join(
      CURRENT_DIR,
      "features/orderRoutePoint/orderRoutePoint.controller.js"
    ),
  },
  {
    id: "transaction",
    name: "💰 Transactions",
    model: path.join(
      CURRENT_DIR,
      "features/driverTransaction/transaction.model.js"
    ),
    controller: path.join(
      CURRENT_DIR,
      "features/driverTransaction/transaction.controller.js"
    ),
  },
  {
    id: "vehicle",
    name: "🚗 Vehicles",
    model: path.join(CURRENT_DIR, "features/vehicle/vehicle.model.js"),
    controller: path.join(
      CURRENT_DIR,
      "features/vehicle/vehicle.controllers.js"
    ),
  },
  {
    id: "vehiclePhoto",
    name: "📸 Vehicle Photos",
    model: path.join(CURRENT_DIR, "features/vehicle/vehicle-photo.model.js"),
    controller: path.join(
      CURRENT_DIR,
      "features/vehicle/vehicle-photo.controller.js"
    ),
  },
  {
    id: "chat",
    name: "💬 Chats",
    model: path.join(CURRENT_DIR, "features/chat/chat.model.js"),
    controller: path.join(CURRENT_DIR, "features/chat/chat.controller.js"),
  },
  {
    id: "chatMsg",
    name: "📩 Chat Messages",
    model: path.join(CURRENT_DIR, "features/chatMessage/chatMessage.model.js"),
    controller: path.join(
      CURRENT_DIR,
      "features/chatMessage/chatMessage.controller.js"
    ),
  },
  {
    id: "review",
    name: "⭐ Reviews",
    model: path.join(CURRENT_DIR, "features/review/review.model.js"),
    controller: path.join(CURRENT_DIR, "features/review/review.controller.js"),
  },
  {
    id: "carBrand",
    name: "🏷️ Car Brands",
    model: path.join(CURRENT_DIR, "features/carBrands/carBrands.model.js"),
    controller: path.join(
      CURRENT_DIR,
      "features/carBrands/carBrands.controllers.js"
    ),
  },
];

// 👇 ВОТ ЭТА ФУНКЦИЯ БЫЛА ПРОПУЩЕНА
// Хелпер: Умный поиск файла (если ошиблись в controller vs controllers)
function resolvePath(definedPath) {
  // 1. Если путь точный и файл есть — возвращаем его
  if (fs.existsSync(definedPath)) return definedPath;

  // 2. Если файл не найден, пробуем варианты окончаний
  if (definedPath.endsWith(".controllers.js")) {
    const singular = definedPath.replace(".controllers.js", ".controller.js");
    if (fs.existsSync(singular)) return singular;
  }
  if (definedPath.endsWith(".controller.js")) {
    const plural = definedPath.replace(".controller.js", ".controllers.js");
    if (fs.existsSync(plural)) return plural;
  }

  // 3. Ничего не нашли
  return null;
}

// Хелпер чтения файла
function parseFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf8");
}

function generateMatrix() {
  console.log("🎨 Генерирую Интерактивный Дэшборд...");

  let menuHTML = "";
  let contentHTML = "";
  let totalModules = 0;

  MODULES.forEach((module, index) => {
    const isFirst = index === 0;

    // --- 1. ПРОВЕРКА И ЗАГРУЗКА ---
    // Используем resolvePath, чтобы найти файл даже если есть опечатка (s)
    const modelPath = resolvePath(module.model);
    const ctrlPath = resolvePath(module.controller);

    if (!modelPath) {
      console.warn(
        `⚠️  [${module.name}] Модель не найдена по пути: ${module.model}`
      );
      return;
    }
    if (!ctrlPath) {
      console.warn(
        `⚠️  [${module.name}] Контроллер не найден по пути: ${module.controller}`
      );
      return;
    }

    const modelContent = parseFile(modelPath);
    const ctrlContent = parseFile(ctrlPath);

    totalModules++;

    // --- 2. ПАРСИНГ ---

    // Поля модели
    const fieldRegex = /@field\s+(\w+)\s+{(.+?)}\s+-\s+(.+)/g;
    let modelFields = [];
    let m;
    while ((m = fieldRegex.exec(modelContent)) !== null) {
      modelFields.push({ name: m[1], type: m[2], desc: m[3] });
    }

    // Методы контроллера
    const actionRegex =
      /\/\/\s*@map:\s*([^\s(]+)(?:\s*\((.+?)\))?\s*->\s*(.+?)\s*\[(.+?)\]/g;
    let actions = [];
    while ((m = actionRegex.exec(ctrlContent)) !== null) {
      actions.push({
        enName: m[1].trim(),
        ruName: m[2] ? m[2].trim() : m[1].trim(),
        fields: m[3].split(",").map((s) => s.trim()),
        roles: m[4].trim(),
      });
    }

    // --- 3. ГЕНЕРАЦИЯ HTML ---

    // Меню
    menuHTML += `
      <div class="menu-item ${isFirst ? "active" : ""}" onclick="openTab('${
      module.id
    }', this)">
        ${module.name}
      </div>
    `;

    // Заголовки (Поля)
    const headerCols = modelFields
      .map(
        (f) => `
      <th class="rotate">
        <div><span>${f.name}</span></div>
        <div class="th-desc">${f.desc}</div>
      </th>
    `
      )
      .join("");

    // Строки (Действия)
    const bodyRows = actions
      .map((action) => {
        const cells = modelFields
          .map((field) => {
            const isTouched = action.fields.includes(field.name);
            return isTouched
              ? `<td class="active"><div class="dot"></div></td>`
              : `<td class="inactive"></td>`;
          })
          .join("");

        return `
        <tr>
          <td class="controller-name">
            <div class="en-name">${action.enName}</div>
            <div class="ru-name">${action.ruName}</div>
          </td>
          <td class="role-badge">${action.roles.replace(/, /g, "<br/>")}</td>
          ${cells}
        </tr>`;
      })
      .join("");

    // Контент вкладки
    contentHTML += `
      <div id="${module.id}" class="tab-content ${isFirst ? "active" : ""}">
        <div class="module-header">
            <h2>${module.name}</h2>
            <span class="path">${path.relative(CURRENT_DIR, ctrlPath)}</span>
        </div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th style="text-align: left; min-width: 200px; padding-left: 16px;">🎮 Action</th>
                <th style="min-width: 140px;">🔒 Roles</th>
                ${headerCols}
              </tr>
            </thead>
            <tbody>
                ${
                  actions.length > 0
                    ? bodyRows
                    : '<tr><td colspan="100" style="text-align:center; padding: 20px; color: #6b7280;">Нет действий с меткой @map</td></tr>'
                }
            </tbody>
          </table>
        </div>
      </div>
    `;
  });

  // --- 4. ФИНАЛЬНЫЙ ШАБЛОН ---
  const html = `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Architecture Dashboard</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-dark: #030712;
            --bg-panel: #111827;
            --border: #374151;
            --text-main: #f3f4f6;
            --text-muted: #9ca3af;
            --accent: #10b981;
            --accent-hover: #059669;
            --active-bg: rgba(16, 185, 129, 0.1);
        }
        body {
            background-color: var(--bg-dark);
            color: var(--text-main);
            font-family: "Inter", sans-serif;
            margin: 0;
            display: flex;
            height: 100vh;
            overflow: hidden;
        }

        .sidebar {
            width: 260px;
            background: var(--bg-panel);
            border-right: 1px solid var(--border);
            display: flex;
            flex-direction: column;
            padding: 20px 0;
            overflow-y: auto;
            flex-shrink: 0;
        }
        .sidebar-title {
            padding: 0 24px 20px;
            font-size: 18px;
            font-weight: 700;
            color: var(--accent);
            border-bottom: 1px solid var(--border);
            margin-bottom: 10px;
        }
        .menu-item {
            padding: 12px 24px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            color: var(--text-muted);
            transition: all 0.2s;
            border-left: 3px solid transparent;
        }
        .menu-item:hover {
            background: rgba(255,255,255,0.03);
            color: #fff;
        }
        .menu-item.active {
            background: var(--active-bg);
            color: var(--accent);
            border-left: 3px solid var(--accent);
        }

        .main {
            flex: 1;
            padding: 30px;
            overflow-y: auto;
            position: relative;
        }
        
        .tab-content { display: none; animation: fadeIn 0.3s ease; }
        .tab-content.active { display: block; }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(5px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .module-header {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            margin-bottom: 20px;
            border-bottom: 1px solid var(--border);
            padding-bottom: 15px;
        }
        .module-header h2 { margin: 0; color: #fff; font-size: 24px; }
        .module-header .path { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--text-muted); }

        .table-container {
            background: var(--bg-panel);
            border: 1px solid var(--border);
            border-radius: 12px;
            overflow-x: auto;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.5);
        }
        table { border-collapse: collapse; width: 100%; min-width: 800px; }
        
        th {
            padding: 12px;
            color: var(--text-muted);
            font-size: 12px;
            font-weight: 600;
            border-bottom: 2px solid var(--border);
            vertical-align: bottom;
            background: #1f2937;
            position: sticky;
            top: 0;
            z-index: 10;
        }
        
        th.rotate { height: 140px; white-space: nowrap; position: relative; }
        th.rotate > div:first-child {
            transform: translate(5px, -10px) rotate(-45deg);
            width: 30px;
            transform-origin: bottom left;
        }
        th.rotate > div:first-child > span {
            padding: 5px;
            color: var(--accent);
            font-family: 'JetBrains Mono', monospace;
            font-size: 13px;
        }
        .th-desc {
            position: absolute;
            bottom: 5px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 9px;
            color: #6b7280;
            font-weight: 400;
            opacity: 0; 
        }

        td { padding: 12px; border-bottom: 1px solid rgba(55, 65, 81, 0.5); font-size: 13px; }
        tr:last-child td { border-bottom: none; }
        tr:hover td { background-color: rgba(255, 255, 255, 0.02); }

        .controller-name { padding-left: 16px; border-right: 1px solid var(--border); }
        .en-name { font-weight: 700; color: #fff; font-family: 'JetBrains Mono', monospace; font-size: 13px; }
        .ru-name { color: var(--text-muted); font-size: 12px; margin-top: 4px; }
        
        .role-badge { color: var(--text-muted); font-size: 11px; font-family: 'JetBrains Mono', monospace; line-height: 1.4; border-right: 1px solid var(--border); }

        .active { text-align: center; background: rgba(16, 185, 129, 0.05); }
        .inactive { text-align: center; }
        .dot { 
            height: 8px; width: 8px; 
            background-color: var(--accent); 
            border-radius: 50%; 
            display: inline-block; 
            box-shadow: 0 0 8px rgba(16, 185, 129, 0.8); 
        }
    </style>
</head>
<body>

    <div class="sidebar">
        <div class="sidebar-title">Nurai Solutions</div>
        ${menuHTML}
    </div>

    <div class="main">
        ${contentHTML}
    </div>

    <script>
        function openTab(tabId, element) {
            document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));

            document.getElementById(tabId).classList.add('active');
            element.classList.add('active');
        }
    </script>
</body>
</html>`;

  fs.writeFileSync(OUTPUT_FILE, html);
  console.log(`✅ Дэшборд готов! Обработано модулей: ${totalModules}`);
  console.log(`👉 Открывай: ${OUTPUT_FILE}`);
}

generateMatrix();
