# Verification record — 22 October 2026

## Current mode: explicit local simulation

The latest user request authorizes simulated TideCloak sign-in, roles and access checks for now. The simulator is implemented, continuously labeled in the UI, and uses a separate local database. It provides no real Tide protection. See [simulation.md](simulation.md) for the MCP-informed integration plan and switching instructions.

## What ran locally

Environment: Windows, Node **24.18.1**, npm **11.16.0**. SDK versions are locked: `@tidecloak/js 0.14.41`, `@tidecloak/react 0.14.33`, `@tideorg/js 0.14.29`, `heimdall-tide 0.14.41`, `@tideorg/mcp 1.9.33`.

| Check | Observed result |
|---|---|
| Locked installation (`npm ci --ignore-scripts`) | Passed after retrying restricted DNS/registry connections; no dependency-version changes |
| Local Tide MCP over stdio | Connected successfully; tools list returned, including scenario, playbook and doctor |
| `npm run check` | Passed: syntax checks, TypeScript, **46 tests**, production build |
| JavaScript syntax check | Passed for server/scripts/shared/tests/browser session module |
| TypeScript | Passed with strict project configuration |
| Vite production build | Passed; browser bundle approximately 480 kB before gzip |
| Anonymous and foreign-origin requests | Denied by offline integration tests |
| Supplier isolation/coordinator/admin implicit read denial | Passed with test-signed tokens; direct API checks, not just UI controls |
| DPoP method/URL/token binding and replay | Passed with locally generated proof keys |
| Quote policy structure and locking | Wrong subject/expired policy refused; sealed quote policy replacement refused |
| Ciphertext storage and stale updates | Passed; unexpected plaintext fields refused, conflict rolls back |
| Access intent | Private by recipient, deduplicated, cannot grant permission |
| Governance role mapping | Accepts realm or realm-management admin mapping; arbitrary client role refused |
| Adapter validation | Public field allowlist and rejection of credentials/private keys/mismatches passed |
| Pending decryption/session guard | Unit regression cases passed for logout, changed user/roles, close, refresh; current session accepted |
| Safe application reset | Passed: backup readable, quotes/requests/events cleared, policy and replay history preserved; outside-local path refused |
| DPoP relay framing (Vite and Express) | Both returned 200 with SDK CSP, `Allow-CSP-From: *`, no conflicting X-Frame-Options; wrong issuer/client returned 403 |
| Browser public preview | Brief modal, quote filtering, setup redirection, buyer proposal and mobile navigation inspected in a real browser |
| Simulation behavior | Passed: known-identity login, opaque HttpOnly cookies, backend role denials, distinct-vote counting, pending self-grant, two-vote buyer grant, refresh semantics, rejection, reset and live-mode isolation |
| Simulation browser story | Passed in the running browser: coordinator denied, self-grant 1/2 pending, buyer approved by Morgan + Casey, buyer opened synthetic quote, coordinator still denied afterward |
| Simulation readiness checker | Passed local checks; explicitly reports real Tide protection inactive |
| Development startup | Vite 5173 and Express 3001 started successfully; public workspace available |

The test runner's localhost connections were initially denied by this execution sandbox (`EACCES`). The same suite was rerun with local network access and all 46 tests passed. This is an environment restriction, not an ignored test failure. GitHub Actions is configured but **has not run remotely** in this session.

## Real versus offline

The Node tests create an ephemeral in-memory SQLite database, their own Ed25519 token key and ES256 DPoP key. Policy fixtures have intentionally synthetic signature bytes and test only structural validation/storage. No test token/key/policy is loaded by the production app.

These checks establish local application behavior. They **do not** prove a real Tide login, a doken, valid Tide policy signature, ORK cryptography, independent human approval, or an administrator's inability to bypass a real configured realm. The previous review's 34 ad hoc API checks also used synthetic sessions and are not live integration evidence.

## Live acceptance — outstanding

At initial inspection, Docker Desktop/engine and WSL2 were absent, virtualization was not enabled, and no exported `tidecloak.json` existed. The operator is preparing Docker. Local license consent/contact were saved only to ignored `.env`; **no activation or enrollment is claimed**.

| Live requirement | Status / evidence to collect |
|---|---|
| Linux container engine running | Pending operator setup |
| TideCloak container and resolved image digest | Not run; record digest and server version |
| Licensed Tide-mode realm and enrolled first admin | Not run; no secrets in evidence |
| `RelationshipAttestation:1` support on selected network | Unconfirmed; verify with actual network or Tide team |
| Client origins, audience, role claims and strict DPoP | Not verified against a live realm |
| Three independent admins; observed threshold two | Not run; record actual count and semantics |
| Real sign-in for all business/governance identities | Not run |
| Three quote policy signing ceremonies | Not run |
| Each supplier encrypt → submit → close → decrypt | Not run |
| Direct API denial and real forbidden network decrypt | Not run with real Tide identities |
| One administrator self-grant remains ineffective | Not run |
| Two independent approvals apply the intended buyer grant | Not run |
| Buyer refresh and authorized decryption | Not run |
| Attack request still ineffective after buyer success | Not run |
| Wrong tag/multiple tags/unassigned subject/decrypt-role removal | Not run against the network |
| Directory roster against actual admin scopes | Implemented, live read pending |
| Actual token expiry and enclave/network failure UX | Source/guard coverage only; live session pending |
| Final MP4 duration, size, playback and secret review | Video outstanding |

Do not change a row to passed unless that operation ran and its result was inspected. Attach redacted evidence with test identity, time, action, expected/actual result and QEA request ID. Never save tokens, credentials, account recovery information or one-time invite links in this file.

## Claims and limitations

The app reports `liveIntegrationVerified:false` and governance `verified:false` rather than deriving protection from configuration presence. QEA approval status/counts remain in TideCloak. App activity is ordinary mutable SQLite history. The access directory is an observed role-members snapshot, with inherited mapping and old-token caveats. Master-realm recovery, malicious frontend delivery, quorum collusion, availability and copying by authorized recipients remain documented trust boundaries.

## Official Tide doctor observation

The pinned MCP doctor was invoked in read-only mode against the running Vite app. It confirmed the SDK-served DPoP page, server token verification and ignored .env, and found the missing realm adapter. Its source scanner does not see the strict DPoP setting computed in `server/config.mjs`; its root-adapter search also differs from this app. Without an adapter it probes a dummy issuer/client (`aa`/`bb`), which CoBid correctly refuses with 403. Do not weaken issuer binding to satisfy that probe.

A separate request using the configured real issuer/client verified both Vite and Express relay responses. That check first exposed Helmet’s SAMEORIGIN header on Express; it was removed only for SDK-owned relay responses and covered by a regression test. Both routes then passed with identical response hashes, strict SDK CSP, `Allow-CSP-From: *`, no X-Frame-Options, and a 403 for mismatched identity parameters. This verifies relay delivery, not a completed Tide login.

## Simulation boundary and data isolation

The mocked session endpoint and approvals router exist only in explicit simulation mode. Configuration rejects simulation for a production environment or non-local host/origin. The default committed mode remains Tide. Tests confirm simulation cookies do not authenticate against live mode, one admin identity cannot supply two votes, the old buyer role snapshot stays denied until refresh, and the separate unauthorized self-grant remains pending after buyer success. Resetting a simulated database does not alter the separate live database.

Simulation uses reversible base64-encoded synthetic quote envelopes. That is not encryption; no real Tide, doken, DPoP, policy signature, ORK validation or independent human approval is claimed. Live acceptance rows above remain outstanding. The current test total is 46, with all passing; a final typecheck and production build also passed.
