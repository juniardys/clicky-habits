# AGENTS.md

## Copy rules

- Never use an em dash (—) or en dash (–). Use a plain hyphen (-) instead.
  This applies to UI copy, documentation, code comments, commit messages,
  and any text written for this project.

## Environment variables

- `.env.example` is the single source of truth for every environment variable
  the project uses (apps, Dockerfiles, docker compose files, Prisma).
- It must list exactly the variables that are actually read, no more, no less:
  - Adding a new variable anywhere means adding it to `.env.example` in the
    same change, with a comment explaining what it does and example values
    for local and production.
  - When a variable stops being used, remove it from `.env.example` in the
    same change.
  - When a variable's meaning, format, or expected values change, update its
    comment in `.env.example` too.
- Keep `README.md` consistent with `.env.example` whenever variables change.
