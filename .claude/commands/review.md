---
description: Review implemented code against its spec using the code-reviewer subagent
---

Use the `code-reviewer` subagent to verify implementation against `$ARGUMENTS` (path to spec).

Steps:

1. Read `CLAUDE.md`.
2. Read the spec `$ARGUMENTS`.
3. Determine the scope of files changed (`git diff main...HEAD` or ask me which files).
4. Walk through the review checklist in the code-reviewer subagent definition:
   - AC coverage (map each AC to evidence)
   - Convention compliance
   - Automated checks (typecheck, lint, test)
   - Security & safety
   - Test coverage
5. Produce the review report in the format specified in the code-reviewer definition.
6. Do NOT fix issues yourself. Report them and let me decide what to fix.
