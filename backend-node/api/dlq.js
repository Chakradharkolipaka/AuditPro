import { createApp, attachErrorHandler } from "./_lib/app.js";
import { connectMongo } from "../src/database/mongo.js";
import { requireAuth } from "../src/middlewares/auth.js";
import { DeadLetterJob } from "../src/database/models/DeadLetterJob.js";

export const config = {
  api: {
    bodyParser: true,
  },
};

const app = createApp();

function isAdmin(req) {
  const allow = String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (!allow.length) return true; // if not configured, allow authenticated users
  return allow.includes(String(req.user?.email || "").toLowerCase());
}

app.get("/api/dlq", requireAuth, async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ code: "FORBIDDEN", message: "Admin access required" });
  }

  await connectMongo();

  const limit = Math.min(Number(req.query?.limit || 50), 200);
  const jobs = await DeadLetterJob.find({}).sort({ failedAt: -1 }).limit(limit).lean();
  return res.json({ status: "ok", jobs });
});

attachErrorHandler(app);

export default app;
