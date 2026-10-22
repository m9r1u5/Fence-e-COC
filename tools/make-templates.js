/* Builds the blank Fence COC + Test Report templates and the matching field positions.
   Coordinates: points from the TOP-LEFT of an A4 page (595.28 x 841.89), y = text baseline. */
const fs = require('fs');
const PDFLib = require(__dirname + '/../pdf-lib.min.js');
const { PDFDocument, StandardFonts, rgb, LineCapStyle } = PDFLib;
const OUT = process.argv[2] || __dirname + '/..';
const LEGEND = process.argv[3] || __dirname + '/site-map-legend.pdf';
const PW = 595.28, PH = 841.89, L = 30, R = 565.28, W = R - L;
const r2 = v => Math.round(v * 10) / 10;

async function setup() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([PW, PH]);
  const F = {
    h: await doc.embedFont(StandardFonts.Helvetica), hb: await doc.embedFont(StandardFonts.HelveticaBold),
    tb: await doc.embedFont(StandardFonts.TimesRomanBold), t: await doc.embedFont(StandardFonts.TimesRoman),
  };
  const K = rgb(0, 0, 0), grey = rgb(0.88, 0.89, 0.88), gridC = rgb(0.72, 0.74, 0.72), red = rgb(0.8, 0.1, 0.1);
  const g = {
    doc, page, F, K, grey, red,
    text(s, x, y, o = {}) {
      const f = o.f || F.h, size = o.size || 8.5; let sz = size;
      if (o.maxW) while (f.widthOfTextAtSize(s, sz) > o.maxW) sz -= 0.1;
      const w = f.widthOfTextAtSize(s, sz);
      const xx = o.align === 'c' ? x - w / 2 : o.align === 'r' ? x - w : x;
      page.drawText(s, { x: xx, y: PH - y, size: sz, font: f, color: o.color || K });
      if (o.underline) page.drawLine({ start: { x: xx, y: PH - y - 1.6 }, end: { x: xx + w, y: PH - y - 1.6 }, thickness: 0.8, color: K });
      return xx + w;
    },
    width: (s, f, size) => (f || F.h).widthOfTextAtSize(s, size || 8.5),
    rect(x, y, w, h, o = {}) {
      page.drawRectangle({ x, y: PH - y - h, width: w, height: h, color: o.fill, borderColor: o.stroke === false ? undefined : (o.stroke || K), borderWidth: o.stroke === false ? 0 : (o.lw || 0.8) });
    },
    line(x1, y1, x2, y2, o = {}) {
      page.drawLine({ start: { x: x1, y: PH - y1 }, end: { x: x2, y: PH - y2 }, thickness: o.lw || 0.6, color: o.color || K, dashArray: o.dash });
    },
    fillLine(x1, x2, y) { this.line(x1, y + 1.5, x2, y + 1.5, { lw: 0.5 }); },
    // wrap text into lines that fit maxW; returns lines
    wrap(s, f, size, maxW) {
      const out = []; let cur = '';
      for (const w of s.split(' ')) { const t = cur ? cur + ' ' + w : w; if (f.widthOfTextAtSize(t, size) <= maxW) cur = t; else { out.push(cur); cur = w; } }
      out.push(cur); return out;
    },
  };
  return g;
}

/* ============================================================ COC */
async function buildCoc() {
  const g = await setup(); const { F } = g; const P = {};
  P._logo = { type: 'logo', src: 'logoCoc', x: 30, y: 20, w: 82, h: 88 };
  P._logo2 = { type: 'logo', src: 'logoTr', x: 455, y: 16, w: 110, h: 62 };
  const cx = PW / 2;
  g.text('Annexure 1', cx, 44, { f: F.hb, size: 10, align: 'c' });
  g.text('DEPARTMENT OF LABOUR', cx, 70, { f: F.tb, size: 12.5, align: 'c' });
  g.text('OCCUPATIONAL HEALTH AND SAFETY ACT, 1993', cx, 96, { f: F.tb, size: 13.5, align: 'c' });
  g.text('CERTIFICATE OF COMPLIANCE', cx, 122, { f: F.tb, size: 12.5, align: 'c' });
  g.text('ELECTRIC FENCE SYSTEM CERTIFICATE OF COMPLIANCE', cx, 148, { f: F.tb, size: 13.5, align: 'c' });

  // block 1
  const b1 = 172, b1h = 58;
  g.rect(L, b1 + 8, 262, b1h - 8, { lw: 1 });
  ['Electric Fence System Certificate of compliance', 'in accordance with regulation 12(4) and 13(1)', 'of the Electrical Machinery Regulations, 2011.']
    .forEach((s, i) => g.text(s, L + 6, b1 + 25 + i * 11.5, { f: F.hb, size: 8.6, maxW: 250 }));
  g.text('ECA (EFSI)', 358, b1 + 8, { f: F.hb, size: 9, align: 'c' });
  g.text('CERTIFICATE NO.', 358, b1 + 18, { f: F.hb, size: 9, align: 'c' });
  g.rect(303, b1 + 23, 110, 33, { lw: 1 });
  g.text('Nº', 309, b1 + 45, { f: F.t, size: 12, color: g.red });
  P.certNo = { x: 333, y: b1 + 46, w: 74, size: 15, color: 'red', mono: true, a: 'c' };
  g.rect(420, b1, R - 420, b1h, { lw: 1 });
  g.text('Certificate type (tick appropriate block)', 424, b1 + 12, { f: F.hb, size: 8.1, maxW: 138 });
  g.line(420, b1 + 17, R, b1 + 17, { lw: 0.8 });
  g.text('Initial', 427, b1 + 33, { f: F.hb, size: 8.5 }); g.text('Certificate', 427, b1 + 43, { f: F.hb, size: 8.5 });
  g.rect(474, b1 + 29, 12, 12);
  g.text('Supplementary', 488, b1 + 33, { f: F.hb, size: 7.8 }); g.text('Certificate', 494, b1 + 43, { f: F.hb, size: 7.8 });
  g.rect(550, b1 + 29, 12, 12);
  P.certType = { type: 'tick', opts: { initial: { x: 474.5, y: b1 + 29.5, s: 11 }, supplementary: { x: 550.5, y: b1 + 29.5, s: 11 } } };

  // block 2
  const b2 = 246;
  g.rect(L, b2, W, 30, { lw: 1 });
  const by = b2 + 19;
  g.text('Supplement No.:', L + 8, by); g.fillLine(104, 200, by);
  g.text('to initial Certificate No.:', 212, by); g.fillLine(305, 420, by);
  g.text('as issued on:', 430, by); g.fillLine(482, R - 8, by);
  P.supplementNo = { x: 106, y: by - 0.5, w: 92, size: 8.5 };
  P.initialCertNo = { x: 307, y: by - 0.5, w: 111, size: 8.5 };
  P.issuedOn = { x: 484, y: by - 0.5, w: R - 494, size: 8.5 };

  // block 3 identification
  const b3 = 290, b3h = 148;
  g.rect(L, b3, W, 32, { fill: g.grey, lw: 1 });
  g.rect(L, b3, W, b3h, { lw: 1 });
  g.text('Identification of the relevant electrical installation', PW / 2, b3 + 15, { f: F.hb, size: 10, align: 'c' });
  g.text('(Address or other unique reference, where applicable)', PW / 2, b3 + 26, { size: 7.6, align: 'c' });
  const rows = [b3 + 52, b3 + 78, b3 + 104, b3 + 130];
  g.text('Physical address:', L + 8, rows[0]); g.fillLine(104, R - 8, rows[0]);
  P.physicalAddress = { x: 106, y: rows[0] - 0.5, w: R - 116, size: 8.5 };
  g.text('District / Town / City:', L + 8, rows[1]); g.fillLine(128, 292, rows[1]);
  g.text('GPS Coordinates:', 305, rows[1]); g.fillLine(374, R - 8, rows[1]);
  P.district = { x: 130, y: rows[1] - 0.5, w: 160, size: 8.5 };
  P.gps = { x: 376, y: rows[1] - 0.5, w: R - 386, size: 8.5 };
  g.text('Name of building /', L + 8, rows[2] - 4); g.text('premises:', L + 8, rows[2] + 6); g.fillLine(128, 292, rows[2]);
  g.text('Erf / Lot No:', 305, rows[2]); g.fillLine(356, R - 8, rows[2]);
  P.buildingName = { x: 130, y: rows[2] - 0.5, w: 160, size: 8.5 };
  P.erfNo = { x: 358, y: rows[2] - 0.5, w: R - 368, size: 8.5 };
  g.text('Suburb / Township:', L + 8, rows[3]); g.fillLine(128, 292, rows[3]);
  g.text('Pole number:', 305, rows[3]); g.fillLine(356, R - 8, rows[3]);
  P.suburb = { x: 130, y: rows[3] - 0.5, w: 160, size: 8.5 };
  P.poleNo = { x: 358, y: rows[3] - 0.5, w: R - 368, size: 8.5 };

  // block 4 installer declaration
  const b4 = 452, b4h = 196;
  g.rect(L, b4, W, 30, { fill: g.grey, lw: 1 });
  g.rect(L, b4, W, b4h, { lw: 1 });
  g.text('Declaration by registered electrical fence installer', PW / 2, b4 + 19, { f: F.hb, size: 10, align: 'c' });
  const iy = b4 + 54;
  g.text('I,', L + 8, iy); g.fillLine(46, 300, iy);
  g.text('(ID no.', 304, iy); g.fillLine(334, 548, iy); g.text(')', 551, iy);
  P.rpName = { x: 48, y: iy - 0.5, w: 250, size: 8.5 };
  P.rpId = { x: 336, y: iy - 0.5, w: 210, size: 8.5 };
  const para = 'a registered electric fence system installer, declare that I have personally carried out the inspection and testing of the electric fence system installation described above as per the requirements of regulation 13(1), and deem the installation to be reasonably safe when properly used.';
  g.wrap(para, F.h, 7.5, W - 16).forEach((s, i) => g.text(s, L + 8, iy + 20 + i * 10, { size: 7.5 }));
  g.line(L, iy + 38, R, iy + 38, { lw: 0.8 });
  const ry = iy + 82;
  g.text('Registered person registration number:', L + 8, ry); g.fillLine(184, 330, ry);
  g.text('Date of registration:', 345, ry); g.fillLine(424, R - 8, ry);
  P.rpRegNo = { x: 186, y: ry - 0.5, w: 142, size: 8.5 };
  P.rpRegDate = { x: 426, y: ry - 0.5, w: R - 436, size: 8.5 };
  const sy = ry + 46;
  g.text('Signature:', L + 8, sy); g.fillLine(80, 330, sy);
  g.text('Date:', 345, sy); g.fillLine(368, R - 8, sy);
  P.rpSig = { type: 'sig', x: 84, y: sy - 30, w: 240, h: 31 };
  P.rpSigDate = { x: 370, y: sy - 0.5, w: R - 380, size: 8.5 };

  // block 5 user / lessor
  const b5 = 662, b5h = 118;
  g.rect(L, b5, W, 30, { fill: g.grey, lw: 1 });
  g.rect(L, b5, W, b5h, { lw: 1 });
  g.text('Declaration by user or lessor', PW / 2, b5 + 19, { f: F.hb, size: 10, align: 'c' });
  const p2 = 'I declare that I am aware of my responsibilities in terms of regulation 12 of the Electrical Machinery Regulations and undertake to operate and maintain the electric fence system in a safe manner.';
  g.wrap(p2, F.h, 7.5, W - 16).forEach((s, i) => g.text(s, L + 8, b5 + 46 + i * 10, { size: 7.5 }));
  const uy = b5 + 104;
  g.text('Recipient name:', L + 8, uy); g.fillLine(98, 236, uy);
  g.text('Signature:', 246, uy); g.fillLine(288, 420, uy);
  g.text('Date:', 430, uy); g.fillLine(453, R - 8, uy);
  P.recipientName = { x: 100, y: uy - 0.5, w: 134, size: 8.5 };
  P.recipientSig = { type: 'sig', x: 290, y: uy - 28, w: 128, h: 29 };
  P.recipientDate = { x: 455, y: uy - 0.5, w: R - 465, size: 8.5 };

  g.doc.setTitle('Electric Fence System Certificate of Compliance (blank)');
  fs.writeFileSync(OUT + '/coc-template.pdf', await g.doc.save());
  return P;
}

/* ============================================================ TEST REPORT */
async function buildTr() {
  const g = await setup(); const { F } = g; const P = {};
  P._logo = { type: 'logo', src: 'logoTr', x: 455, y: 14, w: 110, h: 62 };
  // ECA regional telephone numbers, as printed on the form
  const tel = [['010 271 0686', '043 726 6359'], ['012 342 3242', '041 363 1990'], ['031 312 6313', '021 462 2690'], ['051 447 0859', '011 392 0000']];
  const phone = (x, y) => { // tiny telephone handset glyph
    g.rect(x, y - 6, 8, 5.2, { fill: g.K, stroke: false }); g.rect(x - 1, y - 7.6, 10, 2, { fill: g.K, stroke: false });
  };
  phone(38, 30); phone(108, 30);
  tel.forEach(([a, b], i) => { g.text(a, 49, 30 + i * 9.6, { size: 8.6 }); g.text(b, 119, 30 + i * 9.6, { size: 8.6 }); });
  g.text('ANNEX I', PW / 2, 37, { f: F.tb, size: 13, align: 'c', underline: true });
  g.text('(Normative)', PW / 2, 48, { size: 7.5, align: 'c' });
  g.text('SANS 10222-3:2023 - Edition 5.1', PW / 2, 66, { f: F.tb, size: 12, align: 'c' });
  g.text('INSPECTION AND TESTS (NEW AND EXISTING INSTALLATIONS)', PW / 2, 86, { f: F.hb, size: 10.5, align: 'c' });
  g.text('1 Tests', 38, 102, { f: F.hb, size: 11 });

  const lx = 38, BX = R - 2; // label x, right edge of answer boxes
  let y = 118;
  g.text('Energizer make:', lx, y, { size: 8 }); g.rect(102, y - 9, 186, 12);
  g.text('S/N number:', 300, y, { size: 8 }); g.rect(350, y - 9, BX - 350, 12);
  P.energizerMake = { x: 105, y: y - 0.5, w: 180, size: 8 };
  P.serialNo = { x: 353, y: y - 0.5, w: BX - 356, size: 8 };
  y += 16;
  let e = g.text('Peak high voltage reading at furthest point from energizer (KV):', lx, y, { size: 8 });
  g.rect(e + 3, y - 9, BX - e - 3, 12); P.peakKv = { x: e + 6, y: y - 0.5, w: BX - e - 9, size: 8 };
  y += 16;
  e = g.text('Model number, manufacturer and series number of test meter / oscilloscope used:', lx, y, { size: 8 });
  g.rect(e + 3, y - 9, BX - e - 3, 12); P.testMeter = { x: e + 6, y: y - 0.5, w: BX - e - 9, size: 8 };
  y += 16;
  const ynBoxes = (yy) => {
    const yb = { x: BX - 50, y: yy - 9, w: 22, h: 12 }, nb = { x: BX - 24, y: yy - 9, w: 22, h: 12 };
    g.rect(yb.x, yb.y, yb.w, yb.h); g.text('Yes', yb.x + 11, yy, { size: 8, align: 'c' });
    g.rect(nb.x, nb.y, nb.w, nb.h); g.text('No', nb.x + 11, yy, { size: 8, align: 'c' });
    const c = b => ({ x: r2(b.x - 2.5), y: r2(b.y - 1.5), w: b.w + 5, h: b.h + 3 });
    return { type: 'circle', opts: { yes: c(yb), no: c(nb) } };
  };
  g.text('In the case of a monitored system, has the requirements of SANS 10222-3 been fully satisfied:', lx, y, { size: 8 });
  P.monitored = ynBoxes(y);

  y += 22;
  // 1.1 heading with a drawn tick mark
  let hx = g.text('1.1 Fence type (tick(', lx, y, { f: F.hb, size: 11 });
  g.line(hx + 1.5, y - 4, hx + 4, y - 1, { lw: 1.2 }); g.line(hx + 4, y - 1, hx + 9, y - 9, { lw: 1.2 });
  g.text(') what is applicable)', hx + 10, y, { f: F.hb, size: 11 });
  y += 16;
  const ft = [['ftSecurity', 'Security electric fence'], ['ftGame', 'Game electric fence'], ['ftAgri', 'General agriculture electric fence']];
  let fx = lx;
  ft.forEach(([id, lab]) => {
    const ex = g.text(lab, fx, y, { size: 8 });
    g.rect(ex + 5, y - 9, 13, 12);
    P[id] = { type: 'tick', opts: { yes: { x: ex + 6, y: y - 8.5, s: 11 } } };
    fx = ex + 36;
  });

  y += 22;
  g.text('2 Inspection (Circle the correct one)', lx, y, { f: F.hb, size: 11 });
  const insp = [
    ['2.1', 'Are all components correctly selected:'],
    ['2.2', 'Are all bordering public areas protected from the electric fence:'],
    ['2.3', 'Components have been correctly installed:'],
    ['2.4', 'Are all electric fencing live and electric fencing earth conductors properly bonded, mechanically sound and electrically continuous:'],
    ['2.5', 'Are all brackets, off-set brackets or poles (or both) properly installed and mechanically sound:'],
    ['2.6', 'The installation complies with its requirements, as specified in this certificate, as contained in SANS 10222-3, referring to the requirements as laid out for fundamental requirements, earthing of electric fences, lightning protection requirements for electric fences, corrosion protection requirements for electric fences, protection of communication lines against interference from electric fences, installation requirements between overhead power conductors and electric fences and any other applicable section of SANS 10222-3.'],
    ['2.7', 'The installation complies with the general safety principles of SANS 10222-3: (additional working paper can be added)'],
  ];
  y += 15;
  const tw = BX - 56 - 60;
  insp.forEach(([n, s], i) => {
    const lines = g.wrap(s, F.h, 8, tw);
    g.text(n, lx, y, { size: 8 });
    lines.forEach((ln, k) => g.text(ln, lx + 20, y + k * 9.6, { size: 8 }));
    P['insp' + (i + 1)] = ynBoxes(y);
    y += lines.length * 9.6 + 5.4;
  });

  y += 2;
  g.text('Comments:', lx, y, { f: F.hb, size: 8 });
  g.text('Comments on parts of electric fence not covered by this certificate:', lx + g.width('Comments: ', F.hb, 8), y, { size: 8 });
  const cb = y + 4;
  g.rect(L, cb, W, 30, { lw: 0.8 }); g.line(L, cb + 15, R, cb + 15, { lw: 0.6 });
  P.comments = { x: L + 4, y: cb + 11, w: W - 8, size: 7.5, wrap: { x: L + 4, w: W - 8, gap: 15 } };

  y = cb + 30 + 18;
  g.text('3 Site map', lx, y, { f: F.hb, size: 12 });
  y += 12;
  g.text('3.1 A complete site map shall be supplied with the following:', lx, y, { f: F.hb, size: 8 });
  const left = ['a)  the position of Electric Fence Energizer;', 'b)  the Power Point supplying power to Energizer;', 'c)  lightning protection;', 'd)  HT Cable;', 'e)  Earth spikes;'];
  const right = ['f)  the number of fence poles as well as the number of lines;', 'g)  the length of the building element on which the poles are installed:', 'h)  the position of Keypad and warning devices (siren and strobe; and', 'i)   the position of signal cable Keypad and warning device.'];
  left.forEach((s, i) => g.text(s, lx, y + 11 + i * 9.6, { size: 8 }));
  right.forEach((s, i) => g.text(s, 300, y + 20.6 + i * 9.6, { size: 8, maxW: BX - 300 }));
  y += 11 + 5 * 9.6 + 2;
  g.text('3.2 A map may be a rough drawing if a site drawing is not available. All measurements shall be indicated on the map.', lx, y, { size: 8, maxW: BX - lx });
  y += 13;
  g.text('MAP DRAWING / SITE MAP', PW / 2, y, { f: F.hb, size: 10, align: 'c' });
  const my = y + 4, mh = 822 - my;
  // grid (5 mm squares) – dashed like the printed form
  const step = 14.17;
  for (let gx = L + step; gx < R - 1; gx += step) g.line(gx, my, gx, my + mh, { lw: 0.35, color: rgb(0.7, 0.72, 0.7), dash: [3, 2] });
  for (let gy = my + step; gy < my + mh - 1; gy += step) g.line(L, gy, R, gy, { lw: 0.35, color: rgb(0.7, 0.72, 0.7), dash: [3, 2] });
  /* LEGEND – the installer's own AutoCAD drawing (site-map-legend.pdf, landscape).
     Their drawn square is x 12..750, y 156..543 pt (from the top). It is scaled as one
     piece so that square fits this map square, keeping every symbol and text where
     they placed it; only the legend band at the top is copied in. */
  const SQ = { x: 12, y: 156, w: 738, h: 387 };          // their square (top-left origin)
  const BAND = 236;                                        // bottom of their legend text (top-left y)
  const s = Math.min(W / SQ.w, mh / SQ.h);
  const ox = L + (W - SQ.w * s) / 2, oy = my;              // where their square's top-left lands
  const bandH = (BAND - SQ.y) * s;
  g.rect(L + 0.6, my + 0.6, W - 1.2, bandH, { fill: rgb(1, 1, 1), stroke: false });   // keep the grid out of the legend
  const srcH = 595;                                         // landscape page height of the legend PDF
  const clip = { left: SQ.x + 5, right: SQ.x + SQ.w - 5, top: srcH - (SQ.y + 4), bottom: srcH - BAND };
  const emb = await g.doc.embedPage((await PDFDocument.load(fs.readFileSync(LEGEND))).getPage(0), clip);
  g.page.drawPage(emb, { x: ox + (clip.left - SQ.x) * s, y: PH - (oy + (srcH - clip.bottom - SQ.y) * s), xScale: s, yScale: s });
  g.line(L, my + bandH, R, my + bandH, { lw: 0.8 });
  g.rect(L, my, W, mh, { lw: 1 });
  P.siteMap = { type: 'map', x: L + 1, y: my + bandH + 1, w: W - 2, h: mh - bandH - 2 };
  P._ref = { type: 'ref', x: L, y: 834, w: W, size: 6.5 };

  g.doc.setTitle('Electric Fence Inspection and Tests - Annex I (blank)');
  fs.writeFileSync(OUT + '/test-report-template.pdf', await g.doc.save());
  return P;
}

(async () => {
  const coc = await buildCoc(), tr = await buildTr();
  const round = o => JSON.parse(JSON.stringify(o, (k, v) => typeof v === 'number' ? r2(v) : v));
  fs.writeFileSync(__dirname + '/fields.json', JSON.stringify({ coc: round(coc), tr: round(tr) }, null, 1));
  console.log('ok');
})();
