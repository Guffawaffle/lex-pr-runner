# Video Script: Getting Started with lex-pr-runner

**Duration:** 5 minutes  
**Target Audience:** New users  
**Prerequisites:** Basic Git and GitHub knowledge

## Setup

**Demo Repository:** `lex-pr-demo`  
**Sample PRs:** 2 independent PRs ready to merge

---

## Script

### Introduction (0:00 - 0:30)

**[Screen: lex-pr-runner logo]**

> "Hi! Welcome to lex-pr-runner. In this 5-minute video, you'll learn how to automate your PR merge workflow. We'll go from installation to your first successful automated merge."

**[Screen: Show 3 bullet points]**
- Install lex-pr-runner
- Set up your workspace
- Merge PRs automatically

---

### Installation (0:30 - 1:00)

**[Screen: Terminal]**

> "First, let's install lex-pr-runner. It's a Node.js package, so you'll need Node 20 or later."

```bash
$ node --version
v20.18.0

$ npm install -g lex-pr-runner
[installation output]

$ lex-pr --version
0.1.0
```

> "Great! lex-pr-runner is now installed globally."

---

### Workspace Initialization (1:00 - 2:00)

**[Screen: Terminal, inside demo repo]**

> "Now let's initialize our workspace. Navigate to your Git repository and run lex-pr init."

```bash
$ cd lex-pr-demo
$ lex-pr init
```

**[Annotation: Highlight the interactive prompts]**

> "The setup wizard will ask a few questions. You can provide a GitHub token for API access, or skip it for now."

```
? GitHub Token (optional): [skip]
? Target branch: main
✓ Workspace initialized in .smartergpt.local/
```

> "Perfect! lex-pr-runner created configuration files in .smartergpt.local."

**[Screen: Show file tree]**

```
.smartergpt.local/
├── intent.md
├── scope.yml
├── deps.yml
├── gates.yml
└── profile.yml
```

---

### Discovering PRs (2:00 - 2:30)

**[Screen: Terminal]**

> "Let's discover open pull requests."

```bash
$ lex-pr discover
```

**[Annotation: Highlight the PR list]**

```
Found 2 pull requests:

| PR    | Title            | Branch      | Author   | Labels |
|-------|------------------|-------------|----------|--------|
| #1    | Add feature A    | feature-a   | alice    | ready  |
| #2    | Add feature B    | feature-b   | bob      | ready  |
```

> "lex-pr-runner found 2 PRs ready to merge."

---

### Generating Merge Plan (2:30 - 3:15)

**[Screen: Terminal]**

> "Now let's generate a merge plan."

```bash
$ lex-pr plan --from-github
```

**[Annotation: Show plan.json output]**

```
✓ Generated merge plan: plan.json
  - 2 items
  - 0 dependencies
  - Target: main
```

> "The plan.json file contains the merge order and configuration. Let's verify it."

```bash
$ lex-pr merge-order plan.json
```

**[Annotation: Highlight the merge order]**

```
Merge order for 2 items:
Level 0: feature-a, feature-b
```

> "Both PRs are independent, so they're at the same level."

---

### Running Quality Gates (3:15 - 4:00)

**[Screen: Terminal]**

> "Before merging, let's run quality gates to ensure everything passes."

```bash
$ lex-pr execute plan.json
```

**[Annotation: Show gate execution progress]**

```
Executing gates...
✓ feature-a: test (2.3s)
✓ feature-a: lint (0.8s)
✓ feature-b: test (1.9s)
✓ feature-b: lint (0.7s)

All gates passed ✓
```

> "Excellent! All quality gates passed."

---

### Merging PRs (4:00 - 4:30)

**[Screen: Terminal]**

> "Now for the final step: merging the PRs. First, let's do a dry-run."

```bash
$ lex-pr merge plan.json --dry-run
```

**[Annotation: Highlight dry-run output]**

```
Dry-run mode (no changes will be made):
  1. Merge #1 (feature-a)
  2. Merge #2 (feature-b)
```

> "The dry-run shows what would happen. Everything looks good, so let's execute the merge."

```bash
$ lex-pr merge plan.json --execute
```

**[Annotation: Show merge progress]**

```
Merging PRs...
✓ Merged #1: Add feature A
✓ Merged #2: Add feature B

Successfully merged 2 PRs
```

---

### Conclusion (4:30 - 5:00)

**[Screen: Summary slide]**

> "Congratulations! You've successfully:"

**[Show checklist]**
- ✓ Installed lex-pr-runner
- ✓ Initialized your workspace
- ✓ Discovered PRs
- ✓ Generated a merge plan
- ✓ Executed quality gates
- ✓ Merged PRs automatically

> "For more advanced features like dependency management and CI/CD integration, check out the documentation at github.com/Guffawaffle/lex-pr-runner."

**[End screen with links]**
- 📚 Documentation
- 🎓 Next Tutorial: Understanding Dependencies
- 💬 GitHub Discussions

---

## B-Roll Suggestions

- Show GitHub PR interface
- Highlight merge conflicts avoided
- Display CI/CD pipeline integration
- Show team collaboration

## Common Questions to Address

**Q: Do I need a GitHub token?**
> "It's optional but recommended for private repositories and higher API rate limits."

**Q: What if I have merge conflicts?**
> "lex-pr-runner will detect conflicts and guide you through resolution. See the Troubleshooting guide."

**Q: Can I use this with GitLab?**
> "Currently GitHub only, but GitLab support is planned."

## Captions/Subtitles

Provide full captions for accessibility:
- Include command outputs as text
- Describe visual elements ("terminal shows...")
- Spell out technical terms

## Post-Production

1. Add intro animation (5 seconds)
2. Include chapter markers:
   - 0:00 Introduction
   - 0:30 Installation
   - 1:00 Workspace Setup
   - 2:00 Discovering PRs
   - 2:30 Merge Plan
   - 3:15 Quality Gates
   - 4:00 Merging
   - 4:30 Conclusion

3. Color grade for consistency
4. Add background music (subtle, during intro/outro only)
5. Include end screen (last 10 seconds)

## Assets Needed

- lex-pr-runner logo (PNG, transparent)
- Demo repository setup script
- Sample configuration files
- Terminal color scheme preset
