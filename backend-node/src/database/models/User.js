import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    uid: { type: String, required: true, unique: true, index: true },
    email: { type: String, default: null, index: true },
    name: { type: String, default: null },
    picture: { type: String, default: null },
    walletAddress: { type: String, default: null, index: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

export const User = mongoose.models.User || mongoose.model("User", UserSchema);
