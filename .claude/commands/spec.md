---
description: Draft a new spec using the spec-writer subagent
---

Use the `spec-writer` subagent to draft `specs/NNN-$ARGUMENTS.md`.

Steps:

1. Read `CLAUDE.md` for project context.
2. Read `specs/_template.md` for structure.
3. Read `specs/001-landing-seo.md` for the quality bar.
4. List `specs/` to determine the next NNN.
5. Draft the spec covering the feature described by $ARGUMENTS. If $ARGUMENTS is vague, ASK ME for specifics before drafting — do not invent requirements.
6. After drafting, list the acceptance criteria back and ask:
   - Is any AC not verifiable?
   - Any edge case missing?
   - Anything to add to "Out of Scope"?

Do NOT write implementation code. This command only produces a spec markdown file.
