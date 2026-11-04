/* SnapMon developer catalogue — Firebase backend (ES module, loaded ONLY by a guarded dynamic import from app.js, so a
   blocked CDN never breaks the review UI). Official modular Firebase Web SDK, pinned version, no bundler.

   Security: the config below is PUBLIC client configuration (it identifies the project; it grants nothing). Access to
   review data is enforced by the Firestore rules published in the Firebase console (owner-only for
   /catalogue/{userId}/**; copy in catalogue/firestore.rules). The OWNER_UID check here only gives a friendly message.
   No password is ever stored: it goes straight to signInWithEmailAndPassword. Firestore uses an in-memory cache only
   (no silent persistent cache on a shared/work PC); the catalogue keeps its own owner-scoped local queue instead. */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword, signOut, onAuthStateChanged, setPersistence, browserSessionPersistence, browserLocalPersistence } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js';
import { initializeFirestore, connectFirestoreEmulator, memoryLocalCache, collection, doc, onSnapshot, runTransaction } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js';

export const firebaseConfig = {
  apiKey: 'AIzaSyA_MZYu0ISwpmRwJxXSlUdD0geqj2Xxh3g',
  authDomain: 'snapmon-catalogue.firebaseapp.com',
  projectId: 'snapmon-catalogue',
  storageBucket: 'snapmon-catalogue.firebasestorage.app',
  messagingSenderId: '737701050344',
  appId: '1:737701050344:web:61e39d136729318007165d',
};
export const OWNER_UID = 'AaFbfMYZryW21xXczxKQCsdTEsv2';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, { localCache: memoryLocalCache() });
// local testing only: the Firebase emulators, and ONLY on a page served from localhost with ?emulator=1
if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).get('emulator') === '1') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true }); connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
const reviews = uid => collection(db, 'catalogue', uid, 'reviews');            // catalogue/{uid}/reviews/{objectId}

// Backend interface used by app.js (the tests provide a mock with the same shape)
export const backend = {
  kind: 'firebase',
  ownerUid: OWNER_UID,
  onAuth: cb => onAuthStateChanged(auth, u => cb(u ? { uid: u.uid, email: u.email || '' } : null)),
  async signIn(email, password, remember) {
    await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence); // default: this tab session only
    const c = await signInWithEmailAndPassword(auth, email, password);
    return { uid: c.user.uid, email: c.user.email || '' };
  },
  signOut: () => signOut(auth),
  // live subscription: first call delivers every existing review doc (only reviewed objects exist), later calls only changes
  subscribe(uid, onChanges, onError) {
    return onSnapshot(reviews(uid), { includeMetadataChanges: false }, snap => {
      onChanges(snap.docChanges().map(ch => ({ id: ch.doc.id, data: ch.type === 'removed' ? null : ch.doc.data() })));
    }, e => onError(e));
  },
  // optimistic concurrency: read the current server doc and write the merged result in one transaction (needs the
  // server: offline it fails, so nothing is ever reported as synced before the server acknowledged it)
  async commit(uid, objectId, mutate) {
    const ref = doc(reviews(uid), objectId);
    return runTransaction(db, async tx => {
      const s = await tx.get(ref), res = mutate(s.exists() ? s.data() : null);
      if (res && res.doc) tx.set(ref, res.doc);
      return res;
    });
  },
};
