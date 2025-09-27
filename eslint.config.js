import typescriptEslint from "@typescript-eslint/eslint-plugin";
import parser from "@typescript-eslint/parser";

export default [
	{
		ignores: ["dist/**", "node_modules/**", ".git/**"]
	},
	{
		files: ["**/*.ts"],
		languageOptions: {
			parser: parser,
			parserOptions: {
				ecmaVersion: 2022,
				sourceType: "module"
			}
		},
		plugins: {
			"@typescript-eslint": typescriptEslint
		},
		rules: {
			"no-unused-vars": "off",
			"@typescript-eslint/no-unused-vars": "error",
			"no-console": "off"
		}
	},
	{
		files: ["**/*.js"],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: "module"
		},
		rules: {
			"no-unused-vars": "error",
			"no-console": "off"
		}
	}
];