import mongoose from "mongoose";

const DeadLetterJobSchema = new mongoose.Schema(
  {
    originalJobId: { type: String, required: true, index: true },
    userId: { type: String, default: null, index: true },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    error: { type: String, default: "Unknown error" },
    attemptsMade: { type: Number, default: 0 },
    failedAt: { type: Date, default: Date.now },
  },
  { versionKey: false, timestamps: true }
);

DeadLetterJobSchema.index({ failedAt: -1 });

export const DeadLetterJob = mongoose.models.DeadLetterJob || mongoose.model("DeadLetterJob", DeadLetterJobSchema);
