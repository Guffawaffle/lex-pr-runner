import pytest

from lex_pr.toposort import CycleError, levels


def test_levels_simple():
	items = [
		{"name": "A", "repo": "r", "branch": "a"},
		{"name": "B", "repo": "r", "branch": "b", "deps": ["A"]},
		{"name": "C", "repo": "r", "branch": "c"},
	]
	lvls = levels(items)
	assert lvls == [["A", "C"], ["B"]]


def test_cycle():
	items = [
		{"name": "A", "repo": "r", "branch": "a", "deps": ["B"]},
		{"name": "B", "repo": "r", "branch": "b", "deps": ["A"]},
	]
	with pytest.raises(CycleError):
		levels(items)


def test_unknown_dep():
	items = [
		{"name": "B", "repo": "r", "branch": "b", "deps": ["X"]},
	]
	with pytest.raises(KeyError):
		levels(items)
