from __future__ import annotations

from pathlib import Path
from typing import Any


def _schema_path() -> Path:
	# Repo layout: package at lex_pr/, schema at schemas/
	return Path(__file__).resolve().parents[1] / "schemas" / "plan.schema.json"


def validate_plan(data: dict[str, Any], use_jsonschema: bool = True) -> tuple[bool, str | None]:
	"""Validate a plan dict against v1 schema.
	Returns (ok, error_message). If ok is False, error_message is a concise, actionable string.
	If `use_jsonschema` and `jsonschema` is available, use it; otherwise fall back to a minimal validator.
	"""
	if use_jsonschema:
		try:
			import json

			from jsonschema import Draft202012Validator  # type: ignore
			schema = json.loads(_schema_path().read_text(encoding="utf-8"))
			validator = Draft202012Validator(schema)
			errors = sorted(validator.iter_errors(data), key=lambda e: e.path)
			if errors:
				first = errors[0]
				loc = "/".join([str(p) for p in first.path])
				msg = f"{loc or '<root>'}: {first.message}"
				return False, msg
			return True, None
		except Exception:  # pragma: no cover
			# Fall back to minimal checks
			pass
	return _fallback_validate(data)


def _fallback_validate(data: dict[str, Any]) -> tuple[bool, str | None]:
	if not isinstance(data, dict):
		return False, "<root>: expected object"
	if "target" not in data or not isinstance(data["target"], str) or not data["target"].strip():
		return False, "target: required non-empty string"
	if "items" not in data or not isinstance(data["items"], list):
		return False, "items: required array"

	item_names: list[str] = []
	for idx, it in enumerate(data["items"]):
		if not isinstance(it, dict):
			return False, f"items/{idx}: expected object"
		for req in ("repo", "branch"):
			if req not in it or not isinstance(it[req], str) or not it[req].strip():
				return False, f"items/{idx}/{req}: required non-empty string"
		if "name" in it and not isinstance(it["name"], str):
			return False, f"items/{idx}/name: expected string"
		if "deps" in it:
			if not isinstance(it["deps"], list) or not all(isinstance(d, str) and d.strip() for d in it["deps"]):
				return False, f"items/{idx}/deps: expected array of strings"
		if "gates" in it:
			if not isinstance(it["gates"], list):
				return False, f"items/{idx}/gates: expected array"
			for gidx, g in enumerate(it["gates"]):
				if not isinstance(g, dict):
					return False, f"items/{idx}/gates/{gidx}: expected object"
				for req in ("name", "run"):
					if req not in g or not isinstance(g[req], str) or not g[req].strip():
						return False, f"items/{idx}/gates/{gidx}/{req}: required non-empty string"
				if "cwd" in g and not isinstance(g["cwd"], str):
					return False, f"items/{idx}/gates/{gidx}/cwd: expected string"
				if "env" in g:
					if not isinstance(g["env"], dict) or not all(isinstance(k, str) and isinstance(v, str) for k, v in g["env"].items()):
						return False, f"items/{idx}/gates/{gidx}/env: expected object of string->string"
		name = it.get("name") or f"{it['repo']}@{it['branch']}"
		item_names.append(name)
	# Unique-ish names check
	if len(set(item_names)) != len(item_names):
		return False, "items: duplicate item names (explicit or derived)"
	return True, None