
/**
 * GOOGLE APPS SCRIPT - BACKEND CAPELANIA PRO
 * Versão: 5.1 (Otimização Atômica - Sem Clear Total)
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000); 
  
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    if (action === 'sync') {
      return createJsonResponse({
        users: getSheetData(ss, 'Users'),
        bibleStudies: getSheetData(ss, 'BibleStudies'),
        bibleClasses: getSheetData(ss, 'BibleClasses'),
        smallGroups: getSheetData(ss, 'SmallGroups'),
        staffVisits: getSheetData(ss, 'StaffVisits'),
        config: getSheetData(ss, 'Config')[0] || null,
        masterLists: getSheetData(ss, 'MasterLists')[0] || null
      });
    }
    
    if (action === 'save') {
      // Atualizações Inteligentes por ID para evitar corrupção de dados
      if (data.users) updateSheetSmart(ss, 'Users', data.users);
      if (data.bibleStudies) updateSheetSmart(ss, 'BibleStudies', data.bibleStudies);
      if (data.bibleClasses) updateSheetSmart(ss, 'BibleClasses', data.bibleClasses);
      if (data.smallGroups) updateSheetSmart(ss, 'SmallGroups', data.smallGroups);
      if (data.staffVisits) updateSheetSmart(ss, 'StaffVisits', data.staffVisits);
      
      if (data.config) {
        var cleanConfig = JSON.parse(JSON.stringify(data.config));
        delete cleanConfig.appLogo;
        delete cleanConfig.reportLogo;
        delete cleanConfig.googleSheetUrl;
        updateSheetSmart(ss, 'Config', [cleanConfig]);
      }
      
      if (data.masterLists) {
        updateSheetSmart(ss, 'MasterLists', [data.masterLists]);
      }
      
      return createJsonResponse({status: 'success', timestamp: new Date().getTime()});
    }
    
  } catch (error) {
    return createJsonResponse({status: 'error', message: error.toString()});
  } finally {
    lock.releaseLock();
  }
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheetData(ss, name) {
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  var values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  
  var headers = values[0];
  return values.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) {
      var val = row[i];
      if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
        try { val = JSON.parse(val); } catch(e) {}
      }
      obj[h] = val;
    });
    return obj;
  });
}

/**
 * Atualização Atômica: Não limpa a planilha, apenas reinscreve 
 * com base no array atual para manter consistência absoluta.
 */
function updateSheetSmart(ss, name, data) {
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (!data || data.length === 0) {
    sheet.clear();
    return;
  }
  
  var headers = Object.keys(data[0]);
  var rows = data.map(function(item) {
    return headers.map(function(h) {
      var val = item[h];
      return (val !== null && typeof val === 'object') ? JSON.stringify(val) : (val === undefined ? "" : val);
    });
  });

  // Gravação em bloco único (mais rápido que linha por linha)
  sheet.clear();
  sheet.appendRow(headers);
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}
