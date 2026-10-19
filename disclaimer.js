/* =====================================================================
   FENCE E-COC  —  TERMS OF USE, DISCLAIMER AND RESTRICTED-USE NOTICE
   =====================================================================
   If you change the wording, raise
   DISCLAIMER_VERSION (e.g. '1.1') – every user will then have to read
   and accept the new terms again before they can use the app.
   ===================================================================== */
const DISCLAIMER_VERSION = '1.0';
const DISCLAIMER_DATE = '19 October 2026';

const DISCLAIMER = [
  { h: 'Important – read before use', p: [
    'Fence E-COC ("the App") is a form-completion and record-keeping tool for Electric Fence System Certificates of Compliance ("COC") and the related Inspection and Test Reports (SANS 10222-3, Annex I) in the Republic of South Africa. By installing, opening or using the App you agree to these terms. If you do not agree, or if you are not a person described in section 1, you may not use the App and must uninstall it.',
  ] },
  { h: '1. Who may use the App', p: [
    'The App may only be used by:',
  ], list: [
    'a registered electric fence system installer whose registration with the Chief Inspector of the Department of Employment and Labour ("DEL", formerly the Department of Labour) under the Electrical Machinery Regulations, 2011 is current and valid; and',
    'persons working under the direct supervision of such a registered installer, who may capture information only. Only the registered installer may inspect, test, sign and issue a certificate.',
  ] },
  { h: '2. What the App is – and is not', list: [
    'The App is a tool that prints the information you enter onto a reproduction of the prescribed forms. It does not issue, approve, register or validate any certificate.',
    'The App is NOT issued, approved, endorsed or authorised by the Department of Employment and Labour, the Chief Inspector, the Electrical Contractors\' Association (SA), the South African Bureau of Standards, any municipality or any other body. The developer is not affiliated with any of them. Names, forms and emblems belong to their respective owners and are shown only so that the printed document follows the prescribed format.',
    'A certificate produced with the App is valid only if the registered installer has personally carried out the inspection and testing, all sections are completed correctly and truthfully, the inspection and test report (including the site map) is attached, and every requirement of the Occupational Health and Safety Act, 1993, the Electrical Machinery Regulations, 2011 and SANS 10222-3 has been met. The App cannot check or guarantee any of this.',
    'It is your responsibility to confirm with the Chief Inspector and any other recipient that a certificate completed and printed in this format is acceptable before you issue it.',
  ] },
  { h: '3. Your responsibilities', p: ['When you use the App you confirm that you will:'], list: [
    'personally carry out the inspection and tests and record only true, accurate readings and results;',
    'use only your own name, registration number and signature, and only certificate numbers legitimately issued or allocated to you;',
    'use each certificate number for one electric fence system only, and never issue more than one certificate under the same number;',
    'supply a site map that truly reflects the installation, with measurements;',
    'check every printed or saved certificate and test report against the prescribed form and your own records before you sign or hand it over;',
    'not make corrections to a certificate once issued – issue a new or supplementary certificate instead;',
    'keep your records, signatures and backups secure and protect your device with a PIN, password or biometric lock;',
    'comply with the Protection of Personal Information Act, 2013 (POPIA) for any personal information (such as names, ID numbers, addresses and GPS locations) you capture and store.',
  ] },
  { h: '4. Prohibited use', p: ['You may NOT use the App to:'], list: [
    'issue, sign or complete any certificate or test report without having personally inspected and tested the electric fence system;',
    'forge, copy, duplicate, re-number or alter any certificate or test report, whether made with the App or not;',
    'issue more than one certificate under the same number, or a number that was not legitimately issued or allocated to you;',
    'backdate a certificate, or enter false, estimated or made-up test results or site maps;',
    'use another person\'s name, registration number, ID number or signature, or allow another person to use yours;',
    'produce certificates for sale, or for anyone who is not a registered electric fence system installer;',
    'represent that a certificate is approved or endorsed by the developer or by any authority because it was made with the App.',
  ], p2: [
    'Issuing a false or fraudulent certificate of compliance may be a criminal offence and can lead to prosecution, de-registration, fines and civil claims. Such use is entirely at your own risk and responsibility.',
  ] },
  { h: '5. No warranty', p: [
    'The App is provided free of charge, "as is" and "as available", without any warranty of any kind, whether express or implied, including (without limitation) warranties of accuracy, completeness, fitness for a particular purpose, legal compliance or that the App is free of errors. The layout, field positions, numbering, printing or saving of documents may contain errors, and forms, standards or regulations may change after the App was released. You must check every document produced.',
  ] },
  { h: '6. Limitation of liability', p: [
    'To the fullest extent permitted by law, the developer, its owners, employees and contributors will not be liable for any loss, damage, injury, death, claim, fine, penalty, cost or expense of any kind – whether direct, indirect, special or consequential – arising out of or in connection with the use of, misuse of or inability to use the App, including (without limitation): an unsafe or non-compliant electric fence system; an incorrect, incomplete, invalid or rejected certificate or test report; a false or fraudulent certificate; the loss or corruption of data; or any refusal of an insurance claim, sale or transfer.',
    'Nothing in these terms limits any liability that cannot lawfully be limited or excluded.',
  ] },
  { h: '7. Indemnity', p: [
    'You indemnify and hold harmless the developer, its owners, employees and contributors against any claim, demand, action, loss, fine, penalty, cost (including legal costs) or liability brought by any person, authority or body arising from your use or misuse of the App, any certificate or test report you issue, or your breach of these terms or of any law.',
  ] },
  { h: '8. Your data', p: [
    'All information you enter is stored only on your own device. The developer does not receive, see, store or back up your data, and cannot recover it. You are responsible for making backups (Settings → Backup), for keeping backup files safe, and for complying with POPIA. Uninstalling the App or clearing its storage permanently deletes your data.',
  ] },
  { h: '9. Acceptance record', p: [
    'When you accept these terms, the App records on your device the date, the terms version, your name and your registration number. The registration details you provide are not verified by the developer, and providing false details is a breach of these terms.',
  ] },
  { h: '10. Changes and termination', p: [
    'The developer may change these terms, the App or the forms at any time, or stop providing the App. Updated terms must be accepted before further use. Your right to use the App ends automatically if you breach these terms.',
  ] },
  { h: '11. Governing law', p: [
    'These terms are governed by the laws of the Republic of South Africa. If any part of these terms is found to be invalid or unenforceable, the remaining parts remain in full force.',
  ] },
];
