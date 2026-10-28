/* Fence E-COC – Electric Fence System Certificates of Compliance & Inspection/Test Reports (SANS 10222-3)
   All data stays on this device (IndexedDB). Field positions live in config.js. */
'use strict';

/* ------------------------------------------------------------------ helpers */
const $ = (s, e = document) => e.querySelector(s);
function el(tag, props, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) { if (k === null || k === undefined || k === false) continue; e.append(k.nodeType ? k : document.createTextNode(k)); }
  return e;
}
const padN = n => (n === null || n === undefined || n === '') ? '' : String(n).padStart(NUMBER_DIGITS, '0');
const numLabel = n => NUMBER_PREFIX + ' ' + padN(n);
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const clone = o => JSON.parse(JSON.stringify(o || {}));
const isCap = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const isWindowsPC = () => /windows/i.test(navigator.userAgent) || /^win/i.test(navigator.platform || '');
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const CACHE_PREFIX = 'fence-ecoc-';
let toastTimer;
function toast(msg, ms = 2600) { const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hidden'), ms); }
function fmtDate(v) {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return v || '';
  const [y, m, d] = v.split('-');
  return PDF_STYLE.dateFormat.replace('YYYY', y).replace('MM', m).replace('DD', d);
}
function b64FromBytes(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); }
function bytesFromDataURL(u) { const b = atob(u.split(',')[1]); const a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
const readAsDataURL = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
const readAsText = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsText(f); });
function pickFile(accept, capture) { return new Promise(res => { const i = el('input', { type: 'file', accept, capture }); i.onchange = () => res(i.files[0] || null); i.click(); }); }
const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

/* --------------------------------------------------------------- database */
const DB = {
  db: null,
  open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('fence-ecoc', 1);
      r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('cocs', { keyPath: 'id' }); d.createObjectStore('kv'); };
      r.onsuccess = () => { this.db = r.result; res(); };
      r.onerror = () => rej(r.error);
    });
  },
  tx(store, mode, fn) {
    return new Promise((res, rej) => {
      const t = this.db.transaction(store, mode); const req = fn(t.objectStore(store));
      t.oncomplete = () => res(req ? req.result : undefined); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    });
  },
  async allRaw() { return ((await this.tx('cocs', 'readonly', s => s.getAll())) || []).map(normRec); },   // includes deleted ones (kept so the delete syncs)
  async all() { return (await this.allRaw()).filter(r => !r.deleted); },
  async getRaw(id) { const r = await this.tx('cocs', 'readonly', s => s.get(id)); return r ? normRec(r) : r; },
  async get(id) { const r = await this.getRaw(id); return r && !r.deleted ? r : undefined; },
  put(r) { return this.tx('cocs', 'readwrite', s => s.put(r)); },
  del(id) { return this.tx('cocs', 'readwrite', s => s.delete(id)); },
  clearCocs() { return this.tx('cocs', 'readwrite', s => s.clear()); },
  getKV(k) { return this.tx('kv', 'readonly', s => s.get(k)); },
  setKV(k, v) { return this.tx('kv', 'readwrite', s => s.put(v, k)); },
  delKV(k) { return this.tx('kv', 'readwrite', s => s.delete(k)); },
};
/* A COC holds any number of test reports in rec.trs = [{ id, data, created, updated }] */
function normRec(r) { if (!Array.isArray(r.trs)) r.trs = []; return r; }
let S = null; // settings
const DEFAULT_SETTINGS = { nextNo: 1, used: [], defaults: {}, logoCoc: '', logoTr: '', printRef: true };
async function loadSettings() { S = Object.assign(clone(DEFAULT_SETTINGS), (await DB.getKV('settings')) || {}); }
function saveSettings(fromSync) { if (!fromSync) { S.updated = Date.now(); scheduleSync(); } return DB.setKV('settings', S); }
function previewNumber() { const used = new Set(S.used); let n = Number(S.nextNo) || 1; while (used.has(n)) n++; return n; }
async function allocateNumber() {
  const n = previewNumber();
  if (n > 99999) throw new Error('Certificate number above 99999 – change the start number in Settings');
  S.used.push(n); S.nextNo = n + 1; await saveSettings(); return n;
}

/* ------------------------------------------------------------ form schemas */
const T = (id, label, t = 'text', x = {}) => Object.assign({ id, label, t }, x);
const CH = (id, label, opts, x = {}) => Object.assign({ id, label, t: 'choice', opts }, x);
const NOTE = text => ({ t: 'note', text });
const YN = [['yes', 'Yes'], ['no', 'No']];

const COC_SCHEMA = [
  { title: 'Certificate', items: [
    CH('certType', 'Certificate type (tick appropriate block)', [['initial', 'Initial Certificate'], ['supplementary', 'Supplementary Certificate']]),
    T('supplementNo', 'Supplement No.'), T('initialCertNo', 'to initial Certificate No.'), T('issuedOn', 'as issued on', 'date')] },
  { title: 'Identification of the relevant electrical installation', note: '(Address or other unique reference, where applicable)', items: [
    T('physicalAddress', 'Physical address'), T('district', 'District / Town / City'), T('gps', 'GPS Coordinates', 'gps'),
    T('buildingName', 'Name of building / premises'), T('erfNo', 'Erf / Lot No'), T('suburb', 'Suburb / Township'), T('poleNo', 'Pole number')] },
  { title: 'Declaration by registered electrical fence installer', items: [
    T('rpName', 'I, (full name)'), T('rpId', 'ID no.'),
    NOTE('a registered electric fence system installer, declare that I have personally carried out the inspection and testing of the electric fence system installation described above as per the requirements of regulation 13(1), and deem the installation to be reasonably safe when properly used.'),
    T('rpRegNo', 'Registered person registration number'), T('rpRegDate', 'Date of registration', 'date'),
    T('rpSig', 'Signature', 'sig'), T('rpSigDate', 'Date', 'date')] },
  { title: 'Declaration by user or lessor', note: 'I declare that I am aware of my responsibilities in terms of regulation 12 of the Electrical Machinery Regulations and undertake to operate and maintain the electric fence system in a safe manner.', items: [
    T('recipientName', 'Recipient name'), T('recipientSig', 'Signature', 'sig'), T('recipientDate', 'Date', 'date')] },
];
const DEFAULT_KEYS = ['rpName', 'rpId', 'rpRegNo', 'rpRegDate', 'rpSig'];

const INSP = [
  'Are all components correctly selected?',
  'Are all bordering public areas protected from the electric fence?',
  'Components have been correctly installed',
  'Are all electric fencing live and electric fencing earth conductors properly bonded, mechanically sound and electrically continuous?',
  'Are all brackets, off-set brackets or poles (or both) properly installed and mechanically sound?',
  'The installation complies with its requirements, as specified in this certificate, as contained in SANS 10222-3 (fundamental requirements, earthing, lightning protection, corrosion protection, protection of communication lines against interference, installation requirements between overhead power conductors and electric fences and any other applicable section of SANS 10222-3)',
  'The installation complies with the general safety principles of SANS 10222-3 (additional working paper can be added)'];
const MAP_NEEDS = ['a) the position of the Electric Fence Energizer', 'b) the Power Point supplying power to the Energizer', 'c) lightning protection', 'd) HT Cable', 'e) Earth spikes',
  'f) the number of fence poles as well as the number of lines', 'g) the length of the building element on which the poles are installed', 'h) the position of the Keypad and warning devices (siren and strobe)', 'i) the position of the signal cable, Keypad and warning device'];

const TR_SCHEMA = [
  { title: 'Test report', items: [
    T('trFor', 'Zone / energizer name (for your list – printed only on the small reference line)')] },
  { title: '1 Tests', items: [
    T('energizerMake', 'Energizer make', 'text', { def: 1 }), T('serialNo', 'S/N number'),
    T('peakKv', 'Peak high voltage reading at furthest point from energizer (kV)', 'num', { cls: 'test' }),
    T('testMeter', 'Model number, manufacturer and series number of test meter / oscilloscope used', 'text', { def: 1 }),
    CH('monitored', 'In the case of a monitored system, has the requirements of SANS 10222-3 been fully satisfied?', YN, { cls: 'test' })] },
  { title: '1.1 Fence type (tick what is applicable)', items: [
    { t: 'multi', opts: [['ftSecurity', 'Security electric fence'], ['ftGame', 'Game electric fence'], ['ftAgri', 'General agriculture electric fence']] }] },
  { title: '2 Inspection (circle the correct one)', items: INSP.map((l, i) => CH('insp' + (i + 1), '2.' + (i + 1) + ' ' + l, YN, { cls: 'test' })) },
  { title: 'Comments', items: [T('comments', 'Comments on parts of electric fence not covered by this certificate', 'textarea')] },
  { title: '3 Site map', items: [
    { t: 'map', id: 'siteMap', label: 'Map drawing / site map' },
    NOTE('A complete site map shall show: ' + MAP_NEEDS.join('; ') + '. A map may be a rough drawing if a site drawing is not available. All measurements shall be indicated on the map.')] },
];
const TR_DEFAULT_KEYS = ['energizerMake', 'testMeter'];
const TR_CHANGES_PER_COPY = ['trFor', 'serialNo', 'peakKv', 'siteMap', 'siteMapOps', 'siteMapBg'];   // cleared when copying a report

/* ------------------------------------------------------------ form renderer */
function renderItem(it, data, opt) {
  const changed = () => opt.onChange && opt.onChange();
  if (it.t === 'note') return el('p', { class: 'note' }, it.text);
  if (it.t === 'sub') return el('h4', { style: 'margin:14px 0 2px' }, it.text);
  const imp = it.def && opt.fromDefaults && opt.fromDefaults.includes(it.id) && data[it.id];
  const w = el('div', { class: 'f ' + (imp ? 'imported ' : '') + (it.cls || '') });
  const lab = it.label ? el('label', {}, it.label, imp ? el('span', { class: 'imp' }, '· saved default') : null) : null;
  if (it.t === 'choice') {
    const box = el('div', { class: 'chips' });
    const draw = () => { box.replaceChildren(...it.opts.map(([k, l]) => el('button', { type: 'button', class: 'chip' + (data[it.id] === k ? ' on' : ''), onclick: () => { data[it.id] = data[it.id] === k ? '' : k; draw(); changed(); } }, l))); };
    draw(); w.append(lab || '', box); return w;
  }
  if (it.t === 'multi') {
    const box = el('div', { class: 'chips' });
    const draw = () => { box.replaceChildren(...it.opts.map(([k, l]) => el('button', { type: 'button', class: 'chip' + (data[k] === 'yes' ? ' on' : ''), onclick: () => { data[k] = data[k] === 'yes' ? '' : 'yes'; draw(); changed(); } }, l))); };
    draw(); w.append(box); return w;
  }
  if (it.t === 'sig') { w.append(lab, sigWidget(it, data, opt, changed)); return w; }
  if (it.t === 'map') { w.append(lab, mapWidget(it, data, changed)); return w; }
  let inp;
  if (it.t === 'textarea') inp = el('textarea', { rows: 3 });
  else inp = el('input', { type: { date: 'date', tel: 'tel', email: 'email' }[it.t] || 'text', inputmode: it.t === 'num' ? 'decimal' : null, autocomplete: 'off' });
  inp.value = data[it.id] || '';
  inp.addEventListener('input', () => { data[it.id] = inp.value; changed(); });
  if (it.t === 'gps') {
    const b = el('button', { type: 'button', class: 'btn small' }, '📍 Get');
    b.onclick = () => {
      if (!navigator.geolocation) return toast('GPS not available');
      toast('Getting location…');
      navigator.geolocation.getCurrentPosition(p => { inp.value = p.coords.latitude.toFixed(6) + ', ' + p.coords.longitude.toFixed(6); data[it.id] = inp.value; changed(); toast('Location added'); },
        e => toast('Could not get location: ' + e.message), { enableHighAccuracy: true, timeout: 20000 });
    };
    w.append(lab, el('div', { class: 'with-btn' }, inp, b));
  } else w.append(lab, inp);
  return w;
}
function renderSchema(schema, data, opt, filter) {
  return schema.map(sec => {
    const items = sec.items.filter(i => !filter || (i.id && filter.includes(i.id)));
    if (!items.length) return null;
    return el('fieldset', {}, el('legend', {}, sec.title), filter ? null : (sec.note ? el('p', { class: 'note' }, sec.note) : null), items.map(i => renderItem(i, data, opt)));
  }).filter(Boolean);
}

/* ---------------------------------------------------------------- signature */
function sigWidget(it, data, opt, changed) {
  const box = el('div', { class: 'sigbox' });
  const show = () => box.replaceChildren(data[it.id] ? el('img', { src: data[it.id], alt: 'signature' }) : el('span', { class: 'ph' }, 'Not signed'));
  show();
  const def = opt.defaults && opt.defaults[it.id];
  return el('div', {}, box, el('div', { class: 'row', style: 'margin-top:6px' },
    el('button', { type: 'button', class: 'btn small paper', onclick: () => openSigPad(u => { data[it.id] = u; show(); changed(); }) }, '✍ Sign'),
    def ? el('button', { type: 'button', class: 'btn small', onclick: () => { data[it.id] = def; show(); changed(); } }, 'Use saved') : null,
    el('button', { type: 'button', class: 'btn small danger', onclick: () => { data[it.id] = ''; show(); changed(); } }, 'Clear')));
}
function openSigPad(onSave) {
  const c = el('canvas', { class: 'sigpad' });
  let has = false;
  const clear = () => { const x = c.getContext('2d'); x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, c.width, c.height); x.restore(); has = false; };
  openModal(el('div', {},
    el('h3', {}, 'Sign below'), el('p', { class: 'note' }, 'Use your finger or a stylus. Turn the phone sideways for more space.'), c,
    el('div', { class: 'row', style: 'margin-top:10px' },
      el('button', { class: 'btn', onclick: clear }, 'Clear'),
      el('button', { class: 'btn', onclick: closeModal }, 'Cancel'),
      el('button', { class: 'btn primary', onclick: () => { if (!has) return toast('Please sign first'); onSave(trimCanvas(c)); closeModal(); } }, 'Save'))), true);
  const dpr = Math.max(window.devicePixelRatio || 1, 2);
  const r = c.getBoundingClientRect(); c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr);
  const ctx = c.getContext('2d'); ctx.scale(dpr, dpr); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0b1a6e'; ctx.fillStyle = '#0b1a6e'; ctx.lineWidth = 2.6;
  let drawing = false, last = null;
  const pos = e => { const b = c.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
  c.addEventListener('pointerdown', e => { e.preventDefault(); c.setPointerCapture(e.pointerId); drawing = true; last = pos(e); ctx.beginPath(); ctx.arc(last.x, last.y, 1.3, 0, 7); ctx.fill(); has = true; });
  c.addEventListener('pointermove', e => {
    if (!drawing) return; e.preventDefault();
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of evs) { const p = pos(ev); ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last = p; }
  });
  const end = () => { drawing = false; };
  c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end);
}
function trimCanvas(c) {
  const ctx = c.getContext('2d'), { width: w, height: h } = c, d = ctx.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < x0) return c.toDataURL('image/png');
  const p = 6; x0 = Math.max(0, x0 - p); y0 = Math.max(0, y0 - p); x1 = Math.min(w - 1, x1 + p); y1 = Math.min(h - 1, y1 + p);
  const o = document.createElement('canvas'); o.width = x1 - x0 + 1; o.height = y1 - y0 + 1;
  o.getContext('2d').drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
  return o.toDataURL('image/png');
}

/* ---------------------------------------------------------------- site map
   Drawn as a list of strokes (so it can be edited again later) in coordinates
   0..1 across the map area. data.siteMapOps = strokes, data.siteMapBg = optional
   photo/scan underneath, data.siteMap = finished picture printed on the PDF. */
const MAP_BOX = PDF_FIELDS.tr.siteMap;
const MAP_RATIO = MAP_BOX.w / MAP_BOX.h;
/* Your legend sits at the top of the same square, above the drawing area (site-map-legend.png = the printed legend band) */
const LEGEND_SRC = 'site-map-legend.png';
const LEGEND_RATIO = 2960 / 313;
const legendImg = () => el('img', { class: 'leg', src: LEGEND_SRC, alt: 'Legend: earth spikes, warning signs, fence wires, dual lightning protector below the energizer, tubing brackets, lines' });
const MAP_COLORS = [['#111111', 'Black'], ['#c62828', 'Red'], ['#1565c0', 'Blue'], ['#2e7d32', 'Green']];
async function paintMap(ctx, W, H, ops, bg, withGrid) {
  ctx.clearRect(0, 0, W, H);
  if (bg) {
    const img = await loadImg(bg);
    const k = Math.min(W / img.width, H / img.height), w = img.width * k, h = img.height * k;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
  }
  if (withGrid && !bg) {
    const step = W * (14.17 / MAP_BOX.w);
    ctx.save(); ctx.strokeStyle = '#c9d3c9'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]); ctx.beginPath();
    for (let x = step; x < W; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = step; y < H; y += step) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke(); ctx.restore();
  }
  // strokes go on their own layer so the eraser never removes the photo underneath
  const layer = document.createElement('canvas'); layer.width = W; layer.height = H;
  const c = layer.getContext('2d'); c.lineCap = 'round'; c.lineJoin = 'round';
  for (const op of ops || []) {
    c.globalCompositeOperation = op.t === 'erase' ? 'destination-out' : 'source-over';
    c.strokeStyle = c.fillStyle = op.c || '#111';
    if (op.t === 'text') {
      const size = op.s * W; c.font = `bold ${size}px Helvetica, Arial, sans-serif`; c.textBaseline = 'middle';
      c.fillText(op.text, op.x * W, op.y * H); continue;
    }
    c.lineWidth = op.w * W;
    const p = op.p; if (!p || !p.length) continue;
    c.beginPath(); c.moveTo(p[0][0] * W, p[0][1] * H);
    if (p.length === 1) { c.arc(p[0][0] * W, p[0][1] * H, c.lineWidth / 2, 0, 7); c.fill(); continue; }
    for (let i = 1; i < p.length; i++) c.lineTo(p[i][0] * W, p[i][1] * H);
    c.stroke();
  }
  ctx.drawImage(layer, 0, 0);
}
function mapWidget(it, data, changed) {
  const area = el('div', { class: 'area', style: 'aspect-ratio:' + MAP_RATIO });
  const box = el('div', { class: 'mapsq' }, legendImg(), area);
  const show = () => area.replaceChildren(data.siteMap ? el('img', { src: data.siteMap, alt: 'site map' }) : el('span', { class: 'ph' }, 'Draw here, or leave blank and draw by hand after printing'));
  show();
  return el('div', {}, box, el('div', { class: 'row', style: 'margin-top:6px' },
    el('button', { type: 'button', class: 'btn small paper', onclick: () => openMapEditor(data, () => { show(); changed(); }) }, data.siteMap ? '✏ Edit site map' : '✏ Draw site map'),
    el('button', { type: 'button', class: 'btn small', onclick: async () => {
      const f = await pickFile('image/*'); if (!f) return;
      data.siteMapBg = await shrinkImage(await readAsDataURL(f), 2000); data.siteMapOps = data.siteMapOps || [];
      data.siteMap = await exportMap(data.siteMapOps, data.siteMapBg); show(); changed(); toast('Photo added – tap Edit to draw on it');
    } }, '📷 Use photo / scan'),
    data.siteMap ? el('button', { type: 'button', class: 'btn small danger', onclick: () => { if (!confirm('Remove the site map?')) return; data.siteMap = ''; data.siteMapOps = []; data.siteMapBg = ''; show(); changed(); } }, 'Remove') : null));
}
async function shrinkImage(src, max) {
  const img = await loadImg(src); const k = Math.min(1, max / Math.max(img.width, img.height));
  const c = el('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.85);
}
async function exportMap(ops, bg) {
  if (!(ops && ops.length) && !bg) return '';
  const W = 1800, H = Math.round(W / MAP_RATIO), c = el('canvas'); c.width = W; c.height = H;
  await paintMap(c.getContext('2d'), W, H, ops, bg, false);
  return bg ? c.toDataURL('image/jpeg', 0.85) : c.toDataURL('image/png');
}
function openMapEditor(data, onDone) {
  const ops = clone(data.siteMapOps || []);
  let bg = data.siteMapBg || '';
  let tool = 'pen', color = MAP_COLORS[0][0], size = 'm';
  const SIZES = { s: 0.0022, m: 0.0042, l: 0.008 };
  const c = el('canvas', { class: 'mapcanvas' });
  const frame = el('div', { class: 'mapsq' }, legendImg(), c);
  const wrap = el('div', { class: 'mapwrap' }, frame);
  const bar = el('div', { class: 'maptools' });
  const redraw = async () => { await paintMap(c.getContext('2d'), c.width, c.height, ops, bg, true); };
  const drawBar = () => bar.replaceChildren(...[
    ...[['pen', '✏ Pen'], ['line', '╱ Line'], ['text', 'T Text'], ['erase', '⌫ Eraser']].map(([k, l]) =>
      el('button', { type: 'button', class: 'btn small' + (tool === k ? ' primary' : ''), onclick: () => { tool = k; drawBar(); } }, l)),
    ...MAP_COLORS.map(([k, l]) => el('button', { type: 'button', class: 'swatch' + (color === k ? ' on' : ''), title: l, style: 'background:' + k, onclick: () => { color = k; if (tool === 'erase') tool = 'pen'; drawBar(); } })),
    ...[['s', 'Thin'], ['m', 'Medium'], ['l', 'Thick']].map(([k, l]) => el('button', { type: 'button', class: 'btn small' + (size === k ? ' paper' : ''), onclick: () => { size = k; drawBar(); } }, l)),
    el('button', { type: 'button', class: 'btn small', onclick: () => { if (ops.length) { ops.pop(); redraw(); } } }, '↶ Undo'),
    el('button', { type: 'button', class: 'btn small', onclick: async () => { const f = await pickFile('image/*'); if (!f) return; bg = await shrinkImage(await readAsDataURL(f), 2000); redraw(); } }, '📷 Photo'),
    bg ? el('button', { type: 'button', class: 'btn small', onclick: () => { bg = ''; redraw(); } }, 'Remove photo') : null,
    el('button', { type: 'button', class: 'btn small danger', onclick: () => { if (ops.length && !confirm('Clear the whole drawing?')) return; ops.length = 0; redraw(); } }, 'Clear')].filter(Boolean));
  drawBar();
  openModal(el('div', { class: 'mapsheet' },
    el('h3', {}, 'Site map'),
    el('p', { class: 'note' }, 'Turn the phone sideways for a bigger map. Show the energizer, power point, lightning protection, HT cable, earth spikes, poles and lines, building lengths, keypad, siren/strobe and signal cable, with measurements (use Text).'),
    bar, wrap,
    el('div', { class: 'row', style: 'margin-top:10px' },
      el('button', { class: 'btn', onclick: closeModal }, 'Cancel'),
      el('button', { class: 'btn primary', onclick: async () => {
        data.siteMapOps = ops; data.siteMapBg = bg; data.siteMap = await exportMap(ops, bg);
        closeModal(); onDone(); toast('Site map saved – remember to Save the report');
      } }, 'Done'))), true);
  $('#modalSheet').classList.add('wide');
  const fit = () => {
    const maxW = wrap.clientWidth, maxH = Math.max(160, window.innerHeight * 0.62);
    const k = 1 / MAP_RATIO + 1 / LEGEND_RATIO;          // total height per unit width (legend + drawing area)
    let w = maxW - 4; if (w * k > maxH) w = maxH / k;
    const h = w / MAP_RATIO;
    frame.style.width = (w + 4) + 'px'; c.style.width = w + 'px'; c.style.height = h + 'px';
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5); c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); redraw();
  };
  fit();
  const onResize = () => { if (document.body.contains(c)) fit(); else window.removeEventListener('resize', onResize); };
  window.addEventListener('resize', onResize);
  let cur = null, start = null, snapshot = null;
  const pos = e => { const b = c.getBoundingClientRect(); return [Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)), Math.min(1, Math.max(0, (e.clientY - b.top) / b.height))]; };
  c.addEventListener('pointerdown', e => {
    e.preventDefault();
    const p = pos(e);
    if (tool === 'text') {
      const t = prompt('Text / measurement (e.g. "Energizer", "25 m", "Keypad")'); if (!t) return;
      ops.push({ t: 'text', x: p[0], y: p[1], s: { s: 0.016, m: 0.022, l: 0.03 }[size], c: color, text: t }); redraw(); return;
    }
    c.setPointerCapture(e.pointerId);
    cur = { t: tool === 'erase' ? 'erase' : 'pen', c: color, w: SIZES[size] * (tool === 'erase' ? 5 : 1), p: [p] };
    start = p; ops.push(cur);
    if (tool === 'line') { cur.p = [p, p]; }
    redraw();
  });
  c.addEventListener('pointermove', e => {
    if (!cur) return; e.preventDefault();
    if (tool === 'line') { cur.p = [start, pos(e)]; redraw(); return; }
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of evs) cur.p.push(pos(ev));
    redraw();
  });
  const end = () => { if (cur) { cur.p = cur.p.map(([x, y]) => [Math.round(x * 10000) / 10000, Math.round(y * 10000) / 10000]); } cur = null; };
  c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end);
}

/* -------------------------------------------------------------------- modal */
function openModal(content, sticky) {
  const m = $('#modal'); $('#modalSheet').className = 'sheet'; $('#modalSheet').replaceChildren(content); m.classList.remove('hidden');
  m.onclick = e => { if (e.target === m && !sticky) closeModal(); };
}
function closeModal() { $('#modal').classList.add('hidden'); $('#modalSheet').replaceChildren(); }

/* ---------------------------------------------------------------------- PDF */
async function getTemplate(kind) {
  const custom = await DB.getKV('tpl_' + kind);
  if (custom) return custom;
  const r = await fetch(kind === 'coc' ? 'coc-template.pdf' : 'test-report-template.pdf');
  if (!r.ok) throw new Error('Template file missing');
  return { type: 'pdf', bytes: new Uint8Array(await r.arrayBuffer()) };
}
async function makePdf(kind, data, opts = {}) {
  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  const tpl = await getTemplate(kind);
  let doc;
  if (tpl.type === 'pdf') doc = await PDFDocument.load(tpl.bytes || bytesFromDataURL(tpl.data), { ignoreEncryption: true });
  else {
    doc = await PDFDocument.create();
    const p = doc.addPage([595.28, 841.89]);
    const b = bytesFromDataURL(tpl.data);
    const img = /^data:image\/png/.test(tpl.data) ? await doc.embedPng(b) : await doc.embedJpg(b);
    p.drawImage(img, { x: 0, y: 0, width: 595.28, height: 841.89 });
  }
  const page = doc.getPage(0);
  const PW = page.getWidth(), PH = page.getHeight(), sx = PW / 595.28, sy = PH / 841.89;
  const off = PDF_OFFSET[kind] || { dx: 0, dy: 0 };
  const font = await doc.embedFont(StandardFonts.Helvetica), mono = await doc.embedFont(StandardFonts.CourierBold);
  const ink = rgb(...PDF_STYLE.textColor), red = rgb(...PDF_STYLE.numberColor), circ = rgb(...(PDF_STYLE.circleColor || PDF_STYLE.textColor)), guide = rgb(1, 0, 0);
  const X = x => (x + off.dx) * sx, Y = y => PH - (y + off.dy) * sy;
  const okChar = new Map();
  const clean = (f, s) => [...String(s).replace(/[\r\n\t]+/g, ' ').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-')]
    .filter(ch => { const k = f.name + ch; if (!okChar.has(k)) { try { f.encodeText(ch); okChar.set(k, true); } catch { okChar.set(k, false); } } return okChar.get(k); }).join('');
  const fit = (f, s, w, size) => {
    let sz = size; while (f.widthOfTextAtSize(s, sz) > w && sz > PDF_STYLE.minFontSize) sz -= 0.25;
    while (s.length && f.widthOfTextAtSize(s, sz) > w) s = s.slice(0, -1);
    return { s, sz };
  };
  const putText = (str, x, y, w, size, f, color, align) => {
    const t = fit(f, str, w, size), tw = f.widthOfTextAtSize(t.s, t.sz);
    page.drawText(t.s, { x: X(align === 'c' ? x + (w - tw) / 2 : x), y: Y(y), size: t.sz * sy, font: f, color });
  };
  const wrapText = (str, F) => {
    const words = str.split(' '); const maxLines = 1 + (F.wrap.lines || 1);
    for (let size = F.size; size >= PDF_STYLE.minFontSize; size -= 0.25) {
      const lines = []; let cur = '', li = 0;
      const width = i => i === 0 ? F.w : F.wrap.w;
      for (const wd of words) { const t = cur ? cur + ' ' + wd : wd; if (font.widthOfTextAtSize(t, size) <= width(li)) cur = t; else { lines.push(cur); li++; cur = wd; } }
      lines.push(cur);
      if (lines.length <= maxLines || size - 0.25 < PDF_STYLE.minFontSize) {
        lines.slice(0, maxLines).forEach((ln, i) => i === 0 ? putText(ln, F.x, F.y, F.w, size, font, ink) : putText(ln, F.wrap.x, F.y + F.wrap.gap * i, F.wrap.w, size, font, ink));
        return;
      }
    }
  };
  const drawImg = async (dataUrl, F, center) => {
    const b = bytesFromDataURL(dataUrl);
    const img = /^data:image\/png/.test(dataUrl) ? await doc.embedPng(b) : await doc.embedJpg(b);
    const k = Math.min(F.w / img.width, F.h / img.height), w = img.width * k, h = img.height * k;
    const x = center ? F.x + (F.w - w) / 2 : F.x, y = center ? F.y + (F.h - h) / 2 : F.y + F.h - h;
    page.drawImage(img, { x: X(x), y: Y(y + h), width: w * sx, height: h * sy });
  };
  const drawTick = b => {
    const s = b.s, t = Math.max(0.9, s * 0.15), L = (a, c, d, e) => page.drawLine({ start: { x: X(a), y: Y(c) }, end: { x: X(d), y: Y(e) }, thickness: t * sx, color: ink });
    if (PDF_STYLE.tickStyle === 'x') { L(b.x + s * .18, b.y + s * .18, b.x + s * .82, b.y + s * .82); L(b.x + s * .18, b.y + s * .82, b.x + s * .82, b.y + s * .18); }
    else { L(b.x + s * .15, b.y + s * .52, b.x + s * .42, b.y + s * .8); L(b.x + s * .42, b.y + s * .8, b.x + s * .95, b.y + s * .05); }
  };
  const drawCircle = b => page.drawEllipse({ x: X(b.x + b.w / 2), y: Y(b.y + b.h / 2), xScale: b.w / 2 * sx, yScale: b.h / 2 * sy, borderColor: circ, borderWidth: 1.1 });
  const box = F => page.drawRectangle({ x: X(F.x), y: Y(F.y + F.h), width: F.w * sx, height: F.h * sy, borderColor: guide, borderWidth: 0.6 });

  for (const [id, F] of Object.entries(PDF_FIELDS[kind])) {
    if (F.type === 'logo') { const logo = S[F.src]; if (opts.test) box(F); else if (logo) await drawImg(logo, F, true); continue; }
    if (F.type === 'tick') { const v = opts.test ? Object.keys(F.opts)[0] : data[id]; if (v && F.opts[v]) drawTick(F.opts[v]); continue; }
    if (F.type === 'circle') { const v = opts.test ? Object.keys(F.opts)[0] : data[id]; if (v && F.opts[v]) drawCircle(F.opts[v]); continue; }
    if (F.type === 'sig') { if (opts.test) box(F); else if (data[id]) await drawImg(data[id], F, false); continue; }
    if (F.type === 'map') { if (opts.test) box(F); else if (data[id]) await drawImg(data[id], F, true); continue; }
    let v = opts.test ? id : data[id];
    if (id === 'certNo') v = opts.test ? '1234' : padN(data.certNo);
    if (v === undefined || v === null || v === '') continue;
    v = F.type === 'ref' ? String(v) : fmtDate(String(v));
    const f = F.mono ? mono : font;
    v = clean(f, v);
    if (F.wrap) wrapText(v, F);
    else putText(v, F.x, F.y, F.w, F.size, f, F.color === 'red' ? red : ink, F.a);
  }
  doc.setTitle(kind === 'coc' ? 'Electric Fence System Certificate of Compliance' : 'Electric Fence Inspection and Tests'); doc.setCreator('Fence E-COC ' + APP_VERSION);
  if (S.accepted) { doc.setAuthor(S.accepted.name + ' (Reg. No. ' + S.accepted.regNo + ')'); doc.setSubject('Completed by a registered electric fence system installer using Fence E-COC. Not issued or endorsed by the app developer or any authority.'); }
  return await doc.save();
}

/* ------------------------------------------------- share / save / print */
async function deliver(bytes, name, mime, action) {
  if (isCap()) {
    const { Filesystem, Share } = window.Capacitor.Plugins;
    const data = b64FromBytes(bytes);
    if (action === 'save') {
      try { await Filesystem.writeFile({ path: 'Fence-e-COC/' + name, data, directory: 'DOCUMENTS', recursive: true }); return toast('Saved to Documents/Fence-e-COC'); }
      catch (e) { toast('Choose where to save it'); }
    }
    const r = await Filesystem.writeFile({ path: name, data, directory: 'CACHE' });
    try { await Share.share({ title: name, files: [r.uri], dialogTitle: action === 'print' ? 'Print or open with…' : 'Share' }); } catch (e) { /* cancelled */ }
    return;
  }
  const blob = new Blob([bytes], { type: mime });
  if (action === 'share') {
    const file = new File([blob], name, { type: mime });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: name }); } catch (e) { if (e.name !== 'AbortError') toast('Sharing failed – try Save'); }
    } else toast('This browser cannot share files – use Save instead');
  } else if (action === 'save') {
    const a = el('a', { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 10000);
  } else {
    const url = URL.createObjectURL(blob); const w = window.open(url, '_blank'); if (!w) location.href = url;
  }
}
function fileSheet(bytes, name, mime, title, printable) {
  openModal(el('div', {},
    el('h3', {}, title), el('p', { class: 'note' }, name),
    el('button', { class: 'btn accent block', onclick: () => deliver(bytes, name, mime, 'share') }, '📤 Share (WhatsApp, email…)'),
    el('button', { class: 'btn primary block', onclick: () => deliver(bytes, name, mime, 'save') }, '💾 Save to phone'),
    printable ? el('button', { class: 'btn paper block', onclick: () => deliver(bytes, name, mime, 'print') }, '🖨 Print / Open') : null,
    printable ? el('p', { class: 'note' }, 'Print: the PDF opens in your viewer – use its Print option (or Share → Print).') : null,
    el('button', { class: 'btn block', onclick: closeModal }, 'Close')));
}
const cocData = rec => Object.assign({}, rec.data, { certNo: rec.certNo });
const trIndex = (rec, t) => rec.trs.indexOf(t) + 1;
/* Small line at the foot of each test report that ties it to its certificate */
function trData(rec, t) {
  const d = Object.assign({}, t.data);
  if (S.printRef !== false) d._ref = ['ECA (EFSI) Certificate No. ' + padN(rec.certNo), 'Inspection & test report ' + trIndex(rec, t) + ' of ' + rec.trs.length, t.data.trFor, rec.data.physicalAddress].filter(Boolean).join('  ·  ');
  return d;
}
const fileNum = rec => NUMBER_PREFIX + padN(rec.certNo);
async function pdfFor(rec, kind, t) {
  try {
    toast('Creating PDF…', 1500);
    if (kind === 'coc') {
      fileSheet(await makePdf('coc', cocData(rec)), 'FenceCOC_' + fileNum(rec) + '.pdf', 'application/pdf', 'Certificate PDF ready', true);
    } else {
      const n = trIndex(rec, t);
      fileSheet(await makePdf('tr', trData(rec, t)), 'FenceTestReport_' + fileNum(rec) + '_' + String(n).padStart(2, '0') + '.pdf', 'application/pdf', 'Test Report ' + n + ' PDF ready', true);
    }
  } catch (e) { console.error(e); alert('Could not create the PDF: ' + e.message); }
}
/* One PDF with (optionally) the COC first, then every test report */
async function pdfAll(rec, withCoc) {
  if (!rec.trs.length && !withCoc) return toast('No test reports yet');
  try {
    const { PDFDocument } = PDFLib;
    const out = await PDFDocument.create();
    const parts = [];
    if (withCoc) parts.push(['coc', cocData(rec)]);
    rec.trs.forEach(t => parts.push(['tr', trData(rec, t)]));
    for (let i = 0; i < parts.length; i++) {
      toast(`Creating PDF… page ${i + 1} of ${parts.length}`, 4000);
      const src = await PDFDocument.load(await makePdf(parts[i][0], parts[i][1]));
      (await out.copyPages(src, src.getPageIndices())).forEach(pg => out.addPage(pg));
    }
    out.setTitle((withCoc ? 'Fence COC and ' : '') + 'Test Reports ' + numLabel(rec.certNo)); out.setCreator('Fence E-COC ' + APP_VERSION);
    if (S.accepted) out.setAuthor(S.accepted.name + ' (Reg. No. ' + S.accepted.regNo + ')');
    const name = (withCoc ? 'FenceCOC_and_TestReports_' : 'FenceTestReports_') + fileNum(rec) + '.pdf';
    fileSheet(await out.save(), name, 'application/pdf', (withCoc ? 'COC + ' : '') + rec.trs.length + ' test report' + (rec.trs.length === 1 ? '' : 's') + ' in one PDF', true);
  } catch (e) { console.error(e); alert('Could not create the PDF: ' + e.message); }
}

/* ------------------------------------------------------------------- views */
const app = () => $('#app');
let dirty = false;
const markDirty = () => { dirty = true; };
function guard() { if (!dirty) return true; if (confirm('You have unsaved changes. Leave without saving?')) { dirty = false; return true; } return false; }
function nav(v, id, replace) { const st = { v, id }; replace ? history.replaceState(st, '') : history.pushState(st, ''); lastState = st; route(st); }
async function route(st, keepScroll) {
  dirty = false; closeModal(); if (!keepScroll) window.scrollTo(0, 0);
  if (!termsAccepted()) return gateView();
  st = st || { v: 'home' };
  if (st.v === 'coc') { const r = st.id === 'new' ? newCoc() : (st.id && st.id.startsWith('dup:') ? await dupCoc(st.id.slice(4)) : await DB.get(st.id)); if (r) return cocView(r); }
  if (st.v === 'trs') { const r = await DB.get(st.id); if (r) return trListView(r); }
  if (st.v === 'tr') {
    const [cid, tid] = String(st.id).split(':'); const r = await DB.get(cid);
    if (r) { const t = r.trs.find(x => x.id === tid); if (t) return trView(r, t); if (!tid) return trListView(r); }
  }
  if (st.v === 'settings') return settingsView();
  homeView();
}
let lastState = history.state;
window.addEventListener('popstate', e => { if (!guard()) { history.pushState(lastState, ''); return; } lastState = e.state; route(e.state); });
window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

function newCoc() {
  const d = clone(S.defaults);
  TR_DEFAULT_KEYS.forEach(k => delete d[k]);
  Object.assign(d, { certType: 'initial', rpSigDate: today(), recipientDate: today() });
  return { id: uid(), certNo: null, data: d, trs: [], created: Date.now() };
}
async function dupCoc(id) {
  const src = await DB.get(id); if (!src) return null;
  const d = clone(src.data);
  ['recipientName', 'recipientSig', 'supplementNo', 'initialCertNo', 'issuedOn'].forEach(k => delete d[k]);
  d.rpSigDate = today(); d.recipientDate = today();
  return { id: uid(), certNo: null, data: d, trs: [], created: Date.now() };
}

async function homeView() {
  const recs = (await DB.all()).sort((a, b) => (b.certNo || 0) - (a.certNo || 0));
  const list = el('div');
  const search = el('input', { class: 'search', type: 'search', placeholder: '🔍 Search number, client or address' });
  const draw = () => {
    const q = search.value.trim().toLowerCase();
    const hits = recs.filter(r => { const d = r.data; return !q || [padN(r.certNo), numLabel(r.certNo), d.recipientName, d.buildingName, d.physicalAddress, d.suburb, d.district, d.erfNo].some(v => (v || '').toLowerCase().includes(q)); });
    list.replaceChildren(...(hits.length ? hits.map(cocCard) : [el('div', { class: 'empty' }, recs.length ? 'No matches.' : 'No certificates yet. Tap “New Fence COC” to start.')]));
  };
  search.oninput = draw;
  app().replaceChildren(...[ // (nulls removed below)
    el('div', { class: 'row' }, el('button', { class: 'btn primary', style: 'flex:1;font-size:17px', onclick: () => nav('coc', 'new') }, '＋ New Fence COC')),
    el('div', { class: 'note', style: 'margin-top:8px' }, 'Next number: ', el('b', {}, numLabel(previewNumber())), '  ·  ', recs.length + ' saved'),
    syncOn() ? el('div', { class: 'note syncline' }, '☁ ', el('span', { class: 'syncst' }, syncStatusText()), ' · ', el('a', { href: '#', onclick: e => { e.preventDefault(); syncNow(true); } }, 'Sync now')) : null,
    ...duplicateNumbers(recs).map(n => el('div', { class: 'card warn' }, '⚠ ', el('b', {}, numLabel(n)), ' was issued on two devices before they synced, so two certificates now have this number. Open the one that has not been handed over, tap “New COC, same details” to re-issue it under a new number, then delete the duplicate.')),
    search, list, el('div', { class: 'ver' }, 'Fence E-COC v' + APP_VERSION + ' · for registered electric fence installers only · ' + (syncOn() ? 'synced with your other devices through your private GitHub repository' : 'data is stored on this device only — back it up or turn on sync in Settings') + ' · ', el('a', { href: '#', onclick: e => { e.preventDefault(); showTerms(); } }, 'Terms of use'))].filter(Boolean));
  draw();
}
function cocCard(r) {
  const d = r.data;
  return el('div', { class: 'card coc-card' },
    el('div', { class: 'num' }, NUMBER_PREFIX + ' ', el('b', {}, padN(r.certNo)), r.trs.length ? el('span', { class: 'badge' }, r.trs.length + ' test report' + (r.trs.length === 1 ? '' : 's')) : el('span', { class: 'badge no' }, 'No test report')),
    el('div', { class: 'meta' }, [d.recipientName || d.buildingName || '(no client name)', [d.physicalAddress, d.suburb].filter(Boolean).join(', '), fmtDate(d.rpSigDate)].filter(Boolean).join(' · ')),
    el('div', { class: 'row' },
      el('button', { class: 'btn small', onclick: () => nav('coc', r.id) }, '✎ Open'),
      el('button', { class: 'btn small paper', onclick: () => nav('trs', r.id) }, '📋 Test Reports (' + r.trs.length + ')'),
      el('button', { class: 'btn small', onclick: () => pdfFor(r, 'coc') }, '🖨 COC PDF'),
      r.trs.length ? el('button', { class: 'btn small', onclick: () => pdfAll(r, true) }, '🖨 COC + all reports') : null,
      el('button', { class: 'btn small', onclick: () => nav('coc', 'dup:' + r.id) }, '⧉ New COC, same details'),
      el('button', { class: 'btn small danger', onclick: async () => {
        if (!confirm(`Delete ${numLabel(r.certNo)} and its ${r.trs.length} test report(s)?\nThe number will NOT be reused.`)) return;
        await deleteRec(r); toast('Deleted'); homeView();
      } }, '🗑 Delete')));
}

async function saveCoc(rec) {
  if (rec.certNo === null || rec.certNo === undefined) { await syncBeforeNumber(); rec.certNo = await allocateNumber(); }
  rec.dataUpdated = Date.now();
  await saveRec(rec); dirty = false;
}
function cocView(rec) {
  const isNew = rec.certNo === null || rec.certNo === undefined;
  const numBox = el('div', { class: 'numbox' }, el('span', { class: 'eca' }, 'ECA (EFSI) Nº'), el('span', { class: 'n' }, padN(isNew ? previewNumber() : rec.certNo)),
    el('small', {}, isNew ? 'Number is reserved when you save' : 'Certificate No.'));
  const saveBtn = async (msg = true) => { try { await saveCoc(rec); if (msg) toast('Saved ' + numLabel(rec.certNo)); history.replaceState({ v: 'coc', id: rec.id }, ''); return true; } catch (e) { alert(e.message); return false; } };
  app().replaceChildren(
    el('div', { class: 'formhead' }, el('button', { class: 'btn small', onclick: () => history.back() }, '‹ Back'), el('h2', {}, 'Electric Fence System COC')),
    numBox,
    ...renderSchema(COC_SCHEMA, rec.data, { onChange: markDirty, defaults: S.defaults }),
    el('div', { class: 'actions' },
      el('button', { class: 'btn primary', onclick: async () => { if (await saveBtn()) cocView(rec); } }, '💾 Save'),
      el('button', { class: 'btn paper', onclick: async () => { if (await saveBtn(false)) nav('trs', rec.id); } }, '📋 Test Reports'),
      el('button', { class: 'btn accent', onclick: async () => { if (await saveBtn(false)) { cocViewRefreshNumber(numBox, rec); pdfFor(rec, 'coc'); } } }, '🖨 Print / PDF')));
}
function cocViewRefreshNumber(box, rec) { box.querySelector('.n').textContent = padN(rec.certNo); box.querySelector('small').textContent = 'Certificate No.'; }

/* A new report starts with the saved defaults (energizer make, test meter); a copy keeps everything except the per-zone details */
function newTestReport(rec, copyFrom) {
  let data;
  if (copyFrom) {
    data = clone(copyFrom.data);
    TR_CHANGES_PER_COPY.forEach(k => delete data[k]);
  } else {
    data = {};
    TR_DEFAULT_KEYS.forEach(k => { if (S.defaults[k]) data[k] = S.defaults[k]; });
  }
  const now = Date.now(), t = { id: uid(), data, created: now, updated: now };
  rec.trs.push(t); return t;
}
const trLabel = (rec, t) => 'Test Report ' + trIndex(rec, t) + (t.data.trFor ? ' · ' + t.data.trFor : '');

function trListView(rec) {
  const list = el('div');
  const search = el('input', { class: 'search', type: 'search', placeholder: '🔍 Search zone / energizer' });
  const draw = () => {
    const q = search.value.trim().toLowerCase();
    const items = rec.trs.filter(t => !q || (t.data.trFor || '').toLowerCase().includes(q) || (t.data.serialNo || '').toLowerCase().includes(q) || String(trIndex(rec, t)) === q);
    list.replaceChildren(...(items.length ? items.map(t => el('div', { class: 'card' },
      el('div', { style: 'font-weight:800' }, trLabel(rec, t)),
      el('div', { class: 'meta', style: 'color:var(--ink2);font-size:14px;margin:2px 0 8px' }, [t.data.serialNo ? 'S/N ' + t.data.serialNo : '', t.data.peakKv ? t.data.peakKv + ' kV' : '', t.data.siteMap ? 'site map ✓' : 'no site map'].filter(Boolean).join(' · ')),
      el('div', { class: 'row' },
        el('button', { class: 'btn small paper', onclick: () => nav('tr', rec.id + ':' + t.id) }, '✎ Open'),
        el('button', { class: 'btn small', onclick: () => pdfFor(rec, 'tr', t) }, '🖨 PDF'),
        el('button', { class: 'btn small', onclick: async () => { const c = newTestReport(rec, t); await saveRec(rec); nav('tr', rec.id + ':' + c.id); toast('Copied – enter the zone, S/N, kV reading and site map'); } }, '⧉ Copy'),
        el('button', { class: 'btn small danger', onclick: async () => {
          if (!confirm('Delete ' + trLabel(rec, t) + '?')) return;
          rec.delTrs = rec.delTrs || {}; rec.delTrs[t.id] = Date.now(); rec.trs.splice(rec.trs.indexOf(t), 1); await saveRec(rec); toast('Deleted'); trListView(rec);
        } }, '🗑')))) : [el('div', { class: 'empty' }, rec.trs.length ? 'No matches.' : 'No test reports yet. Tap “New test report”.')]));
  };
  search.oninput = draw;
  const last = rec.trs[rec.trs.length - 1];
  app().replaceChildren(...[
    el('div', { class: 'formhead' }, el('button', { class: 'btn small', onclick: () => history.back() }, '‹ Back'), el('h2', {}, 'Test Reports · ' + numLabel(rec.certNo))),
    el('p', { class: 'note' }, rec.trs.length + ' inspection & test report' + (rec.trs.length === 1 ? '' : 's') + ' linked to this COC. A new report starts with your saved energizer make and test meter. “Copy” starts a new report from an existing one (fence type, inspection answers, comments), so only the zone, S/N, kV reading and site map need entering.'),
    el('div', { class: 'row' },
      el('button', { class: 'btn primary', onclick: async () => { const t = newTestReport(rec); await saveRec(rec); nav('tr', rec.id + ':' + t.id); } }, '＋ New test report'),
      last ? el('button', { class: 'btn paper', onclick: async () => { const t = newTestReport(rec, last); await saveRec(rec); nav('tr', rec.id + ':' + t.id); toast('Copied from report ' + (rec.trs.length - 1)); } }, '⧉ Copy last report') : null),
    rec.trs.length ? el('div', { class: 'row', style: 'margin-top:8px' },
      el('button', { class: 'btn small', onclick: () => pdfAll(rec, false) }, '🖨 All reports – one PDF'),
      el('button', { class: 'btn small', onclick: () => pdfAll(rec, true) }, '🖨 COC + all reports')) : null,
    rec.trs.length > 5 ? search : null, list].filter(Boolean));
  draw();
}

function trView(rec, t) {
  const n = trIndex(rec, t);
  const save = async (msg = true) => { t.updated = Date.now(); rec.updated = Date.now(); await saveRec(rec); dirty = false; if (msg) toast('Test report ' + n + ' saved'); };
  app().replaceChildren(
    el('div', { class: 'formhead' }, el('button', { class: 'btn small', onclick: () => history.back() }, '‹ Back'), el('h2', {}, 'Test Report ' + n + ' of ' + rec.trs.length + ' · ' + numLabel(rec.certNo))),
    el('p', { class: 'note' }, 'Annex I – Inspection and tests (SANS 10222-3). Blue fields came from your saved defaults – you can still change them.'),
    el('div', { class: 'row' },
      el('button', { class: 'btn small', onclick: async () => { await save(false); nav('trs', rec.id, true); } }, '☰ All reports')),
    el('div', { id: 'trBody' }),
    el('div', { class: 'actions' },
      el('button', { class: 'btn primary', onclick: () => save() }, '💾 Save'),
      el('button', { class: 'btn paper', onclick: async () => { await save(false); const c = newTestReport(rec, t); await saveRec(rec); nav('tr', rec.id + ':' + c.id, true); toast('Saved. New copy started – enter the next zone'); } }, '⧉ Save & copy'),
      el('button', { class: 'btn accent', onclick: async () => { await save(false); pdfFor(rec, 'tr', t); } }, '🖨 PDF')));
  const body = () => $('#trBody').replaceChildren(...renderSchema(TR_SCHEMA, t.data, { onChange: markDirty, defaults: S.defaults, fromDefaults: TR_DEFAULT_KEYS.filter(k => S.defaults[k] && S.defaults[k] === t.data[k]) }));
  body();
}

/* ------------------------------------------------- terms of use / disclaimer */
function disclaimerBody() {
  return el('div', { class: 'terms' },
    el('h3', {}, 'Fence E-COC – Terms of Use, Disclaimer and Restricted-Use Notice'),
    el('p', { class: 'note' }, 'Version ' + DISCLAIMER_VERSION + ' · ' + DISCLAIMER_DATE),
    DISCLAIMER.map(sec => el('section', {}, el('h4', {}, sec.h),
      (sec.p || []).map(t => el('p', {}, t)),
      sec.list ? el('ul', {}, sec.list.map(t => el('li', {}, t))) : null,
      (sec.p2 || []).map(t => el('p', {}, t)))));
}
const termsAccepted = () => !!(S.accepted && S.accepted.version === DISCLAIMER_VERSION);
function showTerms() {
  openModal(el('div', {}, disclaimerBody(), el('button', { class: 'btn block', onclick: closeModal }, 'Close')));
}
function gateView() {
  document.body.classList.add('locked');
  const a = { name: S.defaults.rpName || '', regNo: S.defaults.rpRegNo || '' };
  const checks = [
    'I am a registered electric fence system installer whose registration with the Chief Inspector, Department of Employment and Labour, in terms of the Electrical Machinery Regulations, 2011, is current and valid.',
    'I will only issue certificates after I have personally inspected and tested the electric fence system, and I will record only true and accurate results.',
    'I will not use this App to forge, duplicate, copy, re-number, backdate or alter any certificate or test report, or to issue more than one certificate under the same number.',
    'I have read and accept the Terms of Use and Disclaimer, including the limitation of liability and indemnity in favour of the developer.',
  ];
  const ticked = checks.map(() => false);
  const name = el('input', { type: 'text', autocomplete: 'name' }); name.value = a.name;
  const reg = el('input', { type: 'text' }); reg.value = a.regNo;
  const checkList = el('div', {}, checks.map((t, i) => {
    const b = el('button', { type: 'button', class: 'chip accept', onclick: () => { ticked[i] = !ticked[i]; b.classList.toggle('on', ticked[i]); } }, t);
    return b;
  }));
  const accept = async () => {
    a.name = name.value.trim(); a.regNo = reg.value.trim();
    if (!a.name) return toast('Enter your full name');
    if (!a.regNo) return toast('Enter your registration number');
    if (ticked.includes(false)) return toast('Please tick all four declarations');
    S.accepted = { version: DISCLAIMER_VERSION, date: new Date().toISOString(), name: a.name, regNo: a.regNo, appVersion: APP_VERSION };
    if (!S.defaults.rpName) S.defaults.rpName = a.name; if (!S.defaults.rpRegNo) S.defaults.rpRegNo = a.regNo;
    await saveSettings();
    document.body.classList.remove('locked');
    toast('Terms accepted'); nav('home', null, true);
  };
  const decline = () => {
    window.scrollTo(0, 0);
    app().replaceChildren(el('div', { class: 'card', style: 'text-align:center;margin-top:30px' },
      el('h2', {}, 'Fence E-COC is locked'),
      el('p', {}, 'This App may only be used by registered electric fence system installers who accept the Terms of Use. Please uninstall the App if you are not a registered installer.'),
      el('button', { class: 'btn primary', onclick: gateView }, 'Read the terms again')));
  };
  app().replaceChildren(
    el('h2', {}, S.accepted ? 'Updated Terms of Use' : 'Before you start'),
    el('p', { class: 'note' }, 'Fence E-COC is for registered electric fence system installers only, as required by the Electrical Machinery Regulations, 2011. Read the terms below, confirm your registration and accept to continue.'),
    el('div', { class: 'card termsbox' }, disclaimerBody()),
    el('fieldset', {}, el('legend', {}, 'Your registration'),
      el('div', { class: 'f' }, el('label', {}, 'Full name'), name),
      el('div', { class: 'f' }, el('label', {}, 'Registration number (electric fence system installer)'), reg)),
    el('fieldset', {}, el('legend', {}, 'Declarations (tick all four)'), checkList),
    el('div', { class: 'row', style: 'margin:14px 0 30px' },
      el('button', { class: 'btn', onclick: decline }, 'I do not accept'),
      el('button', { class: 'btn primary', onclick: accept }, 'I accept – continue')));
}

/* ----------------------------------------------------------------- settings */
function settingsView() {
  const startInp = el('input', { type: 'number', inputmode: 'numeric', min: 1, max: 99999 }); startInp.value = previewNumber();
  const highest = S.used.length ? Math.max(...S.used) : null;
  const defaults = clone(S.defaults);
  const logoRow = (key, label) => {
    const holder = el('div');
    const draw = () => holder.replaceChildren(S[key] ? el('img', { class: 'thumb', src: S[key], alt: '' }) : el('span', { class: 'note' }, 'None'),
      el('div', { class: 'row' },
        el('button', { class: 'btn small', onclick: async () => { const f = await pickFile('image/png,image/jpeg'); if (!f) return; S[key] = await readAsDataURL(f); await saveSettings(); draw(); toast('Logo saved'); } }, 'Choose image'),
        S[key] ? el('button', { class: 'btn small danger', onclick: async () => { S[key] = ''; await saveSettings(); draw(); } }, 'Remove') : null));
    draw(); return el('div', { class: 'f' }, el('label', {}, label), holder);
  };
  const tplRow = (kind, label) => {
    const holder = el('div');
    const draw = async () => {
      const t = await DB.getKV('tpl_' + kind);
      holder.replaceChildren(el('p', { class: 'note' }, t ? 'Using your own: ' + t.name : 'Using the built-in template'),
        el('div', { class: 'row' },
          el('button', { class: 'btn small', onclick: async () => {
            const f = await pickFile('application/pdf,image/png,image/jpeg'); if (!f) return;
            const data = await readAsDataURL(f);
            await DB.setKV('tpl_' + kind, { type: f.type === 'application/pdf' ? 'pdf' : 'image', name: f.name, data }); draw(); toast('Template saved – print an alignment test');
          } }, 'Upload blank form (PDF/photo scan)'),
          t ? el('button', { class: 'btn small danger', onclick: async () => { await DB.delKV('tpl_' + kind); draw(); } }, 'Use built-in') : null,
          el('button', { class: 'btn small paper', onclick: async () => { try { fileSheet(await makePdf(kind, { _ref: '_ref (reference line)' }, { test: true }), 'Alignment_' + kind + '.pdf', 'application/pdf', 'Alignment test', true); } catch (e) { alert(e.message); } } }, 'Alignment test PDF')));
    };
    draw(); return el('div', { class: 'f' }, el('label', {}, label), holder);
  };
  const refChk = el('button', { type: 'button', class: 'chip accept' + (S.printRef !== false ? ' on' : ''), onclick: async () => { S.printRef = S.printRef === false; refChk.classList.toggle('on', S.printRef); await saveSettings(); toast(S.printRef ? 'Reference line on' : 'Reference line off'); } },
    'Print a small reference line at the foot of each test report (certificate number, report number, zone and address), so loose pages can always be matched to their COC');
  app().replaceChildren(
    el('div', { class: 'formhead' }, el('button', { class: 'btn small', onclick: () => history.back() }, '‹ Back'), el('h2', {}, 'Settings')),
    el('fieldset', {}, el('legend', {}, 'Certificate (ECA EFSI) numbers'),
      el('p', { class: 'note' }, highest ? `Highest number issued so far: ${numLabel(highest)}.` : 'No numbers issued yet.'),
      el('div', { class: 'f' }, el('label', {}, 'Next / starting certificate number'), startInp),
      el('p', { class: 'note' }, 'Every new COC gets the next number automatically. Numbers that were already used (even deleted ones) are always skipped.'),
      el('button', { class: 'btn primary', onclick: async () => {
        const n = parseInt(startInp.value, 10);
        if (!(n >= 1 && n <= 99999)) return toast('Enter a number from 1 to 99999');
        if (S.used.includes(n) && !confirm(`${numLabel(n)} was already used. The app will skip to the next unused number. Continue?`)) return;
        S.nextNo = n; await saveSettings(); startInp.value = previewNumber(); toast('Next number: ' + numLabel(previewNumber()));
      } }, 'Save number')),
    syncSettingsCard(),
    el('fieldset', {}, el('legend', {}, 'My default details'),
      el('p', { class: 'note' }, 'Your details are filled in on every new COC; the energizer make and test meter on every new test report. Signatures saved here can be added with one tap (“Use saved”).'),
      ...renderSchema(COC_SCHEMA, defaults, {}, DEFAULT_KEYS).map(fs => { fs.style.border = '0'; fs.style.padding = '0'; return fs; }),
      ...renderSchema(TR_SCHEMA, defaults, {}, TR_DEFAULT_KEYS).map(fs => { fs.style.border = '0'; fs.style.padding = '0'; fs.querySelector('legend').textContent = 'Test report defaults'; return fs; }),
      el('button', { class: 'btn primary block', onclick: async () => { S.defaults = defaults; await saveSettings(); toast('Default details saved'); } }, 'Save default details')),
    el('fieldset', {}, el('legend', {}, 'Logos (optional)'),
      el('p', { class: 'note' }, 'Add a cropped picture of the logo printed on your forms. It is placed in the logo area of the PDF.'),
      logoRow('logoCoc', 'COC – coat of arms (top-left)'), logoRow('logoTr', 'ECA logo (top-right of the COC and the test report)')),
    el('fieldset', {}, el('legend', {}, 'Test reports'), refChk),
    el('fieldset', {}, el('legend', {}, 'Form templates'),
      el('p', { class: 'note' }, 'The app has built-in A4 copies of both forms. You can replace them with a flat scan of your own blank form. Fine-tune positions in config.js.'),
      tplRow('coc', 'Electric Fence System Certificate of Compliance'), tplRow('tr', 'Annex I – Inspection and Tests')),
    el('fieldset', {}, el('legend', {}, 'Backup & restore'),
      el('p', { class: 'note' }, 'Save a backup file to Google Drive, email or your computer. Restore it on a new phone.'),
      el('div', { class: 'row' },
        el('button', { class: 'btn primary', onclick: backup }, '⬆ Backup all data'),
        el('button', { class: 'btn', onclick: restore }, '⬇ Restore from file'))),
    el('fieldset', {}, el('legend', {}, 'Terms of use & disclaimer'),
      S.accepted ? el('p', { class: 'note' }, `Accepted version ${S.accepted.version} on ${fmtDate(S.accepted.date.slice(0, 10))} by ${S.accepted.name} (Reg. No. ${S.accepted.regNo}).`) : null,
      el('button', { class: 'btn block', onclick: showTerms }, 'Read the Terms of Use and Disclaimer')),
    el('fieldset', {}, el('legend', {}, 'Install'),
      el('button', { class: 'btn block', onclick: installHelp }, 'How to install on Android / iPhone')),
    el('div', { class: 'ver' }, 'Fence E-COC version ' + APP_VERSION));
}
async function backup() {
  const data = { app: 'Fence-e-COC', format: 1, version: APP_VERSION, exported: new Date().toISOString(), settings: S, cocs: await DB.all(),
    templates: { coc: (await DB.getKV('tpl_coc')) || null, tr: (await DB.getKV('tpl_tr')) || null } };
  fileSheet(new TextEncoder().encode(JSON.stringify(data)), 'Fence-e-COC-backup-' + today() + '.json', 'application/json', 'Backup ready (' + data.cocs.length + ' certificates)', false);
}
async function restore() {
  const f = await pickFile('.json,application/json'); if (!f) return;
  let data; try { data = JSON.parse(await readAsText(f)); } catch { return alert('That file is not a valid backup.'); }
  if (data.app !== 'Fence-e-COC' || !Array.isArray(data.cocs)) return alert('That file is not a Fence E-COC backup.');
  if (!confirm(`Restore ${data.cocs.length} certificates from ${String(data.exported || '').slice(0, 10)}?\nThis replaces the certificates on this phone.`)) return;
  await DB.clearCocs(); for (const r of data.cocs) await DB.put(r);
  const old = S; S = Object.assign(clone(DEFAULT_SETTINGS), data.settings || {});
  if (old.accepted) S.accepted = old.accepted;
  S.used = [...new Set([...(old.used || []), ...(S.used || []), ...data.cocs.map(r => r.certNo).filter(Boolean)])];
  S.nextNo = Math.max(Number(old.nextNo) || 1, Number(S.nextNo) || 1);
  await saveSettings();
  for (const k of ['coc', 'tr']) { if (data.templates && data.templates[k]) await DB.setKV('tpl_' + k, data.templates[k]); }
  toast('Backup restored'); nav('home', null, true);
}

/* --------------------------------------------------- top buttons: install etc */
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });
window.addEventListener('appinstalled', () => toast('Fence E-COC installed'));
function installHelp() {
  const ios = el('div', {}, el('h4', {}, '📱 iPhone / iPad (Safari)'), el('ol', { class: 'steps' },
    el('li', {}, 'Open this page in Safari.'), el('li', {}, 'Tap the Share button (square with an arrow ↑) at the bottom.'),
    el('li', {}, 'Scroll down and tap “Add to Home Screen”.'), el('li', {}, 'Tap “Add”. Fence E-COC appears on your home screen and works offline.')));
  const and = el('div', {}, el('h4', {}, '🤖 Android (Chrome)'), el('ol', { class: 'steps' },
    el('li', {}, 'Tap the ⋮ menu at the top-right of Chrome.'), el('li', {}, 'Tap “Install app” or “Add to Home screen”.'), el('li', {}, 'Confirm. Open Fence E-COC from your home screen.'),
    el('li', {}, 'Or install the Android app (APK) from the download page: ', el('a', { href: APK_URL, target: '_blank', rel: 'noopener' }, 'Releases'))));
  const pc = el('div', {}, el('h4', {}, '💻 Windows PC or laptop (Edge or Chrome)'), el('ol', { class: 'steps' },
    el('li', {}, 'Open ', el('b', {}, APP_URL), ' in Microsoft Edge or Google Chrome.'),
    el('li', {}, 'Click the install icon at the right end of the address bar (a small screen with an arrow, or “App available”). ',
      'No icon? Edge: ⋯ menu → Apps → “Install this site as an app”. Chrome: ⋮ menu → “Cast, save and share” → “Install page as app”.'),
    el('li', {}, 'Click “Install”. Fence E-COC opens in its own window and gets a Start-menu and desktop shortcut. It works offline.'),
    el('li', {}, 'To have the same certificates on your phone and PC, turn on sync: Settings → “Sync between phone and PC”.')));
  const order = isWindowsPC() ? [pc, and, ios] : isIOS() ? [ios, and, pc] : [and, ios, pc];
  openModal(el('div', {}, el('h3', {}, 'Install Fence E-COC'), ...order, el('button', { class: 'btn block', onclick: closeModal }, 'Close')));
}
async function doInstall() {
  if (isCap()) return toast('This is the installed Android app');
  if (isStandalone()) return toast('Fence E-COC is already installed');
  if (installEvt) { installEvt.prompt(); const c = await installEvt.userChoice; installEvt = null; if (c.outcome === 'accepted') toast('Installing…'); return; }
  installHelp();
}
const verNum = v => (String(v || '').match(/\d+(\.\d+)*/) || ['0'])[0].split('.').map(Number);
const newer = (a, b) => { const x = verNum(a), y = verNum(b); for (let i = 0; i < Math.max(x.length, y.length); i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };
/* Android app: ask GitHub Releases for the newest APK (works even if GitHub Pages is down) */
async function latestApk() {
  const url = 'https://api.github.com/repos/' + GITHUB_REPO + '/releases/latest';
  let j;
  const nativeHttp = isCap() && window.Capacitor.Plugins.CapacitorHttp;
  if (nativeHttp) {   // phone's own connection – not blocked like web requests inside the app
    const r = await nativeHttp.get({ url, headers: { Accept: 'application/vnd.github+json' } });
    if (r.status !== 200) throw new Error('HTTP ' + r.status);
    j = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
  } else {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    j = await r.json();
  }
  const apk = (j.assets || []).find(a => /\.apk$/i.test(a.name));
  return { version: verNum(j.tag_name).join('.'), url: apk ? apk.browser_download_url : (j.html_url || APK_URL) };
}
/* Open a link in the phone's browser (Chrome), which downloads the APK */
async function openExternal(url) {
  const B = isCap() && window.Capacitor.Plugins.Browser;
  if (B) { try { await B.open({ url }); return; } catch (e) { console.warn(e); } }
  if (!window.open(url, '_blank')) location.href = url;
}
async function doUpdate() {
  if (!navigator.onLine) return toast('You are offline – connect to the internet to check for updates');
  if (isCap()) {
    toast('Checking for updates…');
    let rel;
    try { rel = await latestApk(); }
    catch (e) { if (confirm('Could not check for updates automatically (' + (e.message || e) + '). Open the download page instead?')) openExternal(APK_URL); return; }
    if (!newer(rel.version, APP_VERSION)) return toast('You have the latest version (' + APP_VERSION + ')');
    if (confirm(`Version ${rel.version} is available (you have ${APP_VERSION}).\n\nDownload it now? Then open the downloaded file to install it over this app – your certificates stay on the phone.`)) openExternal(rel.url);
    return;
  }
  let remote;
  try { const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' }); remote = (await r.json()).version; }
  catch { return toast('Could not reach the update site'); }
  if (remote === APP_VERSION && !confirm(`You have the latest version (${APP_VERSION}). Clear the cache and reload anyway?`)) return;
  toast('Updating to ' + remote + '…');
  try {
    // only this app's cache and service worker – other apps on the same site are left alone
    if ('caches' in window) for (const k of await caches.keys()) if (k.startsWith(CACHE_PREFIX)) await caches.delete(k);
    if (navigator.serviceWorker) { const r = await navigator.serviceWorker.getRegistration(); if (r) await r.unregister(); }
  } catch (e) { console.warn(e); }
  setTimeout(() => location.reload(), 400);
}
async function doShare() {
  const text = 'Fence E-COC – Electric Fence System Certificates of Compliance & Test Reports on your phone. Install it here:';
  if (isCap()) { try { await window.Capacitor.Plugins.Share.share({ title: 'Fence E-COC', text, url: APP_URL }); } catch { } return; }
  if (navigator.share) { try { await navigator.share({ title: 'Fence E-COC', text, url: APP_URL }); } catch { } return; }
  try { await navigator.clipboard.writeText(APP_URL); toast('Link copied: ' + APP_URL); } catch { prompt('Copy this link:', APP_URL); }
}

/* --------------------------------------------------------------------- start */
(async function start() {
  $('#btnSettings').onclick = () => { if (!termsAccepted()) return toast('Please accept the Terms of Use first'); if (history.state && history.state.v === 'settings') return; if (guard()) nav('settings'); };
  $('#btnInstall').onclick = doInstall; $('#btnUpdate').onclick = doUpdate; $('#btnShare').onclick = doShare;
  if (isCap()) $('#btnInstall').classList.add('hidden');
  try { await DB.open(); await loadSettings(); await loadSyncCfg(); }
  catch (e) { app().textContent = 'Storage is not available on this browser: ' + e.message; return; }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { });
  if ('serviceWorker' in navigator && !isCap() && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW', e));
  if (!history.state) history.replaceState({ v: 'home' }, '');
  lastState = history.state; route(history.state);
  startAutoSync();
})();
