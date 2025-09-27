# Plan Snapshot

**Generated:** 2025-09-27T17:22:40.186Z
**Target Branch:** main

## Environment

- **Node Version:** v20.19.5
- **Platform:** linux
- **Architecture:** x64

## Plan Items

*No plan items found.*
## Input Files

### deps.yml

```yaml
{
  "version": 1,
  "depends_on": [],
  "strategies": {}
}
```

### gates.yml

```yaml
{
  "version": 1,
  "levels": {
    "default": [
      {
        "name": "lint",
        "run": "npm run lint"
      },
      {
        "name": "typecheck",
        "run": "npm run typecheck"
      },
      {
        "name": "unit",
        "run": "npm test"
      }
    ]
  }
}
```

### scope.yml

```yaml
{
  "version": 1,
  "target": "main",
  "sources": [
    {
      "query": "is:open label:stack:*"
    }
  ],
  "selectors": {
    "include_labels": [
      "stack:*"
    ],
    "exclude_labels": [
      "WIP",
      "do-not-merge"
    ]
  },
  "defaults": {
    "strategy": "rebase-weave",
    "base": "main"
  },
  "pin_commits": false
}
```

### stack.yml

```yaml
{
  "version": 1,
  "target": "main",
  "prs": []
}
```
