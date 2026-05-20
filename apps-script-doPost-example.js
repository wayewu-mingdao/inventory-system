/**
 * Paste this full script into the Google Apps Script project that serves API_URL.
 *
 * Expected sheets:
 * - 耗材主資料: row 3 is the header row, row 4+ contains item rows.
 * - 入庫紀錄: existing sheet, row 3 is the header row.
 * - 出庫紀錄: existing sheet, row 3 is the header row.
 *
 * The script only appends transaction records. It does not create sheets and
 * does not directly update 耗材主資料, so your sheet formulas can summarize stock.
 */

function doGet() {
  const sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName("耗材主資料");

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

  return ContentService
    .createTextOutput(JSON.stringify({
      status: "success",
      data: result
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const inventoryItem = findInventoryItem_(spreadsheet, payload);
    const logSheetName = getTransactionLogSheetName_(payload);
    const logSheet = spreadsheet.getSheetByName(logSheetName);

    if (!logSheet) {
      throw new Error("找不到「" + logSheetName + "」工作表");
    }

    appendRecordByHeaders_(logSheet, payload, inventoryItem);

    return jsonOutput_({
      success: true,
      message: "saved",
      sheetName: logSheetName,
      itemCode: payload.itemCode,
      room: payload.room,
      location: payload.location
    });
  } catch (error) {
    return jsonOutput_({
      success: false,
      message: error.message
    });
  }
}

function getTransactionLogSheetName_(payload) {
  if (payload.action === "outbound" || payload.transactionType === "出庫") {
    return "出庫紀錄";
  }

  return "入庫紀錄";
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
  const locationIndex = headers.indexOf("存放位置");

  if (codeIndex < 0) return {};

  const matchedRow = rows.find(row => {
    const sameCode = String(row[codeIndex] || "") === String(payload.itemCode || "");
    const sameRoom = roomIndex < 0 || String(row[roomIndex] || "") === String(payload.room || "");
    const sameLocation = locationIndex < 0 || String(row[locationIndex] || "") === String(payload.location || "");
    return sameCode && sameRoom && sameLocation;
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
  const nextRow = Math.max(sheet.getLastRow() + 1, headerRow + 1);
  const values = headers.map(header => getValueForHeader_(header, payload, inventoryItem));

  sheet.getRange(nextRow, 1, 1, values.length).setValues([values]);
}

function getValueForHeader_(header, payload, inventoryItem) {
  const key = String(header || "").trim();
  const quantity = Number(payload.quantity || 0);
  const unitPrice = Number(payload.unitPrice || 0);

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
    "單價": unitPrice || "",
    "總價": unitPrice ? unitPrice * quantity : "",
    "供應商": payload.party || "",
    "領用人": payload.party || "",
    "來源/領用": payload.party || "",
    "經手人": "",
    "館室": payload.room || inventoryItem["館室"] || "",
    "存放位置": payload.location || inventoryItem["存放位置"] || "",
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
