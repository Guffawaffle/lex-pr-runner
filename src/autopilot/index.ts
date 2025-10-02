/**
 * Autopilot module - automation level management for merge-weave execution
 */

// Foundation exports (Agent 1)
export * from "./types.js";

// Artifact and level exports (Agent 3)
export { AutopilotBase, AutopilotLevel0 } from "./base.js";
export { AutopilotLevel1 } from "./level1.js";
export { ArtifactWriter } from "./artifacts.js";
export type {
        AutopilotContext,
        AutopilotResult
} from "./base.js";
export type {
        AnalysisData,
        GatePrediction,
        ConflictPrediction,
        ArtifactMetadata
} from "./artifacts.js";