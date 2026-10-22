# TideCloak setup for CoBid

This guide preserves the existing React/Express app. It uses the current official [quickstart](https://docs.tide.org/get-started/Tidecloak%20Quickstart), [QEA setup](https://docs.tide.org/Admin/SetupIGA), [governance semantics](https://docs.tide.org/Core-Concepts/iga-workflow), and the pinned `@tideorg/mcp@1.9.33` relationship-attestation reference. The local MCP responds over stdio; `.mcp.json` also declares Tide's hosted read-only guidance server. MCP guidance does not provision an independent human identity or approve on that person's behalf.

## 1. Start the supported runtime

On Windows, enable hardware virtualization and install/start Docker Desktop with WSL2 and Linux containers. Complete any required Windows restart before continuing. These host changes are outside the application startup. Alternatively configure an existing licensed TideCloak server through `.env`.

```powershell
npm ci
npm run setup
docker info --format '{{.OSType}}'
npm run tide:up
npm run doctor
```

Docker should report `linux`. `doctor` reports incomplete realm setup until the next steps are finished. Compose binds TideCloak only to `127.0.0.1:8080` and persists its local development database in a named Docker volume. Do not delete the volume to rehearse the demo.

## 2. Activate and enroll

1. Open http://localhost:8080. Read the generated bootstrap username/password in the ignored `.env` **locally**, and sign in. Keep this credential off screen recordings.
2. Use the official **Set up this realm** wizard. Choose realm/project `cobid`; enter the actual consenting license contact and review [Tide's terms](https://tide.org/legal). The project never invents consent or submits a license contact from source control.
3. Choose **Open the link to enroll**. The human operator creates/signs into their Tide account in the enclave. Keep the wizard open until it detects enrollment. Passwords and account recovery remain with that human.
4. Confirm this is a licensed **Tide** QEA realm. A Tideless quorum is software enforced and does not establish the intended network guarantee. Do not use `master` as the app realm.
5. Confirm that the selected network supports **`RelationshipAttestation:1`** (including role subjects and the encryption/decryption models). The pinned MCP says this contract is not available on every network. Ask the Tide team through its official support channel if needed. Do not deploy a substitute contract or report success without a real round trip and negative checks.

## 3. Configure the application client

In **Apps**, create or use the public client named `cobid-web`. If the wizard produced a differently named client, either configure this client or set `TIDECLOAK_CLIENT_ID` and `TIDECLOAK_AUDIENCE` consistently.

Set and approve the following through **QEA Approvals**:

| Setting | Development value |
|---|---|
| Client type | Public OIDC client, browser authorization code flow with PKCE |
| Valid redirect URI | `http://localhost:5173/auth/redirect` |
| Post-logout redirect | `http://localhost:5173/*` |
| Web origin | `http://localhost:5173` |
| Audience mapper | Add `cobid-web` to access-token `aud` |
| Role claims | Include business realm roles in `realm_access.roles` |
| Governance admin claim | Include `realm-management`'s `tide-realm-admin` under `resource_access`, or the documented realm-role mapping used by your realm |
| Sender-constrained tokens | DPoP enabled; CoBid forces SDK strict mode |

The administrator's browser needs permission to read its signed admin policy. The optional **Who has access?** view also needs user-directory read permissions (`view-users`/appropriate realm-management scope), configured through governance. Grant only the scopes needed; no master credentials go into the app runtime. A 403 in that view leads to the TideCloak console rather than a fabricated roster.

Export **Apps → Credentials → public adapter** to `tidecloak.json` in the repo root. It must match the configured realm/client/server and contain `vendorId` plus public Ed25519 `jwk.keys`. Do not export credentials or private keys. The adapter is ignored by Git. Restart the app after changing it.

## 4. Demo identities and role matrix

Create each person under **People**. Let the intended human open their one-time link and enroll in the enclave. Use a separate browser profile/session per identity. Do not save invite links in committed docs or the recording.

| Suggested username | Business realm roles | Quote roles | Crypto realm roles | Governance |
|---|---|---|---|---|
| `forma` | `cobid-supplier-design` | `cobid-quote-design` | `_tide_encryptor`, `_tide_decryptor` | None |
| `common-ground` | `cobid-supplier-software` | `cobid-quote-software` | `_tide_encryptor`, `_tide_decryptor` | None |
| `frame-by-frame` | `cobid-supplier-video` | `cobid-quote-video` | `_tide_encryptor`, `_tide_decryptor` | None |
| `buyer` | `cobid-buyer` | None initially | `_tide_decryptor` | None |
| `coordinator-admin-a` | `cobid-coordinator` | None | `_tide_decryptor` | `tide-realm-admin` |
| `governance-b` | None | None | None | `tide-realm-admin` |
| `governance-c` | None | None | None | `tide-realm-admin` |

One governance administrator also plays the business coordinator so the demo tests an actor who actually has permission to **propose** a self-grant. The other administrators independently review it. A coordinator without admin authority cannot even propose the governed change.

Create the business and quote roles in **Advanced → Roles** and authorize the creation requests. `_tide_encryptor`/`_tide_decryptor` are fixed **realm** roles required by this contract. Grant each user's roles through governed changes. Never place quote or crypto roles in `default-roles-cobid`. The self-only `_tide_<tag>.selfencrypt` example in the general E2EE guide is a different scenario; it cannot replace shared role-bound quote policies.

Users must sign in/refresh after changes so new claims are issued. Keep `_tide_encryptor` off the buyer; API writes additionally require the matching supplier membership.

## 5. Sign the record policies, then establish governance

1. Run `npm run dev`; open http://localhost:5173 as the enrolled first admin.
2. Under **Connection & setup**, sign each of the three quote policies through the real Tide enclave. Each policy binds exactly `cobid-quote-<supplier>-v1` to realm role `cobid-quote-<supplier>`, and models `PolicyEnabledEncryption:1` and `PolicyEnabledDecryption:1`.
3. A stored 64-byte signature is only structural evidence. Confirm real encryption/decryption on the network before relying on it.
4. Enroll and grant governance authority to the additional independent administrators. Governed configuration and grants may each need **Authorize** in the console. Finish related admin-policy regeneration requests too.
5. Verify **three active `tide-realm-admin` holders** and a live threshold of **two**. The documented rule is `max(1, floor(0.7 × N))`: **two admins still require only one approval**. Never present a two-admin realm as protection against a solo override.

Do not temporarily lower the threshold to rehearse or record. The master realm is a recovery/admin escape hatch, not protected by app-realm QEA; keep it out of the demonstration and state this boundary.

## 6. Prove the supported flow

Before filming, record all live results in [verification.md](verification.md):

1. As each supplier, encrypt and submit the synthetic quote, close it, and decrypt it again.
2. As another supplier and as the coordinator, attempt the design quote: denied. A direct API request must also be refused; frontend button state is insufficient.
3. As admin A, propose assigning `cobid-quote-design` **to admin A**. In QEA Approvals inspect the exact recipient/action, authorize once, and demonstrate that the grant remains ineffective below quorum. Leave the attack request pending or deny it; **B/C must never authorize it**.
4. Separately, as the buyer, record an application access request with a business reason. In TideCloak propose assigning `cobid-quote-design` **to the buyer**.
5. Admin B authorizes the buyer request; confirm it remains pending if only one signature. Admin C independently authorizes that **same buyer request**. Confirm the real applied/committed result in TideCloak.
6. Buyer refreshes access in CoBid, opens the design quote, and decrypts successfully. Refresh admin A as well and confirm the self-grant remains ineffective.
7. In a separate validation exercise, verify wrong/multiple record tags, an unassigned role subject, and removal of `_tide_decryptor` are rejected by the network after reauthentication. Use synthetic content only. Preserve the original errors rather than labeling every threshold error an outage.

Approvals happen in TideCloak under each human's own session. CoBid never proxies them under a service account. Its intent records are not QEA requests, and it never invents approval counts, a rejection status, or an individual owner veto.

## 7. Reset and record

Follow [DEMO.md](../DEMO.md). Stop CoBid before `npm run demo:reset -- --confirm`. The script makes a local backup and preserves policies/replay history. Tide role grants require separate governed removal and refreshed user sessions. Keep the attack and buyer requests separate throughout reset and recording.

Record the resolved container image digest without displaying secrets:

```powershell
docker image inspect tideorg/tidecloak-dev:latest --format '{{index .RepoDigests 0}}'
```

Store the digest and observed Tide server/SDK versions in the verification record. The dev `latest` tag is a convenience, not a reproducible production deployment.
