<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Branch Policy

Every ticket gets its own branch before any code is written. Branch naming: `ticket/<short-slug>` (e.g. `ticket/ai-generator-items-tab`).

Steps before starting any ticket:
1. Create a branch from `main`: `git checkout -b ticket/<slug>`
2. Do all work on that branch
3. Push and open a PR when the work is complete — never commit ticket work directly to `main`
