from __future__ import annotations

from collections import defaultdict, deque


class CycleError(ValueError):
	pass


def _name_of(item: dict) -> str:
	return item.get("name") or f"{item['repo']}@{item['branch']}"


def levels(items: list[dict]) -> list[list[str]]:
	"""Return deterministic topo levels of item names.
	Raises CycleError if a cycle exists.
	Raises KeyError if a dep references a missing item.
	"""
	names = [_name_of(i) for i in items]
	name_set = set(names)
	# Build graph
	in_deg: dict[str, int] = {n: 0 for n in names}
	children: dict[str, list[str]] = defaultdict(list)
	for it in items:
		me = _name_of(it)
		for d in it.get("deps", []) or []:
			if d not in name_set:
				raise KeyError(f"unknown dep '{d}' for item '{me}'")
			children[d].append(me)
			in_deg[me] += 1
	# Kahn's algorithm with deterministic ordering
	q = deque(sorted([n for n, deg in in_deg.items() if deg == 0]))
	result: list[list[str]] = []
	while q:
		this_level = sorted(list(q))
		q.clear()
		result.append(this_level)
		for n in this_level:
			for c in sorted(children.get(n, [])):
				in_deg[c] -= 1
				if in_deg[c] == 0:
					q.append(c)
	# If any node still has in-degree, cycle exists
	if any(deg > 0 for deg in in_deg.values()):
		raise CycleError("dependency cycle detected")
	return result
