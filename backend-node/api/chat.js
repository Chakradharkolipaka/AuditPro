import { createApp, attachErrorHandler } from "./_lib/app.js";
import { connectMongo } from "../src/database/mongo.js";
import { chat } from "../src/controllers/chatController.js";
import { requireAuth } from "../src/middlewares/auth.js";
import { User } from "../src/database/models/User.js";

export const config = {
  api: {
    bodyParser: true,
  },
};

const app = createApp();

app.post("/api/chat", requireAuth, async (req, res) => {
  await connectMongo().catch(() => null);

  await User.updateOne(
    { uid: req.user.uid },
    {
      $set: {
        uid: req.user.uid,
        email: req.user.email,
        name: req.user.name,
        picture: req.user.picture,
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );

  return chat(req, res, (err) => {
    if (err) {
      res.status(err.status || 500).json({ error: err.message || "Chat failed" });
    }
  });
});

attachErrorHandler(app);

export default app;
