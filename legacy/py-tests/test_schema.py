from lex_pr.plan_schema import validate_plan


def test_valid_plan_minimal_fallback():
	plan = {
		"target": "main",
		"items": [
			{"repo": "org/repo", "branch": "feat/a", "name": "A"},
			{"repo": "org/repo", "branch": "feat/b", "name": "B", "deps": ["A"]},
		]
	}
	ok, err = validate_plan(plan, use_jsonschema=False)
	assert ok and err is None


def test_invalid_missing_branch():
	plan = {
		"target": "main",
		"items": [
			{"repo": "org/repo", "name": "A"},
		]
	}
	ok, err = validate_plan(plan, use_jsonschema=False)
	assert not ok and "branch" in err


def test_invalid_env_type():
	plan = {
		"target": "main",
		"items": [
			{
				"repo": "org/repo",
				"branch": "feat/a",
				"name": "A",
				"gates": [
					{"name": "T", "run": "echo hi", "env": {"A": 1}}
				]
			}
		]
	}
	ok, err = validate_plan(plan, use_jsonschema=False)
	assert not ok and "env" in err
