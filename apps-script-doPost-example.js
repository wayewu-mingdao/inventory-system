/**
 * Paste this into the Google Apps Script project that serves API_URL.
 * Keep your existing doGet(e), then add this doPost(e).
 *
 * Expected sheets:
 * - 耗材清單: must contain headers 耗材編號 and 目前庫存量
 * - 入出庫紀錄: created automatically if missing
 */

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents || '{}');
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var inventorySheet = spreadsheet.getSheetByName('耗材清單') || spreadsheet.getSheets()[0];
    var logSheet = spreadsheet.getSheetByName('入出庫紀錄') || spreadsheet.insertSheet('入出庫紀錄');

    ensureLogHeader_(logSheet);
    appendTransactionLog_(logSheet, payload);
    updateInventoryStock_(inventorySheet, payload);

    return jsonOutput_({
      success: true,
      message: 'saved',
      itemCode: payload.itemCode,
      afterStock: payload.afterStock
    });
  } catch (error) {
    return jsonOutput_({
      success: false,
      message: error.message
    });
  }
}

function ensureLogHeader_(sheet) {
  var headers = [
    '送出時間',
    '日期',
    '類型',
    '耗材編號',
    '耗材名稱',
    '類別',
    '規格/型號',
    '館室',
    '存放位置',
    '數量',
    '異動前庫存',
    '異動後庫存',
    '來源/領用',
    '經手人',
    '備註'
  ];

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    return;
  }

  var firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  if (firstRow[0] !== headers[0]) {
    sheet.insertRows(1);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
}

function appendTransactionLog_(sheet, payload) {
  sheet.appendRow([
    payload.submittedAt || new Date(),
    payload.date || '',
    payload.transactionType || '',
    payload.itemCode || '',
    payload.itemName || '',
    payload.category || '',
    payload.spec || '',
    payload.room || '',
    payload.location || '',
    Number(payload.quantity || 0),
    Number(payload.beforeStock || 0),
    Number(payload.afterStock || 0),
    payload.party || '',
    payload.operator || '',
    payload.note || ''
  ]);
}

function updateInventoryStock_(sheet, payload) {
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) throw new Error('耗材清單沒有資料');

  var headers = values[0];
  var codeColumn = headers.indexOf('耗材編號') + 1;
  var stockColumn = headers.indexOf('目前庫存量') + 1;

  if (!codeColumn || !stockColumn) {
    throw new Error('耗材清單需要「耗材編號」與「目前庫存量」欄位');
  }

  for (var row = 2; row <= values.length; row++) {
    if (String(values[row - 1][codeColumn - 1]) === String(payload.itemCode)) {
      sheet.getRange(row, stockColumn).setValue(Number(payload.afterStock || 0));
      return;
    }
  }

  throw new Error('找不到耗材編號：' + payload.itemCode);
}

function jsonOutput_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
