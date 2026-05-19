// 1. 綁定你的 Google Apps Script API 網址 (已自動為你保留此網址)
const API_URL = "https://script.google.com/macros/s/AKfycbz-Xsn1-43FoszRayoyrX0b0BeNeyKdKv6WowOvW0CCwnwIBbKTRDGOKHAbfvvmQUvG/exec";

// 初始化 ECharts 圖表控制實例
var donutChart = echarts.init(document.getElementById('donut-chart'));
var lineChart = echarts.init(document.getElementById('line-chart'));

// 主程式：抓取資料、計算統計、繪製表格與圖表
function initDashboard() {
    const tbody = document.getElementById('inventory-table-body');
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px; color: #94a3b8;">正在即時同步雲端資料庫...</td></tr>';

    // 向 Google Sheet 請求真實資料
    fetch(API_URL)
        .then(response => response.json())
        .then(result => {
            if (result.status === "success") {
                tbody.innerHTML = ''; // 清除讀取中文字

                // 用於統計環形圖的計數器 (讓網頁自己算，不用人工手輸入)
                let statusCounts = { "足夠": 0, "庫存偏低": 0, "需補貨": 0, "缺貨": 0 };

                // 遍歷 Google Sheet 回傳的每一筆資料
                result.data.forEach(item => {
                    // 排除試算表最底部的空白列
                    if (!item['耗材編號'] || item['耗材編號'].toString().trim() === '') return;

                    // 精準對接你的 15 個欄位結構
                    let code = item['耗材編號'] || '-';
                    let name = item['耗材名稱'] || '-';
                    let spec = item['規格/型號'] || '-';
                    let room = item['館室'] || '-';
                    let location = item['存放位置'] || '-';
                    let currentStock = item['目前庫存量'] !== undefined ? item['目前庫存量'] : 0;
                    let safeStock = item['安全庫存量'] !== undefined ? item['安全庫存量'] : 0;
                    let status = item['庫存狀態'] || '足夠';

                    // 累加狀態數量，用來畫圓餅圖
                    if (statusCounts[status] !== undefined) {
                        statusCounts[status]++;
                    } else {
                        // 防止名稱有些微落差 (如：需補貨 / 庫存偏低)
                        if (status === '需補貨') statusCounts['需補貨']++;
                        else statusCounts['足夠']++;
                    }

                    // 動態判斷狀態標籤顏色
                    let statusColor = '#3b82f6'; // 預設 藍色 (足夠)
                    let statusBg = 'rgba(59, 130, 246, 0.2)';
                    
                    if (status === '缺貨') {
                        statusColor = '#ef4444'; // 紅色
                        statusBg = 'rgba(239, 68, 68, 0.2)';
                    } else if (status === '需補貨' || status === '庫存偏低') {
                        statusColor = '#f59e0b'; // 橘色
                        statusBg = 'rgba(245, 158, 11, 0.2)';
                    }

                    // 組合表格 Row 的 HTML
                    let rowHtml = `
                        <tr style="border-bottom: 1px solid #1e293b; color: #e2e8f0;">
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
                });

                // 【即時重新繪製環形圖】使用剛剛前端自己加總計算出來的最新結果
                renderDonutChart(statusCounts);
                
                // 【繪製折線圖】(目前先以預設數據建立，未來可讀取您的出入庫紀錄工作表分頁)
                renderLineChart();
            }
        })
        .catch(error => {
            console.error("讀取資料失敗:", error);
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #ef4444; padding: 20px;">資料同步失敗，請確認 API 設定或雲端權限</td></tr>';
        });
}

// 動態繪製環形圖的函數
function renderDonutChart(counts) {
    var donutOption = {
        tooltip: { trigger: 'item' },
        color: ['#3b82f6', '#f59e0b', '#e11d48', '#ef4444'], // 藍(足夠)、橘(庫存偏低/需補貨)、深紅、亮紅(缺貨)
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
                    { value: 0, name: '即將耗盡' },
                    { value: counts['缺貨'], name: '缺貨' }
                ]
            }
        ]
    };
    donutChart.setOption(donutOption);
}

// 繪製折線圖的函數 (預留給未來出入庫統計使用)
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
            data: ['05/05', '05/06', '05/07', '05/08', '05/09', '05/10', '05/11'],
            axisLabel: { color: '#94a3b8' }
        },
        yAxis: { 
            type: 'value', 
            splitLine: { lineStyle: { color: '#1e293b' } },
            axisLabel: { color: '#94a3b8' }
        },
        series: [
            { name: '入庫數量', type: 'line', data: [5, 12, 8, 15, 6, 20, 10], itemStyle: { color: '#3b82f6' }, smooth: true },
            { name: '出庫數量', type: 'line', data: [2, 8, 5, 10, 4, 15, 8], itemStyle: { color: '#94a3b8' }, smooth: true }
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
