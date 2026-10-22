/* =====================================================================
   FENCE E-COC  —  SETTINGS & PDF FIELD POSITIONS  (edit this file to adjust)
   =====================================================================
   APP_VERSION : bump this (and the same number in version.json and sw.js)
                 every time you upload changes, so the Update button works.
   APP_URL     : your GitHub Pages address (used by the Share button).
   APK_URL     : your Releases page (the Android app's Update button opens it).
   ===================================================================== */
const APP_VERSION = '1.0.2';
const APP_URL = 'https://m9r1u5.github.io/Fence-e-COC/';
const GITHUB_REPO = 'm9r1u5/Fence-e-COC';  // owner/repo – the Android app's Update button checks this repo's Releases
const APK_URL = 'https://github.com/m9r1u5/Fence-e-COC/releases/latest';   // where the Android app (APK) can be downloaded

/* How the certificate number prints: digits are padded with leading zeros to this length (9430 -> 9430, 52 -> 0052) */
const NUMBER_DIGITS = 4;
const NUMBER_PREFIX = 'EFSI';   // shown in the app and in file names

/* Look of the text printed onto the forms */
const PDF_STYLE = {
  textColor: [0.05, 0.1, 0.45],   // dark blue "pen" colour (R,G,B 0-1). Use [0,0,0] for black
  numberColor: [0.8, 0.1, 0.1],   // colour of the certificate number (red like the printed books)
  circleColor: [0.05, 0.1, 0.45], // colour of the circle drawn around Yes / No
  tickStyle: 'check',             // 'check' = ✓  or  'x' = X in the tick boxes
  dateFormat: 'DD/MM/YYYY',       // or 'YYYY-MM-DD', 'DD-MM-YYYY'
  minFontSize: 5.5,               // long text shrinks down to this size before being cut off
};

/* Shift EVERYTHING on a form at once (points). Use this first if all fields
   are off by the same amount, e.g. after uploading your own scanned template.
   dx: + moves right   dy: + moves DOWN */
const PDF_OFFSET = {
  coc: { dx: 0, dy: 0 },
  tr:  { dx: 0, dy: 0 },
};

/* =====================================================================
   FIELD POSITIONS  —  one line per field
   Units are PDF points on an A4 page: 595 wide x 842 high (72 pt = 1 inch,
   about 2.83 pt = 1 mm). Measured from the TOP-LEFT corner of the page.
     x, y  : where the text starts; y is the text baseline (+y = further down)
     w     : maximum width; longer text is shrunk to fit
     size  : font size
     a: 'c': centre the text inside w
   Tick boxes:   x, y = top-left corner of the box, s = box size
   Signatures:   x, y = top-left of the signature area, w x h = its size
   Circles:      x, y, w, h = the box the circle (ellipse) is drawn around
   _logo:        where an optional logo image (Settings) is placed
   siteMap:      the map-drawing area of the test report
   _ref:         small reference line at the very bottom of each test report
                 (COC number, report number, zone) – can be switched off in Settings
   To nudge one field: change its x (left/right) or y (up/down) by a few points.
   ===================================================================== */
const PDF_FIELDS = {
  /* ---------- ELECTRIC FENCE SYSTEM CERTIFICATE OF COMPLIANCE (coc-template.pdf) ---------- */
  coc: {
    _logo: {type: 'logo', src: 'logoCoc', x: 30, y: 20, w: 82, h: 88},
    _logo2: {type: 'logo', src: 'logoTr', x: 455, y: 16, w: 110, h: 62},
    certNo: {x: 333, y: 218, w: 74, size: 15, color: 'red', mono: true, a: 'c'},
    certType: { type: 'tick', opts: {
      'initial': {x: 474.5, y: 201.5, s: 11},
      'supplementary': {x: 550.5, y: 201.5, s: 11},
    } },
    supplementNo: {x: 106, y: 264.5, w: 92, size: 8.5},
    initialCertNo: {x: 307, y: 264.5, w: 111, size: 8.5},
    issuedOn: {x: 484, y: 264.5, w: 71.3, size: 8.5},
    physicalAddress: {x: 106, y: 341.5, w: 449.3, size: 8.5},
    district: {x: 130, y: 367.5, w: 160, size: 8.5},
    gps: {x: 376, y: 367.5, w: 179.3, size: 8.5},
    buildingName: {x: 130, y: 393.5, w: 160, size: 8.5},
    erfNo: {x: 358, y: 393.5, w: 197.3, size: 8.5},
    suburb: {x: 130, y: 419.5, w: 160, size: 8.5},
    poleNo: {x: 358, y: 419.5, w: 197.3, size: 8.5},
    rpName: {x: 48, y: 505.5, w: 250, size: 8.5},
    rpId: {x: 336, y: 505.5, w: 210, size: 8.5},
    rpRegNo: {x: 186, y: 587.5, w: 142, size: 8.5},
    rpRegDate: {x: 426, y: 587.5, w: 129.3, size: 8.5},
    rpSig: {type: 'sig', x: 84, y: 604, w: 240, h: 31},
    rpSigDate: {x: 370, y: 633.5, w: 185.3, size: 8.5},
    recipientName: {x: 100, y: 765.5, w: 134, size: 8.5},
    recipientSig: {type: 'sig', x: 290, y: 738, w: 128, h: 29},
    recipientDate: {x: 455, y: 765.5, w: 100.3, size: 8.5},
  },

  /* ---------- ANNEX I – INSPECTION AND TESTS (test-report-template.pdf) ---------- */
  tr: {
    _logo: {type: 'logo', src: 'logoTr', x: 455, y: 14, w: 110, h: 62},
    energizerMake: {x: 105, y: 117.5, w: 180, size: 8},
    serialNo: {x: 353, y: 117.5, w: 207.3, size: 8},
    peakKv: {x: 267.7, y: 133.5, w: 292.6, size: 8},
    testMeter: {x: 333.1, y: 149.5, w: 227.1, size: 8},
    monitored: { type: 'circle', opts: {
      'yes': {x: 510.8, y: 155.5, w: 27, h: 15},
      'no': {x: 536.8, y: 155.5, w: 27, h: 15},
    } },
    ftSecurity: { type: 'tick', opts: {
      'yes': {x: 122.2, y: 195.5, s: 11},
    } },
    ftGame: { type: 'tick', opts: {
      'yes': {x: 229.3, y: 195.5, s: 11},
    } },
    ftAgri: { type: 'tick', opts: {
      'yes': {x: 382.5, y: 195.5, s: 11},
    } },
    insp1: { type: 'circle', opts: {
      'yes': {x: 510.8, y: 230.5, w: 27, h: 15},
      'no': {x: 536.8, y: 230.5, w: 27, h: 15},
    } },
    insp2: { type: 'circle', opts: {
      'yes': {x: 510.8, y: 245.5, w: 27, h: 15},
      'no': {x: 536.8, y: 245.5, w: 27, h: 15},
    } },
    insp3: { type: 'circle', opts: {
      'yes': {x: 510.8, y: 260.5, w: 27, h: 15},
      'no': {x: 536.8, y: 260.5, w: 27, h: 15},
    } },
    insp4: { type: 'circle', opts: {
      'yes': {x: 510.8, y: 275.5, w: 27, h: 15},
      'no': {x: 536.8, y: 275.5, w: 27, h: 15},
    } },
    insp5: { type: 'circle', opts: {
      'yes': {x: 510.8, y: 300.1, w: 27, h: 15},
      'no': {x: 536.8, y: 300.1, w: 27, h: 15},
    } },
    insp6: { type: 'circle', opts: {
      'yes': {x: 510.8, y: 315.1, w: 27, h: 15},
      'no': {x: 536.8, y: 315.1, w: 27, h: 15},
    } },
    insp7: { type: 'circle', opts: {
      'yes': {x: 510.8, y: 368.5, w: 27, h: 15},
      'no': {x: 536.8, y: 368.5, w: 27, h: 15},
    } },
    comments: {x: 34, y: 411, w: 527.3, size: 7.5, wrap: {x: 34, w: 527.3, gap: 15}},
    siteMap: {type: 'map', x: 31, y: 597, w: 533.3, h: 224},   // drawing area under the legend
    _ref: {type: 'ref', x: 30, y: 834, w: 535.3, size: 6.5},
  },
};
