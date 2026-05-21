/**
 * Paste this full script into the Google Apps Script project that serves API_URL.
 *
 * Expected sheets:
 * - 耗材主資料: row 3 is the header row, row 4+ contains item rows.
 * - 入庫紀錄: existing sheet, row 3 is the header row.
 * - 出庫紀錄: existing sheet, row 3 is the header row.
 *
 * The script writes to a fixed spreadsheet and appends to the first truly empty
 * transaction row without rebuilding existing sheet headers or formatting.
 */

const SPREADSHEET_ID = "1FlZxmYeq8unPHcsQe928bwjb9DfzYt5FrhmNXhe9Hn8";

function doGet(e) {
  try {
    if (e && e.parameter && e.parameter.payload) {
      const callback = e.parameter.callback || "";
      const result = saveTransactionPayload_(JSON.parse(e.parameter.payload || "{}"));
      return callback ? callbackOutput_(callback, result) : jsonOutput_(result);
    }

    const sheet = getSpreadsheet_().getSheetByName("耗材主資料");

    const data = sheet.getDataRange().getValues();

    // 第 3 列是標題列
    const headers = data[2];

    // 第 4 列開始是資料
    const rows = data.slice(3);

    const result = rows
      .filter(row => row[0] && row[0].toString().trim() !== "")
      .map(row => {
        let obj = {};
        headers.forEach((header, i) => {
          obj[header] = row[i];
        });
        return obj;
      });

    return jsonOutput_({
      status: "success",
      data: result
    });
  } catch (error) {
    return jsonOutput_({
      success: false,
      message: error.message
    });
  }
}

function doPost(e) {
  try {
    const rawPayload = e && e.parameter && e.parameter.payload
      ? e.parameter.payload
      : (e && e.postData && e.postData.contents) || "{}";
    const payload = JSON.parse(rawPayload);
    return jsonOutput_(saveTransactionPayload_(payload));
  } catch (error) {
    return jsonOutput_({
      success: false,
      message: error.message
    });
  }
}

function saveTransactionPayload_(payload) {
  const spreadsheet = getSpreadsheet_();
  const inventoryItem = findInventoryItem_(spreadsheet, payload);
  const logSheetName = getTransactionLogSheetName_(payload);
  const logSheet = spreadsheet.getSheetByName(logSheetName);

  if (!logSheet) {
    throw new Error("找不到「" + logSheetName + "」工作表");
  }

  appendRecordByHeaders_(logSheet, payload, inventoryItem);

  return {
    success: true,
    message: "saved",
    sheetName: logSheetName,
    itemCode: payload.itemCode,
    room: payload.room
  };
}

function getTransactionLogSheetName_(payload) {
  if (payload.action === "outbound" || payload.transactionType === "出庫") {
    return "出庫紀錄";
  }

  return "入庫紀錄";
}

function getSpreadsheet_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function findInventoryItem_(spreadsheet, payload) {
  const sheet = spreadsheet.getSheetByName("耗材主資料");
  if (!sheet) return {};

  const values = sheet.getDataRange().getValues();
  if (values.length < 4) return {};

  const headers = values[2];
  const rows = values.slice(3);
  const codeIndex = headers.indexOf("耗材編號");
  const roomIndex = headers.indexOf("館室");

  if (codeIndex < 0) return {};

  const matchedRow = rows.find(row => {
    const sameCode = String(row[codeIndex] || "") === String(payload.itemCode || "");
    const sameRoom = roomIndex < 0 || String(row[roomIndex] || "") === String(payload.room || "");
    return sameCode && sameRoom;
  });

  if (!matchedRow) return {};

  return headers.reduce((item, header, index) => {
    item[header] = matchedRow[index];
    return item;
  }, {});
}

function appendRecordByHeaders_(sheet, payload, inventoryItem) {
  const headerRow = 3;
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(headerRow, 1, 1, lastColumn).getValues()[0];
  const nextRow = findFirstEmptyRecordRow_(sheet, headers, headerRow);
  const values = headers.map(header => getValueForHeader_(header, payload, inventoryItem));
  const targetRange = sheet.getRange(nextRow, 1, 1, values.length);

  try {
    targetRange.setValues([values]);
  } catch (error) {
    if (!String(error.message || "").includes("資料驗證")) {
      throw error;
    }

    allowInvalidDataForExistingValidations_(targetRange);
    targetRange.setValues([values]);
  }
}

function allowInvalidDataForExistingValidations_(range) {
  const validations = range.getDataValidations();
  const softenedValidations = validations.map(row => row.map(rule => {
    if (!rule) return null;
    return rule.copy().setAllowInvalid(true).build();
  }));

  range.setDataValidations(softenedValidations);
}

function findFirstEmptyRecordRow_(sheet, headers, headerRow) {
  const firstDataRow = headerRow + 1;
  const maxRows = Math.max(sheet.getMaxRows(), firstDataRow);
  const keyColumns = ["日期", "耗材編號", "數量", "館室"]
    .map(header => headers.indexOf(header))
    .filter(index => index >= 0);

  if (keyColumns.length === 0) {
    return Math.max(sheet.getLastRow() + 1, firstDataRow);
  }

  const rowCount = maxRows - headerRow;
  const values = sheet.getRange(firstDataRow, 1, rowCount, headers.length).getDisplayValues();

  for (let rowIndex = 0; rowIndex < values.length; rowIndex++) {
    const isEmpty = keyColumns.every(columnIndex => String(values[rowIndex][columnIndex] || "").trim() === "");
    if (isEmpty) {
      return firstDataRow + rowIndex;
    }
  }

  sheet.insertRowsAfter(maxRows, 20);
  return maxRows + 1;
}

function getValueForHeader_(header, payload, inventoryItem) {
  const key = String(header || "").trim();
  const quantity = Number(payload.quantity || 0);

  const values = {
    "送出時間": payload.submittedAt || new Date(),
    "日期": payload.date || "",
    "類型": payload.transactionType || "",
    "耗材編號": payload.itemCode || "",
    "耗材名稱": payload.itemName || inventoryItem["耗材名稱"] || "",
    "類別": payload.category || inventoryItem["類別"] || "",
    "規格/型號": payload.spec || inventoryItem["規格/型號"] || "",
    "規格": payload.spec || inventoryItem["規格/型號"] || "",
    "數量": quantity,
    "單位": payload.unit || inventoryItem["單位"] || "",
    "供應商": payload.party || "",
    "領用人": payload.party || "",
    "來源/領用": payload.party || "",
    "經手人": "",
    "館室": payload.room || inventoryItem["館室"] || "",
    "異動前庫存": Number(payload.beforeStock || 0),
    "異動後庫存": Number(payload.afterStock || 0),
    "備註": payload.note || ""
  };

  return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : "";
}

function jsonOutput_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function callbackOutput_(callback, data) {
  const safeCallback = /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback) ? callback : "transactionCallback";
  return ContentService
    .createTextOutput(safeCallback + "(" + JSON.stringify(data) + ");")
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
