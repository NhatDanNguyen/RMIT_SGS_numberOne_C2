# CoBid — two-minute simulation video script

This script follows the in-app walkthrough: Alex opens their own quote, Jordan is denied, a solo self-grant stays pending, and a separate buyer grant succeeds after two different demo administrators approve.

**On-screen label throughout:** `TideCloak simulation · Synthetic data only`.

**Recording status:** script ready; no video is created by this document update. Sign-in, quote encoding and approvals in this recording are simulated. Do not describe the footage as real TideCloak authentication, encryption or network governance.

## Before recording

1. Run the app from the repository:

   ```powershell
   npm run simulate
   ```

2. Open http://localhost:5173. Keep the app's **SIMULATION** banner visible when framing the recording. Use a wide browser window so navigation and the approval cards are easy to read.
3. If you have rehearsed already, choose **Jordan · Coordinator**, open **Access requests**, and click **Reset simulation to its starting state**. This restores the three synthetic quotes and removes previous simulated role grants and approvals.
4. Return to **Bidding room**. Open **Switch identity** or **Choose demo identity** when starting each role's part. No passwords, Docker or real Tide accounts are needed.
5. Rehearse the exact controls below. Prepare these short purposes to type or paste:
   - Self-access request: `Synthetic solo self-access attempt.`
   - Buyer request: `Buyer review of the university campaign quote.`
6. Keep the two requests separate. Morgan and Casey approve **Taylor's request only**, never Jordan's self-access request.

## Timed shots and narration

| Time | What to do on screen | What viewers should see | Read aloud |
|---|---|---|---|
| **0:00–0:12** | Show **Bidding room**, the campaign brief and the three studios. Keep the simulation banner visible. | One shared university campaign, three complementary contributors. | “CoBid helps three small studios bid together without giving the coordinator automatic access to every commercial detail. This walkthrough uses a clearly labeled TideCloak simulation.” |
| **0:12–0:27** | Choose **Alex · Forma Studio**. Open **Protected quotes → Forma Studio → Open quote**. Briefly show the amount, timeline and note, then **Close protected view**. | **Simulated authorised view**, Forma's synthetic quote of **85,000,000 VND**, a three-week timeline and a confidential note. | “Alex represents Forma Studio and can open Forma's own quote. The amount, delivery timeline and commercial note are available through the studio's assigned demo roles.” |
| **0:27–0:42** | **Switch identity → Jordan · Coordinator**. In **Protected quotes**, try **Open quote** for Forma. | An access-denied message; no quote content opens. | “Jordan coordinates the shared bid and also plays a governance administrator. That does not automatically grant quote access. The application refuses this request on the server.” |
| **0:42–1:02** | Go to **Access requests**. Under **Simulated governance**, choose recipient **Jordan · Coordinator**, quote **Forma Studio**, and the self-access purpose. Click **Propose simulated access**, then **Approve as current admin**. | Jordan's card shows **Self-access request**, **1 of 2 · Pending**, and **You already approved** disabled. | “Jordan proposes access for themselves and approves once. The change stays pending at one of two approvals. The same administrator cannot provide the second vote.” |
| **1:02–1:15** | In the same form, change the recipient to **Taylor · Buyer**, keep **Forma Studio**, enter the buyer purpose, and click **Propose simulated access**. | A separate Taylor request at **0 of 2 · Pending**. Jordan's self-request remains at **1 of 2**. | “We leave that self-grant unapproved. Instead, we create a separate request naming Taylor, the intended buyer, and Forma's specific quote.” |
| **1:15–1:35** | **Switch identity → Morgan · Admin B**. Approve **Taylor's card**. Then switch to **Casey · Admin C** and approve that same Taylor card. | Taylor's request moves from **1 of 2 · Pending** to **Approved · simulated**. The approval names are Morgan and Casey; Jordan's card stays pending. | “Morgan reviews and approves the buyer request. Casey then supplies the second vote. Two different demo administrators complete this simulated grant, without approving Jordan's self-access.” |
| **1:35–1:50** | **Switch identity → Taylor · Buyer**. Click **Refresh access**, then **Buyer view → Forma's View commercial quote**. | Forma's amount, timeline and note open under **Simulated authorised view**. | “Taylor refreshes their role snapshot and opens Forma's quote from the buyer view. The approved scope is specific: the other studios' quotes remain restricted.” |
| **1:50–2:00** | Close the quote. Switch back to **Jordan**, click **Refresh access**, and try Forma's quote again. Finish on the denial. | Jordan remains denied even after Taylor's successful access. | “Jordan still cannot open it. CoBid models collaboration with separate access authority. Real TideCloak identity, cryptography and network-enforced approvals remain future integration work.” |

## Important recording details

- Say **“simulated sign-in,” “simulated grant,”** or **“demo administrator”** where applicable. The quote view decodes synthetic data; it does not perform real Tide decryption.
- **Request access** records business intent. The separate **Simulated governance** panel changes the demo permission. The timed video uses that governance panel directly to keep the story within two minutes.
- Wait for each request and result to finish before switching identities. In particular, confirm **1 of 2 · Pending** after Morgan's approval and **Approved · simulated** after Casey's.
- During role changes, check the current identity before approving. Select the card naming **Taylor**, not Jordan.
- If the buyer remains denied, click **Refresh access** after approval. If the server restarted or the mock session expired, choose the identity again.
- Record the real simulator interaction at a comfortable pace. Trim idle pauses or use clearly visible cuts between identities to fit two minutes. Keep the actual pending, approved and denied results; do not fabricate counts or substitute a success screen for an error.

## Optional features for a longer walkthrough

These are useful demonstrations but are outside the two-minute timing above:

- **Prepare quote:** as Alex, update Forma's synthetic amount or note and choose **Seal & submit quote**. Explain that sealing is simulated in this mode.
- **Who has access?:** as Jordan, open this control on Forma's protected quote to inspect simulated role membership. After the buyer grant, Taylor should be listed.
- **Activity:** show recorded sign-ins, denied quote access, proposals and approval actions. These are ordinary application records, not an immutable audit trail.
- **Request access:** as Taylor before approval, record a business purpose. Explain that this intent alone does not authorize the quote.

## Reset for the next take

1. Close the quote view.
2. Switch to **Jordan**, **Morgan** or **Casey**.
3. Open **Access requests → Reset simulation to its starting state**.
4. Wait for the reset confirmation, then return to **Bidding room**.
5. Start again as Alex. Taylor should have no extra quote access, and the simulated governance queue should be empty.

This reset affects the separate local simulation database, not a real Tide realm or the live-mode application database.

## Export and check the video

Save this recording as **`demo/CoBid-simulation-demo.mp4`**. Keep it approximately **two minutes** and **under 100,000,000 bytes**. Use an MP4 export supported by your screen recorder; 720p or 1080p is suitable.

Play the exported file from beginning to end. Check that the text is readable, narration matches the actions, the simulation label is clear, and no unrelated personal tabs, credentials or local environment files appear.

If FFmpeg tools are available, inspect the actual file:

```powershell
ffprobe -v error -show_entries format=duration,size -of json demo/CoBid-simulation-demo.mp4
```

Record the actual duration, size and playback check in `docs/verification.md` after the video exists. This simulation video does not establish the hackathon's real TideCloak integration requirement; the real-flow checklist remains in that verification document and `docs/tidecloak-setup.md`.
