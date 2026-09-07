# Learning guides

Working notes written while building this project, one per phase. Each guide
covers what a piece of infrastructure is for, why it is built the way it is,
and what the alternatives were.

They are written to be read before doing the work, then kept as a reference.

## How each guide is structured

1. **Goal** — what exists at the end
2. **Why it matters** — the problem it solves, and how to explain it
3. **Concepts** — the ideas, with the tradeoffs named
4. **What is already here** — how this repo does it today
5. **Tasks** — the hands-on part
6. **Verify** — how to know it worked
7. **Questions** — check your understanding

## Phases

| # | Guide | Status |
|---|---|---|
| 1 | Repository foundation: `.gitignore`, secrets, first commit | Done |
| 2 | Secrets: user-secrets, `.env.example`, scanning | Done |
| 3 | Local development: Docker Compose for dependencies | Done |
| 4 | Git workflow: branches, pull requests, review | Done |
| 5 | [Containerizing the application](05-containers.md) | Done |
| 6 | [Continuous integration](06-ci.md) | Done |
| 7 | [Testing in depth](07-testing.md) | In progress |
| 8 | Observability: logs, traces, metrics | Not started |
| 9 | Deployment | Not started |

Guides are written when the phase is reached, so unlinked rows have no document yet.

Phases 6 and 7 are out of numerical order because CI was built first, then used
as the reason to go deeper on testing.

## Principles these follow

**Configuration over hardcoding.** The application reads everything from
configuration. Secrets arrive from the environment. The repository holds the
shape of the config, never a real credential.

**Every layer is explainable.** No tool is added because a tutorial said so. If
a piece of infrastructure cannot be justified out loud, it does not belong.

**Verify, do not assume.** Every guide ends with a command that proves the thing
works. "It should work" is not a result.
