
/**
 * GOOGLE APPS SCRIPT - CAPELANIA PRO LEGACY
 * Este código deve ser colado no Editor de Script da Planilha Google.
 */

function doGet(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet();
  const action = e.parameter.action;
  
  if (action === 'getData') {
    const data = {
      users: getSheetData(sheet, 'users'),
      bibleStudies: getSheetData(sheet, 'bible_studies'),
      bibleClasses: getSheetData(sheet, 'bible_classes'),
      smallGroups: getSheetData(sheet, 'small_groups'),
      staffVisits: getSheetData(sheet, 'staff_visits'),
      config: getSheetData(sheet, 'app_config')[0] || {},
      masterLists: getSheetData(sheet, 'master_lists')[0] || {}
    };
    return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  const params = JSON.parse(e.postData.contents);
  const sheet = SpreadsheetApp.getActiveSpreadsheet();
  // Lógica de salvamento em massa para legado...
  return ContentService.createTextOutput(JSON.stringify({success: true})).setMimeType(ContentService.MimeType.JSON);
}

function getSheetData(ss, name) {
  const sheet = ss.getSheetByName(name);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  return values.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}
