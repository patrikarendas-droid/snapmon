# SnapMon developer catalogue

A developer-only review tool for all 2,308 objects:
- real sprites (5 rarities × 4 variants) and the live names, flavour text and moves;
- granular review notes and proposed replacement text, synced between the owner's phone and PC through Firebase.

**URL:** <https://patrikarendas-droid.github.io/snapmon/catalogue/>. It is not linked from the game. It uses no camera,
recognition or models, and it never changes the game, saves, writing or sprites.

The page and its code are public, like the rest of the GitHub Pages site. The **review data** is private: it needs the
owner's Firebase sign-in, and the Firestore rules enforce that (see Security).

## Using it

1. Open the URL. Without signing in, everything works **locally**. The header then says **"Local only — NOT synced"**,
   and the reviews live only in this browser.
2. **Sign in** with the owner's Firebase email and password. Accounts are created in the Firebase console; the page has
   no registration.
   - "Keep me signed in on this device" is **off** by default: the session ends when the tab or browser closes.
     Leave it off on a shared or work PC.
   - Other accounts are refused.
   - Signing out never deletes cloud reviews.
   - "Sign out and clear this browser" also removes the local copy, and is offered only when everything is synced.
3. **Find objects:**
   - search by name, ID, recogniser label or curated monster name;
   - filter by category and by review state (Unreviewed / Not approved yet / In progress / Approved / Needs fix);
   - step through with Prev / Next, Next unreviewed, or the keys `j` / `k`.

   The last object, rarity, variant and filter are remembered on each device.
4. **Inspect an object:**
   - five rarity sprites and a variant picker (Normal, Spectral, Mutated, Prismatic);
   - the selected sample's name, flavour text, family, stats, and its real moves with their stable slot
     (`moves.signature`, `moves.kit.<slot>`, `moves.legend`, `moves.ultimate`), power, hits, effect, chance and
     cooldown. A tag marks moves that keep their generated name.

   **What a sample is:**
   - Every sample is drawn by the game's own code (`createMonster` + `renderSprite`), with a fixed seed per
     object × rarity × variant and neutral colours (no photo).
   - Real captures differ in colour and small details.
5. **Review.** Each field has *Not reviewed / Looks good / Needs fix*, a note, and (for text) a proposed replacement,
   shown next to the **live** value.

   | Scope | Fields |
   |---|---|
   | Per rarity | monster name `names.<rarity>`, flavour text `lore.<rarity>`, optional sprite note `visual.<rarity>.<variant>` |
   | Per object | sprite/design `visual`, every move slot `moves.<key>`, recogniser mapping `mapping` |

   **Everything looks good** marks every not-yet-reviewed required field of the object as good:
   - required fields: 5 names, 5 texts, all move slots, and `visual`;
   - it never changes a *Needs fix*, and never erases a note or proposal.

   **Undo** reverts the last edits in this session.

   **Object states:**
   - **Needs fix:** any field needs a fix.
   - **Approved:** every required field is good.
   - **In progress:** some fields are reviewed.
   - **Unreviewed:** nothing is reviewed yet.

## Saving, sync and the status indicator

- Every edit is saved **on this device first**, under its own namespaced keys (`snapmon-catalogue.v1.*`), never the
  game's.
  - Note and proposal keystrokes are saved even before the 0.6 s autosave.
- Signed in, changed objects are uploaded about 2 seconds after the last change.

| Status | Meaning |
|---|---|
| Local only — NOT synced | Not signed in, or Firebase cannot be loaded (for example a company firewall). Export backups. |
| Loading cloud reviews… | Signed in; the cloud reviews are read **before** anything is uploaded. |
| Saved locally · N pending | Edits are on this device and are about to be uploaded. |
| Syncing N… | An upload transaction is running. |
| Synced HH:MM | The server **acknowledged** every change. |
| Offline / pending · N not uploaded | Uploads failed (no connection). They are kept and retried (backoff, and on reconnect). |
| Access denied by Firestore… | Check the rules and authorized domains (see Security). Edits stay on this device. |

**Sync model:**
- **One document per reviewed object:** Firestore `catalogue/{uid}/reviews/{objectId}`. Unreviewed objects have no
  document.
- **What a document holds:** schema, object ID, revision, update time, device, and the review fields. It holds no game
  text and no sprites.
- **Live updates:** one live subscription delivers changes from the other device, with no polling.
- **Uploads:** each upload is a **transaction** that reads the server copy and does a **three-way merge**, comparing
  the base (the last version this device saw acknowledged), this device's edits and the server copy:
  - Changes to *different* fields merge.
  - If the **same field** changed differently on both devices, the server keeps its value. This device's version is
    kept as a **conflict** (banner and per-field box, "Keep A" / "Keep B"); nothing is silently dropped.
- **Caching:** Firestore uses an in-memory cache only. There is no silent persistent cache on a work PC; the
  catalogue's own local queue covers outages and reloads.
- **Clearing site data:** a company browser may clear site data, so export a backup regularly.
- **Local-only reviews:** reviews made in local-only mode are offered for merging into the cloud after signing in. The
  merge uses the same conflict rules.

## Export / import

- **Export JSON** (`snapmon-catalogue-export/1`) contains:
  - the game version, the curated content revision and the export time;
  - per object: name, source file (`content/curated/<file>.json`), state, and every field with status, note, proposal,
    edit time, device and (for text) the **live** value;
  - unresolved conflicts;
  - `patches`: the proposals grouped per source file, in the exact format of
    `node tools/campaign.js patch <batch> <file> --approved-edit`.

  The export never includes the password or tokens.
- **Summary** downloads a short text list of counts and every "Needs fix" item.
- **Import** validates the schema, object IDs and field paths, then shows a preview. It merges **safely**:
  - new fields are added as local edits and then synced;
  - identical fields are skipped;
  - a different existing review becomes a conflict, never an overwrite.

## From feedback to the game (later, always approved)

The catalogue **never** edits production writing or sprites. After an export, the owner and Claude choose small
batches and apply them with the documented flow in `docs/CONTENT_WRITING_GUIDE.md` ("Correcting live writing"):

1. Take an approved subset of `patches.<batch>` into a file.
2. Run `node tools/campaign.js patch <batch> file.json --approved-edit`.
3. Run `validate`.
4. Run `build --enable`.
5. Run `rebaseline "<reason>"`.
6. Run the tests and release.

Sprite (`visual`) and mapping notes are inputs for design or recognition tasks, not text patches.

## Security

- **Firebase project:** `snapmon-catalogue` (Spark plan). Email/Password authentication; authorized domain
  `patrikarendas-droid.github.io`.
- **Client config:** the config in `catalogue/cloud.js` is public client configuration, not a credential. There is no
  Admin SDK, no service account and no stored password.
- **Access control** is the **Firestore rules** published in the console. A reference copy is in
  `catalogue/firestore.rules`: owner only, `request.auth.uid == userId == <owner uid>`. The browser's UID check is only
  for a friendly message. The catalogue never deploys or changes rules.
- **If access is denied:**
  1. Check Firestore → Rules (as in the reference copy, published).
  2. Check Authentication → Settings → Authorized domains (`patrikarendas-droid.github.io`) and that Email/Password
     sign-in is enabled.
  3. Never open the rules to public access.

## Files

`catalogue/`:
- `index.html` — page and theme; loads the game's data, sprite and curated scripts unchanged.
- `app.js` — UI, local store and sync engine.
- `review-model.js` — pure merge, approval, export and import logic.
- `cloud.js` — Firebase 13.2.0 modular SDK, loaded by a guarded dynamic import.
- `sources.js` — generated by `node tools/catalogue-sources.js`.
- `firestore.rules` — reference copy.

## Testing

**In CI (every deploy):**
- `tests/catalogue-model.js`: merge, approval, export/import, the source map, and static isolation (no game storage,
  camera or models).
- `tests/e2e-catalogue-local.js`: phone and desktop, Firebase blocked, real sprites and writing, reload, export/import,
  game save untouched.

**Locally, with the real SDK and the Firebase emulators:** `tests/e2e-catalogue.js` checks:
- the rules: only the owner can read or write; unauthenticated users and other accounts are denied;
- wrong password, a refused non-owner, owner sign-in;
- cloud-first load, merging local-only reviews, two devices;
- offline queue and reconnect, independent-field merge, same-field conflict and its resolution;
- live updates, "Everything looks good", export → import;
- the game's storage is untouched.

To set it up:
1. `npm i --no-save firebase@13.2.0 firebase-tools@14` in a scratch folder (Java needed).
2. A `firebase.json` with the auth (9099) and firestore (8080) emulators and `rules` → `catalogue/firestore.rules`.
3. Start the emulators: `npx firebase emulators:start --only auth,firestore --project snapmon-catalogue`.
4. Create the test users with fixed UIDs (the owner UID and an intruder) through the Auth emulator REST API
   (`accounts` with `Authorization: Bearer owner`).
5. Run `python3 -m http.server 8765`.
6. Run `node tests/e2e-catalogue.js http://localhost:8765/ <scratch-folder> <outdir>`.

The page talks to the emulators only when served from localhost with `?emulator=1`.

**Owner acceptance test (real Firebase):**
1. On the phone, open the URL, sign in, review one field ("Needs fix" + note), and wait for **Synced**.
2. On the PC, open the URL, sign in, and check that you see it. Change another field there, then reload the phone.
3. Export JSON on either device.
