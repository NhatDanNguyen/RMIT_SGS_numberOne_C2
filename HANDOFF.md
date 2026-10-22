# CoBid continuation handoff

This is the existing CoBid repository, not a new project. Preserve its React/Express/SQLite implementation and synthetic university-bid scenario.

**Latest user direction:** simulate TideCloak sign-in, roles and access checks for now, using Tide MCP to plan the real fit. The explicit local simulation is implemented and selected in the ignored `.env`. Run `npm run simulate`, open http://localhost:5173 and choose an identity. It uses `.local/cobid-simulation.sqlite`, not the live application database. See `docs/simulation.md`; real integration and recording remain unverified/future work.

## Current state

- Public bidding room, three studios, structured protected quotes, buyer summary/download, access-intent records, activity and setup screens exist.
- Tide SDK sign/encrypt/decrypt calls and server JWT/DPoP verification are preserved in live mode. There is no implicit mock fallback when live setup is missing. Explicit simulation adds seven fictional identities, seeded quote encoding, backend checks and a two-distinct-admin approval queue.
- Continuation work adds session-result invalidation, trusted governance-role mapping, admin directory access inspection, 46 regression tests, a readiness checker, backed-up reset, CI and the required setup/demo/architecture/verification documents.
- `npm run check` passed locally; its tests use test keys/fixtures and do not establish live Tide guarantees.
- Local development servers were started at http://localhost:5173 and http://127.0.0.1:3001. They can be restarted with `npm run dev`.

## Future real-integration steps

0. Set `AUTH_MODE=tide` in `.env`, stop `npm run simulate`, and use `npm run dev` for the real path. Reload the browser after changing modes.
1. Finish Windows virtualization/WSL2/Docker Desktop installation and start its Linux engine. The operator chose this path.
2. `npm run tide:up`; open http://localhost:8080 and follow `docs/tidecloak-setup.md`.
3. The operator supplied a license contact and agreed to Tide's terms. These values are saved **only in ignored `.env`**. Do not print or commit the file. Account creation/credentials and independent approver enrollment still require the humans.
4. Verify network support for `RelationshipAttestation:1`. Export the public adapter to ignored `tidecloak.json`; restart CoBid.
5. Finish client claims/scopes/DPoP, demo memberships and three independent admin identities. Confirm the **actual** two-of-three threshold. Sign quote policies and complete the real acceptance checklist.
6. Record actual results in `docs/verification.md`. Rehearse `DEMO.md`, capture a real two-minute MP4 under 100 MB at `demo/CoBid-demo.mp4`, inspect playback/secrets, and update the submission status honestly.

## Development commands

```powershell
npm ci
npm run setup
npm run doctor
npm run check
npm run dev
npm run simulate
```

For a demo application-data reset: stop CoBid, then `npm run demo:reset -- --confirm`. It backs up SQLite and preserves policies/replay history. Reset Tide role grants separately through governance and refresh affected sessions. Never clear proof replay history just to rehearse.

## Important boundaries

The app request is intent only; approvals occur in TideCloak. Keep the unauthorized self-grant and legitimate buyer grant separate. Do not mark tests with synthetic signatures as real integration. Do not claim that an adapter means live protection is verified, that two admins imply two approvals, that the master realm is QEA protected, that frontend delivery is immune to compromise, or that copying can be revoked.

`README.md` and `HANDOFF.md` were missing from the original checkout; the previous shared chat was inaccessible (403). The supplied friend prompt and challenge HTML were reviewed as requirements. No repository visibility change, external submission or remote push was authorized/performed in this continuation.
