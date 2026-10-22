# Local simulation and TideCloak integration plan

The user explicitly requested simulated TideCloak sign-in, roles and access checks for this phase. This supersedes the earlier requirement to avoid a simulated product flow. The existing real integration is preserved, and simulated outcomes are never reported as real Tide verification.

## Planning with Tide's MCP

The installed `@tideorg/mcp@1.9.33` was connected over stdio. Planning used `tide_choose_scenario`, the `relationship-attestation` role matrix, the `iga-admin-governance` manifest and the verifiable-claims canon. The result combines governed quote-role membership with role-bound record policies; the manifest's generic admin minimum is not treated as proof of a two-vote threshold. This local scenario explicitly models three admins and two approvals.

| Product boundary | Local simulation | Preserved real Tide integration |
|---|---|---|
| Sign-in | Seven selectable fictional identities; random HttpOnly SameSite session cookie | Tide account/enclave sign-in via React provider |
| Identity and roles | Server-owned role snapshot, refreshed explicitly | Signed EdDSA access token, audience/issuer/authorized-party checks, DPoP |
| Quote access | Existing server role checks protect API retrieval | Same API checks plus network-validated record policy and credential |
| Quote contents | Reversible base64 JSON marked with simulation and record ID | Browser `IAMService.doEncrypt/doDecrypt` with signed `RelationshipAttestation:1` policy |
| Sensitive role grant | SQLite queue; two different demo admin IDs; repeated votes count once | TideCloak QEA under real independently owned browser sessions |
| Directory | Simulator's current role membership | Admin-browser TideCloak role-directory lookup |
| State | `.local/cobid-simulation.sqlite`; no real data migration | `.local/cobid.sqlite` or configured `DATABASE_PATH` |

The backend has authority over the entire simulation. Anyone allowed to use the identity picker can choose an administrator. Base64 does not protect confidentiality. No real Tide account, doken, threshold signature, network-enforced approval, or DPoP check occurs in simulation.

## Start and explore

```powershell
npm ci
npm run simulate
```

Open http://localhost:5173. `npm run simulate` explicitly sets `AUTH_MODE=simulation` for the child processes. The local operator's ignored `.env` may also select simulation for `npm run dev`. The committed example and code default remain `AUTH_MODE=tide`.

1. Choose **Alex · Forma Studio**, then Protected quotes → Forma → Open quote. The synthetic amount and note appear under **Simulated authorised view**. Alex may prepare and submit an updated synthetic quote.
2. Switch to **Jordan · Coordinator** and try the same quote. The API refuses it despite coordinator and admin roles.
3. Open **Access requests**. In simulated governance choose Jordan as recipient, Forma as quote, and enter a synthetic purpose. Propose the request and approve once. It stays **1 of 2 · Pending**, and Jordan remains denied. Repeated clicks or a new Jordan session do not add a second independent vote.
4. Create a **separate** request naming **Taylor · Buyer**. Do not approve the self-grant while rehearsing success.
5. Switch to **Morgan · Admin B** and approve Taylor's request. Switch to **Casey · Admin C** and approve that same request. It becomes **Approved · simulated**.
6. Switch to Taylor, choose **Refresh access**, then Buyer view → Forma → View commercial quote. The synthetic quote opens. Other quotes remain restricted.
7. Switch back to Jordan and refresh. The solo self-grant remains pending and Forma remains inaccessible.

Business access-intent records and governance requests are separate. A buyer can record intent, but cannot directly grant or approve a role. The simulated approval queue is visible only to demo administrators.

## Reset and persistence

From Access requests as a demo admin, choose **Reset simulation to its starting state**. It removes local simulated grants, approvals, business requests and activity, restores the three original synthetic quotes/policies, and updates mock session role snapshots. It does not touch live-mode data or a Tide server.

For the CLI reset, stop CoBid and run `npm run demo:reset -- --confirm` with `AUTH_MODE=simulation` in `.env`. It backs up and clears only the simulation database, including mock approvals/grants. Restart to restore the seed quotes. In `AUTH_MODE=tide`, that same command instead targets the configured live application database and cannot reset real Tide role grants.

Simulation grants/requests persist in their SQLite file. Cookie sessions live only in server memory and expire after 30 minutes; server restart requires choosing an identity again. A role grant does not silently change an existing role snapshot—refresh or a new sign-in is required. These are modeled UX semantics, not claims of real token behavior.

## Mode isolation

- Simulation is opt-in and refused when `NODE_ENV=production`, the backend binds to a non-loopback host, or `APP_ORIGIN` is non-local.
- In live mode `/api/simulation` has no sign-in/approval router. A simulation cookie cannot authenticate against the live JWT/DPoP verifier.
- Choosing a demo identity accepts only a known ID; submitted role lists are rejected. The server derives roles, counts unique administrator IDs and rejects changes to already-approved/denied requests.
- The existing session guard discards late quote results after sign-out, identity changes, close or permission changes.
- Use only synthetic information. Do not expose this selectable-identity demo as a protected production application.

## Connect the real realm later

1. Stop the simulation. Set `AUTH_MODE=tide` in local `.env`; use `npm run dev`, not `npm run simulate`.
2. Complete `docs/tidecloak-setup.md`: licensed Tide-mode realm, enrolled people, public adapter, claims, strict DPoP and contract availability.
3. Recreate the business/quote roles and verify actual three-admin/two-approval semantics. Local simulated grants are not migrated.
4. Sign real record policies and submit fresh encrypted quotes. Simulated encoded bytes/policies must never be imported as real protection.
5. Replace the simulation queue with the existing TideCloak console workflow and record actual sign-in, encrypt/decrypt, refusal and governance evidence in `docs/verification.md`.

The real-flow acceptance gate and required hackathon recording remain outstanding. A recording of this mode must be labeled as a simulation.
