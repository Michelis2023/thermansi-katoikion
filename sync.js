import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js';
import {getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut} from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js';

const app = initializeApp({
  apiKey: 'AIzaSyBl6OnyMUDR0ov9KUxX5rJ0qfE2P_xzpJA',
  authDomain: 'thermansi-katoikion.firebaseapp.com',
  projectId: 'thermansi-katoikion',
  appId: '1:601244953831:web:93514b1d314b4db97a0642'
});
const auth = getAuth(app);
const endpoint = 'https://firestore.googleapis.com/v1/projects/thermansi-katoikion/databases/(default)/documents/heatingUsers/';

async function request(current, options = {}, query = '') {
  const token = await current.user.getIdToken();
  return fetch(endpoint + encodeURIComponent(current.user.uid) + query, {
    ...options,
    headers: {Authorization: 'Bearer ' + token, 'Content-Type': 'application/json'},
    signal: AbortSignal.timeout(12000)
  });
}

export function connectSync({read, apply, backup}) {
  const el = id => document.getElementById(id);
  const login = el('syncLogin');
  const logout = el('syncLogout');
  const retry = el('syncRetry');
  const download = el('syncDownload');
  const upload = el('syncUpload');
  let session;
  let unsubscribe = () => {};

  function show(message, actions = {}) {
    el('syncStatus').textContent = message;
    retry.hidden = !actions.retry;
    download.hidden = !actions.conflict;
    upload.hidden = !actions.conflict;
  }

  function watch(user) {
    unsubscribe();
    session = undefined;
    login.hidden = Boolean(user);
    logout.hidden = !user;
    if (!user) {
      show('Οι καταχωρίσεις αποθηκεύονται στη συσκευή. Συνδέσου για συγχρονισμό.');
      return;
    }
    const key = 'pyrina_sync_base_' + user.uid;
    const current = {
      key,
      user,
      base: localStorage.getItem(key),
      remote: undefined,
      busy: false
    };
    session = current;
    show('Έλεγχος κοινών καταχωρίσεων…');
    async function refresh() {
      if (session !== current) return;
      if (!current.busy) {
        try {
          const version = current.version;
          const response = await request(current);
          if (!response.ok && response.status !== 404) throw Error('Read failed');
          const data = response.ok ? await response.json() : null;
          if (session !== current || current.busy || current.version !== version) {
            if (session === current) current.timer = setTimeout(refresh, 10000);
            return;
          }
          current.version = data?.updateTime;
          current.remote = data ? data.fields.payload.stringValue : null;
          reconcile();
        } catch {
          if (session === current) show('Η επικοινωνία με το Firebase απέτυχε. Οι αλλαγές φυλάσσονται στη συσκευή.', {retry:true});
        }
      }
      if (session === current) current.timer = setTimeout(refresh, 10000);
    }
    unsubscribe = () => clearTimeout(current.timer);
    void refresh();
  }

  function remember(current, payload) {
    localStorage.setItem(current.key, payload);
    current.base = payload;
  }

  async function write(current, expected, payload) {
    current.busy = true;
    let success = false;
    show('Αποστολή καταχωρίσεων…');
    try {
      const condition = expected === null ? 'exists=false' : 'updateTime=' + encodeURIComponent(current.version);
      const response = await request(current, {
        method: 'PATCH',
        body: JSON.stringify({fields: {payload: {stringValue: payload}}})
      }, '?currentDocument.' + condition);
      if (!response.ok) throw Error('Write failed');
      const data = await response.json();
      if (session !== current) return;
      current.version = data.updateTime;
      current.remote = payload;
      remember(current, payload);
      success = true;
    } catch {
      if (session === current) {
        current.remote = undefined;
        show('Η αποστολή εκκρεμεί. Οι αλλαγές φυλάσσονται στη συσκευή.', {retry:true});
      }
    } finally {
      current.busy = false;
    }
    if (success) reconcile();
  }

  function reconcile() {
    const current = session;
    if (!current || current.busy || current.remote === undefined) return;
    const {remote, base} = current;
    const local = read();
    if (!navigator.onLine) {
      show('Εκτός σύνδεσης. Οι αλλαγές φυλάσσονται στη συσκευή.');
      return;
    }
    try {
      if (remote === local) {
        remember(current, local);
        show('Οι καταχωρίσεις έχουν συγχρονιστεί.');
      } else if (remote === null || remote === base) {
        void write(current, remote, local);
      } else if (base !== null && local === base) {
        apply(remote);
        remember(current, remote);
        show('Οι κοινές καταχωρίσεις ενημερώθηκαν.');
      } else {
        show('Η συσκευή και το Firebase έχουν διαφορετικές καταχωρίσεις. Επίλεξε ποιο σύνολο θέλεις να κρατήσεις. Θα ληφθεί αντίγραφο του άλλου συνόλου.', {conflict:true});
      }
    } catch {
      show('Η ενημέρωση δεν ολοκληρώθηκε. Έλεγξε τις καταχωρίσεις και δοκίμασε ξανά.', {retry:true});
    }
  }

  login.disabled = false;
  login.addEventListener('click', async () => {
    login.disabled = true;
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch {
      show('Η σύνδεση Google δεν ολοκληρώθηκε. Δοκίμασε ξανά.');
    } finally {
      login.disabled = false;
    }
  });
  logout.addEventListener('click', async () => {
    try { await signOut(auth); }
    catch { show('Η αποσύνδεση δεν ολοκληρώθηκε. Δοκίμασε ξανά.'); }
  });
  retry.addEventListener('click', () => watch(auth.currentUser));
  download.addEventListener('click', () => {
    const current = session;
    if (!current?.remote || current.busy || !confirm('Να φορτωθούν οι κοινές καταχωρίσεις στη συσκευή;')) return;
    try {
      backup(read());
      apply(current.remote);
      remember(current, current.remote);
      reconcile();
    } catch { show('Η λήψη δεν ολοκληρώθηκε.', {retry:true}); }
  });
  upload.addEventListener('click', () => {
    const current = session;
    if (!current?.remote || current.busy || !confirm('Να αντικατασταθούν οι κοινές καταχωρίσεις με αυτές της συσκευής;')) return;
    try {
      backup(current.remote);
      void write(current, current.remote, read());
    } catch { show('Η αποστολή δεν ολοκληρώθηκε.', {retry:true}); }
  });
  window.addEventListener('online', () => watch(auth.currentUser));
  window.addEventListener('offline', reconcile);
  onAuthStateChanged(auth, watch);
  return () => queueMicrotask(reconcile);
}
