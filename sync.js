/* Fence E-COC – SYNC BETWEEN PHONE AND PC
   Works like the Training Scheduler: every device uses the same PRIVATE GitHub
   repository (and an access token) as a shared cloud copy.
     fence-e-coc/settings.json        numbers used, next number, default details, logos
     fence-e-coc/cocs/<id>.json       one file per certificate, with all its test reports
   Only files that changed are sent or fetched, so it stays quick on mobile data.
   Merging: the newest change of each certificate and of each test report wins;
   test reports added on different devices are all kept; deletions are carried across. */
'use strict';

const SYNC_DIR = 'fence-e-coc/';
const GH_API = window.GH_API_OVERRIDE || 'https://api.github.com';
let SC = {};                       // sync settings for THIS device: { repo, token, branch, last }
let syncBusy = false, syncAgain = false, syncMsg = '', syncTimer = null, syncPromise = null;

async function loadSyncCfg() { SC = (await DB.getKV('syncCfg')) || {}; }
const syncOn = () => !!(SC.repo && SC.token);
async function setSyncCfg(o) { Object.assign(SC, o); await DB.setKV('syncCfg', SC); showSyncStatus(); }
function syncStatusText() {
  if (!syncOn()) return 'Sync is off';
  if (syncBusy) return 'Syncing…';
  if (syncMsg) return syncMsg;
  return SC.last ? 'Synced ' + new Date(SC.last).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Not synced yet';
}
function showSyncStatus() { document.querySelectorAll('.syncst').forEach(e => { e.textContent = syncStatusText(); e.classList.toggle('bad', /failed/i.test(syncMsg)); }); }

/* ---- small helpers */
function hashStr(s) {                      // two 32-bit hashes + length – enough to spot a change
  let a = 0x811c9dc5, b = 5381;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = Math.imul(a ^ c, 16777619); b = (Math.imul(b, 33) + c) | 0; }
  return s.length + ':' + (a >>> 0).toString(36) + ':' + (b >>> 0).toString(36);
}
const hashOf = o => hashStr(JSON.stringify(o));
const b64FromText = s => b64FromBytes(new TextEncoder().encode(s));
function textFromB64(s) { const b = atob(String(s).replace(/\s/g, '')); const a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return new TextDecoder().decode(a); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---- GitHub API. The Android app uses the phone's own connection (CapacitorHttp). */
async function gh(method, path, body) {
  const url = GH_API + path;
  const headers = { Authorization: 'Bearer ' + SC.token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  if (body) headers['Content-Type'] = 'application/json';
  const CH = isCap() && window.Capacitor.Plugins.CapacitorHttp;
  if (CH) {
    const r = await CH.request({ url, method, headers, data: body || undefined, connectTimeout: 20000, readTimeout: 60000 });
    let j = r.data; if (typeof j === 'string') { try { j = JSON.parse(j); } catch { j = null; } }
    return { status: r.status, json: j };
  }
  const r = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  return { status: r.status, json: await r.json().catch(() => null) };
}
function ghFail(r) {
  if (r.status === 401) return new Error('GitHub refused the token – check it or make a new one');
  if (r.status === 403) return new Error('the token has no permission for this repository (needs Contents: Read and write)');
  if (r.status === 404) return new Error('repository not found, or the token has no access to it');
  return new Error('GitHub error ' + r.status + (r.json && r.json.message ? ' – ' + r.json.message : ''));
}
async function ghTree() {
  if (!SC.branch) {
    const r = await gh('GET', '/repos/' + SC.repo);
    if (r.status !== 200) throw ghFail(r);
    if (r.json && r.json.private === false) syncMsg = 'Warning: the sync repository is PUBLIC – make it private';
    await setSyncCfg({ branch: (r.json && r.json.default_branch) || 'main' });
  }
  const r = await gh('GET', '/repos/' + SC.repo + '/git/trees/' + encodeURIComponent(SC.branch) + '?recursive=1');
  if (r.status === 409 || r.status === 404) return {};          // empty repository – nothing synced yet
  if (r.status !== 200) throw ghFail(r);
  const m = {};
  for (const t of (r.json && r.json.tree) || []) if (t.type === 'blob' && t.path.startsWith(SYNC_DIR)) m[t.path] = t.sha;
  return m;
}
async function ghGet(sha) {
  const r = await gh('GET', '/repos/' + SC.repo + '/git/blobs/' + sha);
  if (r.status !== 200) throw ghFail(r);
  return JSON.parse(textFromB64(r.json.content));
}
async function ghPut(path, obj, sha) {
  const body = { message: 'sync ' + path.split('/').pop(), content: b64FromText(JSON.stringify(obj)) };
  if (sha) body.sha = sha;
  const r = await gh('PUT', '/repos/' + SC.repo + '/contents/' + path, body);
  if (r.status === 409 || r.status === 422) return { conflict: true };   // changed by the other device meanwhile – try again
  if (r.status !== 200 && r.status !== 201) throw ghFail(r);
  return { sha: r.json.content.sha };
}

/* ---- merging */
const recTime = r => (r && (r.updated || r.created)) || 0;
const trTime = t => t.updated || t.created || 0;
const dataTime = r => r.dataUpdated || r.updated || r.created || 0;   // when the COC form itself was last saved
function mergeRec(a, b) {
  if (!a) return b; if (!b) return a;
  const newer = recTime(b) > recTime(a) ? b : a, older = newer === a ? b : a;
  if (newer.deleted) return newer;                       // deleted after the last edit on the other device
  const o = clone(newer); delete o.deleted;
  // the certificate's own details and its test reports are merged separately, so an edit of a
  // test report on one device never undoes an edit of the COC details on the other
  const dn = older.deleted ? newer : (dataTime(b) > dataTime(a) ? b : a);
  o.data = clone(dn.data); o.dataUpdated = dataTime(dn);
  if (o.certNo === null || o.certNo === undefined) o.certNo = older.deleted ? o.certNo : (older.certNo ?? null);
  const del = {};
  for (const d of [older.delTrs || {}, newer.delTrs || {}]) for (const [k, v] of Object.entries(d)) del[k] = Math.max(del[k] || 0, v);
  const m = new Map();
  for (const t of [...(older.trs || []), ...(newer.trs || [])]) { const x = m.get(t.id); if (!x || trTime(t) >= trTime(x)) m.set(t.id, t); }
  o.trs = [...m.values()].filter(t => !(del[t.id] >= trTime(t))).sort((x, y) => (x.created || 0) - (y.created || 0) || String(x.id).localeCompare(String(y.id)));
  o.delTrs = del;
  o.updated = Math.max(recTime(a), recTime(b));
  return o;
}
const SHARED_KEYS = ['used', 'nextNo', 'defaults', 'logoCoc', 'logoTr', 'printRef', 'updated'];
function sharedSettings() {
  const o = {}; for (const k of SHARED_KEYS) o[k] = S[k];
  o.used = [...new Set(S.used || [])].sort((x, y) => x - y); o.updated = S.updated || 0;
  return o;
}
function mergeSettings(a, b) {
  const o = clone((b.updated || 0) > (a.updated || 0) ? b : a);
  o.used = [...new Set([...(a.used || []), ...(b.used || [])])].sort((x, y) => x - y);
  o.nextNo = Math.max(Number(a.nextNo) || 1, Number(b.nextNo) || 1);
  o.updated = Math.max(a.updated || 0, b.updated || 0);
  return o;
}
async function applySettings(M) { for (const k of SHARED_KEYS) if (M[k] !== undefined) S[k] = M[k]; await saveSettings(true); }

/* Save a certificate on this device, merged with what is already stored
   (so test reports that just arrived from the other device are never lost). */
async function saveRec(rec) {
  rec.updated = Date.now();
  const cur = await DB.getRaw(rec.id);
  if (cur && !cur.deleted) {
    const m = mergeRec(cur, rec);
    rec.trs = m.trs; rec.delTrs = m.delTrs; rec.data = m.data; rec.dataUpdated = m.dataUpdated;
    if (rec.certNo === null || rec.certNo === undefined) rec.certNo = m.certNo;
  }
  await DB.put(rec);
  scheduleSync();
}
async function deleteRec(rec) {
  await DB.put({ id: rec.id, certNo: rec.certNo, deleted: true, updated: Date.now(), created: rec.created, data: {}, trs: [] });
  scheduleSync();
}

/* ---- one file: compare this device, the cloud and what was last synced */
async function syncItem(path, L, merge, apply, files, tree) {
  const rs = tree[path], s = files[path], lh = L ? hashOf(L) : null;
  if (rs && (!s || s.sha !== rs)) {                                   // the cloud copy is new to this device
    const R = await ghGet(rs);
    const M = L ? merge(L, R) : R, mh = hashOf(M);
    let changed = false;
    if (mh !== lh) { await apply(M); changed = true; }
    if (mh !== hashOf(R)) {                                           // this device had changes too – send the merged copy
      const p = await ghPut(path, M, rs);
      if (p.conflict) { syncAgain = true; return changed; }
      files[path] = { sha: p.sha, hash: mh };
    } else files[path] = { sha: rs, hash: mh };
    return changed;
  }
  if (L && (!rs || !s || s.hash !== lh)) {                            // only this device changed – send it
    const p = await ghPut(path, L, rs);
    if (p.conflict) { syncAgain = true; return false; }
    files[path] = { sha: p.sha, hash: lh };
  } else if (!L && rs) {                                              // missing here (e.g. after a restore) – fetch it
    const R = await ghGet(rs); await apply(R); files[path] = { sha: rs, hash: hashOf(R) }; return true;
  }
  return false;
}

async function syncNow(manual) {
  if (!syncOn()) { if (manual) toast('Set up sync in Settings first'); return false; }
  if (!navigator.onLine) { syncMsg = 'Offline – will sync when back online'; showSyncStatus(); if (manual) toast(syncMsg); return false; }
  if (syncBusy) { syncAgain = true; return syncPromise; }
  syncBusy = true; syncMsg = ''; showSyncStatus();
  syncPromise = (async () => {
    let changed = false;
    try {
      const tree = await ghTree();
      const st = (await DB.getKV('syncState')) || {};
      if (st.repo !== SC.repo) { st.repo = SC.repo; st.files = {}; }
      const files = st.files;
      changed = await syncItem(SYNC_DIR + 'settings.json', sharedSettings(), mergeSettings, applySettings, files, tree) || changed;
      const local = new Map((await DB.allRaw()).map(r => [r.id, r]));
      const ids = new Set(local.keys());
      for (const p of Object.keys(tree)) { const m = p.match(/^fence-e-coc\/cocs\/(.+)\.json$/); if (m) ids.add(m[1]); }
      let n = 0;
      for (const id of ids) {
        changed = await syncItem(SYNC_DIR + 'cocs/' + id + '.json', local.get(id) || null, mergeRec, M => DB.put(M), files, tree) || changed;
        if (++n % 10 === 0) await DB.setKV('syncState', st);
      }
      await DB.setKV('syncState', st);
      // every number used on any device is marked as used here too
      const all = await DB.allRaw(), used = new Set(S.used);
      const missing = all.map(r => r.certNo).filter(c => c && !used.has(c));
      if (missing.length) { S.used = [...used, ...missing]; await saveSettings(); syncAgain = true; }
      SC.last = Date.now(); await setSyncCfg({ last: SC.last });
      if (!/PUBLIC/.test(syncMsg)) syncMsg = '';
      if (manual) toast(changed ? 'Synced – updated from your other device' : 'Synced – everything is up to date');
    } catch (e) {
      console.warn(e);
      syncMsg = 'Sync failed: ' + (e.message || e) + (navigator.onLine ? '' : ' (offline)');
      if (manual) alert(syncMsg);
    } finally {
      syncBusy = false; showSyncStatus();
      if (syncAgain) { syncAgain = false; scheduleSync(2500); }
    }
    if (changed) onSyncChanged();
    return changed;
  })();
  return syncPromise;
}
function scheduleSync(ms = 3000) { if (!syncOn()) return; clearTimeout(syncTimer); syncTimer = setTimeout(() => syncNow(false), ms); }
/* Before a new certificate takes its number, fetch the numbers the other device used (max 8 s) */
async function syncBeforeNumber() {
  if (!syncOn() || !navigator.onLine) return;
  try { await Promise.race([syncNow(false), sleep(8000)]); } catch { }
}
/* Show what arrived from the other device – but never while you are typing */
async function onSyncChanged() {
  if (dirty || !$('#modal').classList.contains('hidden')) { toast('Updated from your other device'); return; }
  const y = window.scrollY; await route(history.state, true); window.scrollTo(0, y);
}
function startAutoSync() {
  if (syncOn()) scheduleSync(1500);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleSync(800); });
  window.addEventListener('online', () => scheduleSync(800));
  setInterval(() => { if (!document.hidden) syncNow(false); }, 5 * 60 * 1000);
}

/* ---- Settings card */
function syncSettingsCard() {
  const repo = el('input', { type: 'text', placeholder: 'owner/repository  e.g. m9r1u5/Fence-e-COC-data', autocapitalize: 'off', autocomplete: 'off', spellcheck: 'false' }); repo.value = SC.repo || '';
  const tok = el('input', { type: 'password', placeholder: 'Access token (starts with github_pat_)', autocomplete: 'off' }); tok.value = SC.token || '';
  return el('fieldset', {}, el('legend', {}, 'Sync between phone and PC'),
    el('p', { class: 'note' }, 'Keeps your certificates, test reports, certificate numbers, default details and logos the same on every phone and PC. It uses a PRIVATE GitHub repository that only you can see. Put the same repository and token on each device. Syncing happens by itself a few seconds after you save, when you open the app and every 5 minutes; without internet everything still works and syncs later.'),
    el('div', { class: 'f' }, el('label', {}, 'Private sync repository'), repo),
    el('div', { class: 'f' }, el('label', {}, 'Access token'), tok),
    el('p', { class: 'note' }, 'Status: ', el('b', { class: 'syncst' }, syncStatusText())),
    el('div', { class: 'row' },
      el('button', { class: 'btn primary', onclick: async () => {
        const r = repo.value.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').replace(/\/+$/, ''), t = tok.value.trim();
        if (!/^[\w.-]+\/[\w.-]+$/.test(r)) return toast('Enter the repository as owner/name');
        if (!t) return toast('Paste the access token');
        if (r.toLowerCase() === GITHUB_REPO.toLowerCase()) return toast('Use a separate PRIVATE repository for your data, not the app repository');
        await setSyncCfg({ repo: r, token: t, branch: r === SC.repo ? SC.branch : '', last: r === SC.repo ? SC.last : 0 });
        repo.value = r; syncNow(true);
      } }, '💾 Save & sync now'),
      el('button', { class: 'btn', onclick: () => syncNow(true) }, '↻ Sync now'),
      syncOn() ? el('button', { class: 'btn danger', onclick: async () => {
        if (!confirm('Stop syncing on this device?\nThe certificates stay on this device and in the cloud copy.')) return;
        SC = {}; await DB.setKV('syncCfg', SC); await DB.delKV('syncState'); toast('Sync turned off'); settingsView();
      } }, 'Turn off') : null),
    el('details', { class: 'howto' }, el('summary', {}, 'How to set it up (once)'),
      el('ol', { class: 'steps' },
        el('li', {}, 'On github.com tap ＋ → New repository. Name it e.g. Fence-e-COC-data, choose Private, then Create repository.'),
        el('li', {}, 'Tap your profile picture → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token.'),
        el('li', {}, 'Name: Fence E-COC sync. Expiration: the longest offered. Repository access: Only select repositories → Fence-e-COC-data.'),
        el('li', {}, 'Permissions → Repository permissions → Contents → Read and write. Tap Generate token and copy it.'),
        el('li', {}, 'In Fence E-COC on every phone and PC: Settings → enter m9r1u5/Fence-e-COC-data and paste the token → Save & sync now.')),
      el('p', { class: 'note' }, 'If both devices already have certificates, they are combined – nothing is deleted. Keep the token private: anyone who has it can read your certificate data. When the token expires, make a new one and paste it in on each device. Your own uploaded blank-form templates and your acceptance of the Terms stay on each device.')));
}
/* Two certificates with the same number can only happen if both devices issued one while offline */
function duplicateNumbers(recs) {
  const m = new Map();
  for (const r of recs) if (r.certNo) m.set(r.certNo, (m.get(r.certNo) || 0) + 1);
  return [...m.entries()].filter(([, c]) => c > 1).map(([n]) => n);
}
