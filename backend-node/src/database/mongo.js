import mongoose from "mongoose";

let cached = global.__mongoose;
if (!cached) {
  cached = global.__mongoose = { conn: null, promise: null };
}

export async function connectMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw Object.assign(new Error("MONGODB_URI is not set"), { status: 500 });
  }

  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(uri, {
        dbName: process.env.MONGODB_DB || "auditpro",
        serverSelectionTimeoutMS: 10_000,
      })
      .then((m) => m);
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

export function disconnectMongo() {
  return mongoose.disconnect();
}
