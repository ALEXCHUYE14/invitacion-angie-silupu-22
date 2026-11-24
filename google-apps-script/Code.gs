/**
 * RSVP · Invitación Angie Silupu · 22
 * Hoja vinculada: "RSVP · Cumpleaños 22 Angie Silupu"
 * https://docs.google.com/spreadsheets/d/1q7fHTTMMDMy7xhvBpFIQijSL_StoA7X6wW9VRuUaNyc/edit
 *
 * Cómo activarlo (una sola vez):
 *  1. Abre la hoja > Extensiones > Apps Script. Borra todo y pega este archivo. Guarda.
 *  2. Implementar > Nueva implementación > tipo "Aplicación web".
 *     Ejecutar como: Yo · Quién tiene acceso: Cualquier persona. > Implementar > Autorizar.
 *  3. Copia la URL que termina en /exec y pégala en app.js > SHEETS_CONFIG.endpoint
 *  (Si luego editas este código: Implementar > Gestionar implementaciones > editar > Nueva versión.)
 */
const SPREADSHEET_ID = '1q7fHTTMMDMy7xhvBpFIQijSL_StoA7X6wW9VRuUaNyc';
const SHEET_NAME = 'Confirmaciones';
const HEADERS = ['Fecha/Hora', 'Nombre', 'Asistencia', 'Acompañantes', 'Total personas', 'Mensaje'];

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); // evita que dos envíos simultáneos se pisen

    const raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    const data = JSON.parse(raw);

    // Honeypot anti-spam
    if (data.website) return json_({ ok: true });

    const nombre = clean_(data.nombre, 80);
    if (!nombre) return json_({ ok: false, error: 'El nombre es obligatorio.' });

    const asistencia = clean_(data.asistencia, 10) === 'No' ? 'No' : 'Sí';
    const acomp = asistencia === 'Sí' ? (['Solo yo', '+1', '+2'].indexOf(data.acompanantes) >= 0 ? data.acompanantes : 'Solo yo') : '—';
    const total = asistencia === 'Sí' ? 1 + (acomp === '+1' ? 1 : acomp === '+2' ? 2 : 0) : 0;
    const mensaje = clean_(data.mensaje, 500);

    const sheet = getSheet_();
    sheet.appendRow([new Date(), nombre, asistencia, "'" + acomp, total, mensaje]);
    sheet.getRange(sheet.getLastRow(), 1).setNumberFormat('dd/mm/yyyy hh:mm:ss');

    return json_({ ok: true, stats: stats_(sheet) });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    lock.releaseLock();
  }
}

// GET: devuelve el contador (solo números, nunca nombres ni mensajes)
function doGet() {
  return json_({ ok: true, stats: stats_(getSheet_()) });
}

function stats_(sheet) {
  const last = sheet.getLastRow();
  if (last < 2) return { confirmados: 0, personas: 0 };
  const rows = sheet.getRange(2, 3, last - 1, 3).getValues(); // Asistencia, Acompañantes, Total
  let confirmados = 0, personas = 0;
  rows.forEach(function (r) {
    if (r[0] === 'Sí') { confirmados++; personas += Number(r[2]) || 1; }
  });
  return { confirmados: confirmados, personas: personas };
}

function getSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length)
      .setFontWeight('bold')
      .setBackground('#5C1120')
      .setFontColor('#F7F1EA');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Limpia texto y neutraliza fórmulas (=, +, -, @)
function clean_(value, max) {
  let s = String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
