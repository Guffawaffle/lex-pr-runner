/**
 * Planner module - Dependency parsing and plan generation
 */

export {
	parsePRDescription,
	validateDependencies,
	isValidDependencyRef,
	normalizeDependencyRef,
	type ParsedDependency,
	type ParserOptions
} from "./dependencyParser.js";
