# Spec NNN: <Feature name>

**Status**: draft | approved | implemented | deprecated
**Author**: Julio
**Created**: YYYY-MM-DD
**Related specs**: <links or none>

## 1. Context & Motivation

Why this feature exists. What problem it solves. 2–4 sentences max.

## 2. User Stories

- As a <role>, I want to <action> so that <outcome>.
- As a <role>, I want to <action> so that <outcome>.

## 3. Acceptance Criteria

Verifiable Given/When/Then statements. Every AC must be testable.

- [ ] **AC1**: Given <context>, when <action>, then <result>.
- [ ] **AC2**: ...

## 4. Technical Contracts

### API endpoints
| Method | Path | Auth | Request | Response |
|--------|------|------|---------|----------|
| POST | /example | none | `{ ... }` | `201 { ... }` |

### Shared types
```ts
// packages/shared-types/src/<feature>.ts
export interface ExampleDto { ... }
```

### Database changes
New models / columns / indexes. Link migration name.

### Frontend routes / components
- `/route` — page purpose
- `<ComponentName>` — purpose

## 5. Edge Cases & Errors

- What happens when input is invalid?
- Concurrent requests?
- Upstream service failure?
- Expected error codes and messages.

## 6. Out of Scope

Explicit list. Prevents scope creep. Anything not listed here is a future spec.

- ...

## 7. Implementation Notes (optional)

Key decisions, libraries chosen, gotchas the implementer should know.

## 8. Validation Plan

- **Unit tests** covering: ...
- **Integration tests** covering: ...
- **E2E tests** covering: ...
- **Manual test steps**: ...
