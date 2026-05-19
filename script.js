// 1. 綁定你的 Google Apps Script API 網址
const API_URL = "https://script.google.com/macros/s/AKfycbz-Xsn1-43FoszRayoyrX0b0BeNeyKdKv6WowOvW0CCwnwIBbKTRDGOKHAbfvvmQUvG/exec";

// 初始化 ECharts 圖表控制實例
var donutChart = echarts.init(document.getElementById('donut-chart'));
var lineChart = echarts.init(document.getElementById('line-chart'));

// 主程式：即時同步雲端資料庫並動態計算所有數據
function initDashboard() {
    const tbody = document.getElementById('inventory-table-body');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px; color: #94a3b8;">正在即時同步雲端資料庫...</td></tr>';
    }

    // 向 Google Sheet 請求真實資料
    fetch(API_URL)
        .then(response => response.json())
        .then(result => {
            if (result.status === "success") {
                if (tbody) tbody.innerHTML = ''; // 清除讀取中文字

                // 建立統計計數器，用來動態更新上方的數字卡片與圓餅圖
                let totalItems = 0;       // 耗材總數 (有幾筆)
                let totalStockAmount = 0;  // 庫存總數量 (全部加起來幾件)
                let lowStockCount = 0;     // 低庫存項目 (需補貨/庫存偏低)
                let outOfStockCount = 0;   // 即將耗盡/缺貨

                let statusCounts = { "足夠": 0, "庫存偏低": 0, "需補貨": 0, "缺貨": 0 };

                // 遍歷 Google Sheet 回傳的每一筆資料
                result.data.forEach(item => {
                    // 排除試算表最底部的空白列（如果沒編號或名稱就跳過）
                    if (!item['耗材編號'] || item['耗材編號'].toString().trim() === '') return;

                    // 1. 抓取資料庫 15 欄位中的核心前端欄位
                    let code = item['耗材編號'] || '-';
                    let name = item['耗材名稱'] || '-';
                    let spec = item['規格/型號'] || '-';
                    let room = item['館室'] || '-';
                    let location = item['存放位置'] || '-';
                    let currentStock = item['目前庫存量'] !== undefined ? Number(item['目前庫存量']) : 0;
                    let safeStock = item['安全庫存量'] !== undefined ? Number(item['安全庫存量']) : 0;
                    let status = (item['庫存狀態'] || '足夠').toString().trim();

                    // 2. 累加統計數字 (用來動態修改上方的頂部卡片)
                    totalItems++;
                    totalStockAmount += currentStock;
                    
                    if (status === '缺貨') {
                        outOfStockCount++;
                        statusCounts['缺貨']++;
                    } else if (status === '需補貨' || status === '庫存偏低') {
                        lowStockCount++;
                        statusCounts['庫存偏低']++;
                    } else {
                        statusCounts['足夠']++;
                    }

                    // 3. 動態判斷網頁表格中的標籤顏色
                    let statusColor = '#3b82f6'; // 預設藍色 (足夠)
                    let statusBg = 'rgba(59, 130, 246, 0.2)';
                    
                    if (status === '缺貨') {
                        statusColor = '#ef4444'; // 紅色
                        statusBg = 'rgba(239, 68, 68, 0.2)';
                    } else if (status === '需補貨' || status === '庫存偏低') {
                        statusColor = '#f59e0b'; // 橘色
                        statusBg = 'rgba(245, 158, 11, 0.2)';
                    }

                    // 4. 渲染表格橫列 (Row)
                    if (tbody) {
                        let rowHtml = `
                            <tr style="border-bottom: 1px solid #1e293b; color: #e2e8f0; text-align: left;">
                                <td style="padding: 12px;">${code}</td>
                                <td style="padding: 12px; font-weight: bold;">${name}</td>
                                <td style="padding: 12px; color: #94a3b8;">${spec}</td>
                                <td style="padding: 12px; color: #94a3b8;">${room}</td>
                                <td style="padding: 12px; color: #94a3b8;">${location}</td>
                                <td style="padding: 12px; color: ${currentStock <= safeStock ? '#ef4444' : '#e2e8f0'}; font-weight: bold;">${currentStock}</td>
                                <td style="padding: 12px; color: #94a3b8;">${safeStock}</td>
                                <td style="padding: 12px;">
                                    <span style="background-color: ${statusBg}; color: ${statusColor}; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">
                                        ${status}
                                    </span>
                                </td>
                            </tr>
                        `;
                        tbody.innerHTML += rowHtml;
                    }
                });

                // 5. 將計算出來的真實統計數字，塞回網頁上方的四大數據卡片中
                updateSummaryCards(totalItems, totalStockAmount, lowStockCount, outOfStockCount);

                // 6. 即時重新繪製環形圖（數據不再寫死）
                renderDonutChart(statusCounts);
                
                // 7. 繪製折線圖
                renderLineChart();
            }
        })
        .catch(error => {
            console.error("讀取資料失敗:", error);
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #ef4444; padding: 20px;">資料同步失敗，請確認 API 設定或雲端權限</td></tr>';
            }
        });
}

// 動態更新頂部數字卡片的函數
function updateSummaryCards(totalItems, totalStock, lowStock, outOfStock) {
    // 尋找網頁中的數字元素並用真實數據替換
    const cards = document.querySelectorAll('.card-value');
    if (cards && cards.length >= 4) {
        cards[0].childNodes[0].nodeValue = totalItems.toLocaleString() + ' ';
        cards[1].childNodes[0].nodeValue = totalStock.toLocaleString() + ' ';
        cards[2].childNodes[0].nodeValue = lowStock.toLocaleString() + ' ';
        cards[3].childNodes[0].nodeValue = outOfStock.toLocaleString() + ' ';
    }
}

// 動態繪製環形圖的函數
function renderDonutChart(counts) {
    var donutOption = {
        tooltip: { trigger: 'item' },
        color: ['#3b82f6', '#f59e0b', '#ef4444'], // 藍(充足)、橘(偏低)、紅(缺貨)
        series: [
            {
                name: '庫存狀態占比',
                type: 'pie',
                radius: ['40%', '70%'],
                itemStyle: {
                    borderRadius: 8,
                    borderColor: '#111827',
                    borderWidth: 2
                },
                data: [
                    { value: counts['足夠'], name: '庫存充足' },
                    { value: counts['庫存偏低'] || counts['需補貨'], name: '庫存偏低' },
                    { value: counts['缺貨'], name: '缺貨' }
                ]
            }
        ]
    };
    donutChart.setOption(donutOption);
}

// 繪製折線圖的函數 (目前保留基本樣式，未來接上歷史紀錄分頁可動態呈現)
function renderLineChart() {
    var lineOption = {
        tooltip: { trigger: 'axis' },
        legend: { 
            data: ['入庫數量', '出庫數量'], 
            textStyle: { color: '#94a3b8' }, 
            left: 'left',
            icon: 'roundRect'
        },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: { 
            type: 'category', 
            boundaryGap: false, 
            data: ['05/13', '05/14', '05/15', '05/16', '05/17', '05/18', '05/19'],
            axisLabel: { color: '#94a3b8' }
        },
        yAxis: { 
            type: 'value', 
            splitLine: { lineStyle: { color: '#1e293b' } },
            axisLabel: { color: '#94a3b8' }
        },
        series: [
            { name: '入庫數量', type: 'line', data: [0, 0, 0, 0, 0, 0, 0], itemStyle: { color: '#3b82f6' }, smooth: true },
            { name: '出庫數量', type: 'line', data: [0, 0, 0, 0, 0, 0, 0], itemStyle: { color: '#94a3b8' }, smooth: true }
        ]
    };
    lineChart.setOption(lineOption);
}

// 讓圖表隨網頁縮放
window.addEventListener('resize', function() {
    donutChart.resize();
    lineChart.resize();
});

// 開啟網頁時自動啟動整個流程
initDashboard();
