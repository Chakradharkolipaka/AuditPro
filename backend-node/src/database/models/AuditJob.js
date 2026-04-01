import mongoose from "mongoose";

const AuditJobSchema = new mongoose.Schema(
  {
    jobId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    contractHash: { type: String, required: true, index: true },
    contractName: { type: String, required: true },
    language: { type: String, required: true, index: true },
    protocol: { type: String, default: "unknown", index: true },
    status: { type: String, required: true, enum: ["queued", "running", "completed", "failed"], default: "queued" },
    progress: { type: Number, default: 0 },
    error: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

AuditJobSchema.index({ createdAt: -1 });
AuditJobSchema.index({ userId: 1, createdAt: -1 });

export const AuditJob = mongoose.models.AuditJob || mongoose.model("AuditJob", AuditJobSchema);
