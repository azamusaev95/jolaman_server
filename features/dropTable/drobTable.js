import sequelize from "../../config/db.js";

const ALLOWED_TABLES = ["car_brands", "car_models"];

export async function dropTableByName(req, res) {
  try {
    // 🔐 защита
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({
        ok: false,
        message: "Drop table is disabled in production",
      });
    }

    const { table } = req.params;

    if (!table) {
      return res.status(400).json({
        ok: false,
        message: "Table name is required",
      });
    }

    if (!ALLOWED_TABLES.includes(table)) {
      return res.status(400).json({
        ok: false,
        message: `Table "${table}" is not allowed`,
      });
    }

    // 💥 КЛЮЧЕВОЕ МЕСТО
    await sequelize.query(`DROP TABLE IF EXISTS "${table}" CASCADE;`);

    return res.json({
      ok: true,
      dropped: table,
    });
  } catch (error) {
    console.error("dropTable error:", error);

    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
}
