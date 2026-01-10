
/**
 * GOOGLE APPS SCRIPT - BACKEND CAPELANIA PRO
 * Versão: 5.0 (Foco em Cabeçalho e Listas Mestres)
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000); 
  
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // AÇÃO: SINCRONIZAÇÃO (DOWNLOAD)
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
    
    // AÇÃO: SALVAR (UPLOAD)
    if (action === 'save') {
      if (data.users) updateSheet(ss, 'Users', data.users);
      if (data.bibleStudies) updateSheet(ss, 'BibleStudies', data.bibleStudies);
      if (data.bibleClasses) updateSheet(ss, 'BibleClasses', data.bibleClasses);
      if (data.smallGroups) updateSheet(ss, 'SmallGroups', data.smallGroups);
      if (data.staffVisits) updateSheet(ss, 'StaffVisits', data.staffVisits);
      
      // Salva Configurações (Apenas dados de cabeçalho e layout)
      if (data.config) {
        var cleanConfig = JSON.parse(JSON.stringify(data.config));
        // Garantia absoluta de remoção de dados locais/pesados antes de escrever na planilha
        delete cleanConfig.appLogo;
        delete cleanConfig.reportLogo;
        delete cleanConfig.googleSheetUrl;
        updateSheet(ss, 'Config', [cleanConfig]);
      }
      
      // Salva Listas Mestres (Setores, PGs, Colaboradores)
      if (data.masterLists) {
        updateSheet(ss, 'MasterLists', [data.masterLists]);
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

function updateSheet(ss, name, data) {
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  sheet.clear();
  if (!data || data.length === 0) return;
  
  var headers = Object.keys(data[0]);
  sheet.appendRow(headers);
  
  var rows = data.map(function(item) {
    return headers.map(function(h) {
      var val = item[h];
      return (val !== null && typeof val === 'object') ? JSON.stringify(val) : (val === undefined ? "" : val);
    });
  });
  
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}
