import { createApp, attachErrorHandler } from "./_lib/app.js";
import { connectMongo } from "../src/database/mongo.js";
import { requireAuth } from "../src/middlewares/auth.js";
import { User } from "../src/database/models/User.js";

export const config = {
  api: {
    bodyParser: true,
  },
};

const app = createApp();

app.get("/api/auth/me", requireAuth, async (req, res) => {
  await connectMongo();

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

  const user = await User.findOne({ uid: req.user.uid }).lean();
  return res.json({ user });
});

app.post("/api/auth/wallet", requireAuth, async (req, res) => {
  await connectMongo();

  const walletAddress = String(req.body?.walletAddress || "").trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    return res.status(400).json({ error: "Invalid wallet address" });
  }

  await User.updateOne(
    { uid: req.user.uid },
    {
      $set: { walletAddress, updatedAt: new Date() },
      $setOnInsert: { createdAt: new Date(), uid: req.user.uid },
    },
    { upsert: true }
  );

  const user = await User.findOne({ uid: req.user.uid }).lean();
  return res.json({ user });
});

attachErrorHandler(app);

export default app;
