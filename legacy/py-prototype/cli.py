from __future__ import annotations

import json
from pathlib import Path

import typer

from .plan_schema import validate_plan
from .toposort import CycleError, levels

app = typer.Typer(add_completion=False, help="PR Runner & Merge Pyramid CLI")


@app.command("schema")
def schema_cmd(action: str = typer.Argument(..., help="Only 'validate' is supported"),
			  path: Path = typer.Argument(Path("plan.json")),
			  json_out: bool = typer.Option(False, "--json", help="Emit JSON result")) -> int:
	"""Schema-related commands (v1 supports: validate)."""
	if action != "validate":
		msg = "only 'validate' is implemented"
		if json_out:
			print(json.dumps({"ok": False, "error": msg}))
		else:
			print(f"Error: {msg}")
		raise typer.Exit(code=2)
	data = json.loads(path.read_text(encoding="utf-8"))
	ok, err = validate_plan(data)
	if json_out:
		print(json.dumps({"ok": ok, **({"error": err} if not ok else {})}))
	else:
		print("OK" if ok else f"Invalid: {err}")
	raise typer.Exit(code=0 if ok else 1)


@app.command("merge-order")
def merge_order(path: Path = typer.Argument(Path("plan.json")),
				json_out: bool = typer.Option(True, "--json/--no-json", help="Emit JSON levels")) -> int:
	"""Compute deterministic topo order grouped by levels."""
	data = json.loads(path.read_text(encoding="utf-8"))
	ok, err = validate_plan(data)
	if not ok:
		print(f"Invalid plan: {err}")
		raise typer.Exit(code=1)
	try:
		lvls = levels(data["items"])
	except KeyError as e:
		print(f"Invalid deps: {e}")
		raise typer.Exit(code=2)
	except CycleError as e:
		print(str(e))
		raise typer.Exit(code=3)
	if json_out:
		print(json.dumps(lvls))
	else:
		for i, grp in enumerate(lvls):
			print(f"Level {i}: {', '.join(grp)}")
	raise typer.Exit(0)


@app.command("gate")
def gate() -> int:
	"""Gate runner (stub for v1)."""
	print("not implemented (v1)")
	raise typer.Exit(0)


if __name__ == "__main__":
	app()
