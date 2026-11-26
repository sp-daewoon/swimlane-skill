---
name: swimlane
description: Draw a step-by-step procedure swimlane (단계별 절차 스윔레인) as a self-contained HTML page and optional PNG — actors/systems as vertical lanes, phases as horizontal bands, numbered cards holding the real API calls / SQL / config lines, connected by elbow arrows in execution order. Use when the user asks for a swimlane, "스윔레인", "단계별 절차 그려줘", a rollout / rollback / migration / incident runbook diagram, a request or business flow "who does what, in which order", or a sequence across services. Not for static architecture maps (what calls what) — this is for ordered procedures.
---

# swimlane

Turns a procedure into a one-page diagram:

- dark lane headers on top (people → our services → external systems → storage → infra), sticky while scrolling
- yellow phase bands across the full width (stop-and-check points)
- one numbered card per row, placed in the lane that actually performs it; monospace lines inside for real endpoints, SQL, tables, keys
- card kinds: `normal` internal · `external` (dashed) · `db` · `async` batch/queue (dashed) · `warn` risk or unverified (red) · `manual` human action (green)
- arrows drop from the previous card and bend into the next one; `next` for branches/joins
- light/dark aware HTML, no dependencies (Node ≥ 18 only); PNG via local headless Chrome/Chromium/Edge

`<skill-dir>` below = the folder containing this SKILL.md.

## Workflow

1. **Gather facts first.** Read the code, logs, ticket, runbook or the user's description. Only real steps go in. Anything assumed or unverified becomes `kind: "warn"` with a `note`.
2. **Lanes (4–7).** One lane per real executor, left → right: human (operator/QA) → our services → external systems → storage → infra/batch. Give each a short `sub` (tech, host).
3. **Phases.** Cut wherever an operator would pause and verify: pre-check / prepare / execute / verify / cleanup. Name them `Phase 0. …`.
4. **Steps.** One card = one actor doing one thing. `title` is a short verb phrase. `lines` hold the concrete call: `POST /v1/...`, `UPDATE table SET ...`, config key, decision rule. Add a response card only when the response matters.
5. Write the spec JSON to a temp/scratch file, run `--check`, then render with `--png`.
6. **Look at the PNG yourself** (open/read the image) and fix overlaps or truncation before showing it.
7. Show the image to the user, then point out in 2–4 lines: where to stop and verify, steps that cannot be rolled back, and the `warn` steps that need confirmation.
8. If it is worth keeping, save the `.json` + `.html` + `.png` next to the project docs (e.g. `docs/flows/`) — only where the user wants files.

## Spec

```json
{
  "title": "Order checkout — step by step",
  "subtitle": "basis: main@abc123 · dashed = external/async · red = verify",
  "lanes": [ { "id": "user", "name": "Customer", "sub": "web" } ],
  "phases": [
    { "name": "Phase 0. Pre-check", "note": "optional", "steps": [
      { "lane": "user", "title": "Submit order", "lines": ["POST /v1/orders"], "kind": "manual", "note": "no idempotency key" }
    ]}
  ]
}
```

Step fields: `lane` (required, a lane id) · `title` (required) · `lines` (string[]) · `kind` · `note` (red ⚠ line) · `next` (number[] — draw to these step numbers instead of the following card) · `seq: false` (no automatic arrow into this card).
Steps are numbered 1..N automatically in reading order.

## Commands

```bash
node <skill-dir>/scripts/swimlane.mjs spec.json --check                 # validate only
node <skill-dir>/scripts/swimlane.mjs spec.json                         # write spec.html and open it
node <skill-dir>/scripts/swimlane.mjs spec.json --png --out out/flow    # out/flow.html + out/flow.png (2x)
```

- No Chrome found → HTML only; set `CHROME_PATH` to a Chrome/Chromium/Edge binary to enable PNG.
- Example spec: `<skill-dir>/examples/checkout.json` (render it to see the style).
- Keep cards terse: 1–3 lines each. More than ~25 steps → split into two diagrams by phase.
