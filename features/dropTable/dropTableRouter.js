// features/admin/admin.routes.js
import { Router } from "express";
import { dropTableByName } from "./drobTable.js";

const router = Router();

// ❗️ОЧЕНЬ ОПАСНЫЙ РОУТ — ТОЛЬКО ДЛЯ DEV
router.delete("/drop-table/:table", dropTableByName);

export default router;
