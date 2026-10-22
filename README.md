# Fence E-COC

Offline app for **Electric Fence System Certificates of Compliance (COC)** (Electrical Machinery Regulations, 2011 – regulations 12(4) and 13(1)) and their **Inspection and Test Reports** (SANS 10222-3, Annex I), including a hand-drawn **site map**.
Works on Android and iPhone, stores everything on the phone, and prints both forms as A4 PDFs.

**For registered electric fence system installers only.** Use of this app is subject to the [Terms of Use and Disclaimer](DISCLAIMER.md), which every user must accept in the app before use.

## Files (all in the root of the repo)

| File | What it is |
|---|---|
| `index.html`, `app.js`, `style.css` | The app |
| `disclaimer.js`, `DISCLAIMER.md` | Terms of use shown in the app (raise `DISCLAIMER_VERSION` after editing so users accept again) |
| `config.js` | **Field positions on the PDFs, number format + version number** – edit this to nudge anything |
| `coc-template.pdf`, `test-report-template.pdf` | Blank A4 forms used as the PDF background |
| `pdf-lib.min.js` | PDF library (works offline) |
| `sw.js`, `manifest.json`, `version.json`, `icon-*.png`, `.nojekyll` | Offline + install support |
| `fence.keystore` | Signing key so every new APK installs over the old one and keeps the data |
| `.github/workflows/build-apk.yml` | Builds the Android APK |

---

## 1. Turn on GitHub Pages

1. In the repo tap **Settings → Pages**.
2. **Source:** *Deploy from a branch*. **Branch:** `main`, folder `/ (root)` → **Save**.
3. After 1–2 minutes the app is live at **https://m9r1u5.github.io/Fence-e-COC/**
   (If the repo or username changes, change `APP_URL`, `GITHUB_REPO` and `APK_URL` at the top of `config.js`.)

## 2. Build the Android APK

1. In the repo tap **Actions**. If asked, tap **I understand my workflows, go ahead and enable them**.
2. Tap **Build Android APK** → **Run workflow** → **Run workflow**. (It also runs by itself every time you upload changes.)
3. Wait about 5 minutes for the green tick.
4. Download: repo main page → **Releases** → tap the latest → download **`Fence-e-COC-1.0.0.apk`**.
5. Open the APK on the phone → allow *Install unknown apps* when asked → **Install**.

## 3. Install on iPhone / iPad

1. Open **https://m9r1u5.github.io/Fence-e-COC/** in **Safari**.
2. Tap **Share** (square with ↑) → **Add to Home Screen** → **Add**.
3. Open it once while online; after that it works offline. The app's **Install** button shows these steps too.

On Android you can also install the web version: open the link in Chrome → **Install** button (or ⋮ → *Install app*).

---

## Using the app

1. **Settings** first: enter your **next certificate number** (e.g. 9430), your **default details** (name, ID, registration number and date, signature) and your **test report defaults** (energizer make, test meter). Tap the Save buttons.
2. **New Fence COC** shows the number it will get (EFSI 9430). The number is locked in when you tap **Save**. Numbers are never reused, even after a delete.
3. **Test Reports** (on the COC or the list) shows every inspection & test report linked to that COC – there is no limit (40+ is fine).
   * **New test report** starts with your saved energizer make and test meter (shown in blue, still editable).
   * **Copy last report** / **Copy** / **Save & copy** start the next report from an existing one, keeping the fence type, inspection answers and comments, so for each extra zone you only enter the zone name, S/N, kV reading and site map.
   * **Site map:** *Draw site map* opens a drawing pad on the same grid as the form – pen, straight lines, text for labels and measurements, eraser, colours, undo. *Use photo / scan* puts a photo of a paper sketch or site drawing in the map area (you can still draw on top of it). Turn the phone sideways for a bigger map.
   * **All reports – one PDF** and **COC + all reports** put everything into a single PDF to share or print.
   * Each printed test report carries a small reference line at the bottom (certificate number, report number, zone and address) so loose pages always match their COC. Switch it off in **Settings → Test reports** if you don't want it.
4. **Print / PDF** → *Share* (WhatsApp, email…), *Save to phone* or *Print / Open*.
5. **Settings → Backup all data** before changing phones; **Restore from file** on the new phone.

## Making the PDFs match perfectly

* **Settings → Form templates → Alignment test PDF** prints every field's name in its position, with red boxes for signatures, logos and the site map.
* If *everything* is shifted, change `PDF_OFFSET` in `config.js` (`dx` + = right, `dy` + = down, in points; 1 mm ≈ 2.83 pt).
* To move one field, change its `x` or `y` in the `PDF_FIELDS` list in `config.js`.
* **Logos:** Settings → Logos – add a cropped picture of the coat of arms (COC, top-left) and the ECA logo (COC and test report, top-right).
* **Use your own blank form:** Settings → Form templates → *Upload blank form*. Use a flat, straight scan of an **unfilled** form, as PDF or JPG. Then print an alignment test and adjust positions in `config.js`.
* **Site map legend:** the legend at the top of the map square comes from `tools/site-map-legend.pdf` (your drawing). To change it, replace that file and run `node tools/make-templates.js` on a computer – it rebuilds both blank templates.
* Text colour, circle colour, tick style (✓ or X), date format and how many digits the certificate number has (`NUMBER_DIGITS`) are at the top of `config.js`.

## Releasing an update

1. Change the files on GitHub (tap a file → ✏ pencil → edit → Commit).
2. Raise the version number in **all three** places: `config.js` (`APP_VERSION`), `version.json` and `sw.js` (`VERSION`) – e.g. `1.0.1`.
3. Users tap **Update** in the app: the web version clears its cache and reloads; the Android app checks Releases and downloads the new APK (built automatically).

Data is never touched by updates – it lives in the phone's storage. Uninstalling the app or clearing the browser's site data **does** delete it, so keep backups.
