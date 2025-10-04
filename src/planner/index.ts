/**
 * Planner module - Dependency parsing, file analysis, and plan generation
 */

// Dependency parsing (PR #110)
export {
        parsePRDescription,
        validateDependencies,
        isValidDependencyRef,
        normalizeDependencyRef,
        type ParsedDependency,
        type ParserOptions
} from "./dependencyParser.js";

// File analysis and intersection detection (PR #111)
export * from "./types.js";
export * from "./fileAnalysis.js";