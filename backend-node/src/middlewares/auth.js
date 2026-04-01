import { verifyFirebaseToken } from "../auth/firebaseAdmin.js";

function readBearer(req) {
  const h = req.headers?.authorization || req.headers?.Authorization || "";
  const [scheme, token] = String(h).split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

export async function requireAuth(req, res, next) {
  try {
    const token = readBearer(req);
    if (!token) return res.status(401).json({ error: "Missing bearer token" });

    const decoded = await verifyFirebaseToken(token);
    req.user = {
      uid: decoded.uid,
      email: decoded.email || null,
      name: decoded.name || null,
      picture: decoded.picture || null,
    };

    return next();
  } catch (e) {
    return res.status(401).json({ error: e?.message || "Unauthorized" });
  }
}
