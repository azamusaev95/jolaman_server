import "dotenv/config";
import sequelize from "../config/db.js";
import Chat from "../features/chat/chat.model.js";
import { Op } from "sequelize";

async function migrateChatTypes() {
  try {
    await sequelize.authenticate();
    console.log("✅ DB connected");

    // 1) broadcast -> broadcast_driver
    const [broadcastCount] = await Chat.update(
      { type: "broadcast_driver" },
      { where: { type: "broadcast" } }
    );
    console.log(`🔁 broadcast -> broadcast_driver: ${broadcastCount}`);

    // 2) system -> system_driver (если есть driverId)
    const [systemDriverCount] = await Chat.update(
      { type: "system_driver" },
      {
        where: {
          type: "system",
          driverId: { [Op.ne]: null },
        },
      }
    );
    console.log(
      `🔁 system -> system_driver (by driverId): ${systemDriverCount}`
    );

    // 3) system -> system_client (если есть clientId)
    const [systemClientCount] = await Chat.update(
      { type: "system_client" },
      {
        where: {
          type: "system",
          clientId: { [Op.ne]: null },
        },
      }
    );
    console.log(
      `🔁 system -> system_client (by clientId): ${systemClientCount}`
    );

    // 4) system без привязки -> system_driver (fallback)
    const [systemFallbackCount] = await Chat.update(
      { type: "system_driver" },
      {
        where: {
          type: "system",
          driverId: null,
          clientId: null,
        },
      }
    );
    console.log(
      `🔁 system -> system_driver (fallback): ${systemFallbackCount}`
    );

    // 5) Обновим updatedAt у broadcast_driver, чтобы всплыл в списке
    const [touchCount] = await Chat.update(
      { updatedAt: new Date() },
      { where: { type: "broadcast_driver" } }
    );
    console.log(`⏱️ updatedAt refreshed for broadcast_driver: ${touchCount}`);

    // Проверка
    const stats = await Chat.findAll({
      attributes: [
        "type",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      group: ["type"],
      raw: true,
    });

    console.log("📊 Chat types after migration:");
    console.table(stats);

    process.exit(0);
  } catch (err) {
    console.error("❌ Migration error:", err);
    process.exit(1);
  }
}

migrateChatTypes();
