import { Router } from "express";

import { analyzeContract } from "../controllers/auditController.js";
import { chat } from "../controllers/chatController.js";

const router = Router();

router.get("/", (_req, res) => {
  res.json({ message: "AuditPro API" });
});

router.post("/audit/analyze", analyzeContract);
router.post("/chat", chat);

export default router;
