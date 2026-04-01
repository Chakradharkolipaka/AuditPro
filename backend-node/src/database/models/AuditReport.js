import mongoose from "mongoose";

const VulnerabilitySchema = new mongoose.Schema(
  {
    type: String,
    severity: String,
    line: Number,
    description: String,
    recommendation: String,
    source: String,
  },
  { _id: false }
);

const GasIssueSchema = new mongoose.Schema(
  {
    line: Number,
    problem: String,
    improvement: String,
    estimatedGasSaving: String,
  },
  { _id: false }
);

const AuditReportSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    contractHash: { type: String, required: true, index: true },
    contractName: { type: String, required: true },
    language: { type: String, required: true, index: true },
    protocol: { type: String, default: "unknown", index: true },
    sourceCode: { type: String, required: true },

    vulnerabilities: { type: [VulnerabilitySchema], default: [] },
    gasIssues: { type: [GasIssueSchema], default: [] },
    defiPatterns: { type: Array, default: [] },
    openzeppelinChecks: { type: Object, default: null },
    aiRecommendations: { type: Array, default: [] },
    securityScore: { type: Number, default: null },

    schemaVersion: { type: String, default: "v1.0" },
    pipelineVersion: { type: String, default: "pipeline-v1" },
    modelVersion: { type: String, default: "unknown-model" },
    analyzerVersions: {
      slither: { type: String, default: "unknown" },
      customRules: { type: String, default: "v1" },
    },
    gasEstimate: {
      deployment: { type: Number, default: null },
      methodCalls: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
      source: { type: String, default: "unavailable" },
    },

    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

AuditReportSchema.index({ contractHash: 1, createdAt: -1 });
AuditReportSchema.index({ userId: 1, createdAt: -1 });

export const AuditReport = mongoose.models.AuditReport || mongoose.model("AuditReport", AuditReportSchema);
