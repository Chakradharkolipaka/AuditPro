import mongoose from "mongoose";

const ContractSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    contractHash: { type: String, required: true, index: true },
    contractName: { type: String, required: true },
    language: { type: String, required: true, index: true },
    sourceCode: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

ContractSchema.index({ userId: 1, createdAt: -1 });
ContractSchema.index({ userId: 1, contractHash: 1 }, { unique: true });

export const Contract = mongoose.models.Contract || mongoose.model("Contract", ContractSchema);
