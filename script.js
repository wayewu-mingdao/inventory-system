// 1. 保留你目前設定的最新 Google 部署 URL
const API_URL = "https://script.google.com/macros/s/AKfycbyohRUonPSdTW8c8yG9_HJEv-G8s_Nz7GXSOCoPV13N_f4Jqka7m0AhHRsTqZVUxotQ/exec";

// 初始化 ECharts 圖表
var donutChart = echarts.init(document.getElementById('donut-chart'));
var lineChart = echarts.init(document.getElementById('line-chart'));

function initDashboard() {
    const tbody = document.getElementById('inventory-table-body');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px; color: #94a3b8;">正在即時同步雲端資料庫...</td></tr>';
    }

    fetch(API_URL)
        .then(response => {
            if (!response.ok) throw new Error("網路連線回應異常");
            return response.json();
        })
        .then(result => {
            console.log("從 Google 抓到的真實資料:", result);
            
            const data = Array.isArray(result) ? result : result.data;
            if (data && Array.isArray(data)) {
                if (tbody) tbody.innerHTML = ''; 

                let totalItems = 0;       
                let totalStockAmount = 0;  
                let lowStockCount = 0;     
                let outOfStockCount = 0;   
                let statusCounts = { "足夠": 0, "庫存偏低": 0, "需補貨": 0, "缺貨": 0 };

                data.forEach(item => {
                    // 排除空白列
                    if (!item['耗材編號'] || item['耗材編號'].toString().trim() === '') return;

                    let code = item['耗材編號'] || '-';
                    let name = item['耗材名稱'] || '-';
                    let spec = item['規格/型號'] || '-';
                    let room = item['館室'] || '-';
                    let location = item['存放位置'] || '-';
                    let currentStock = item['目前庫存量'] !== undefined ? Number(item['目前庫存量']) : 0;
                    let safeStock = item['安全庫存量'] !== undefined ? Number(item['安全庫存量']) : 0;
                    let status = (item['庫存狀態'] || '足夠').toString().trim();

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

                    // 判斷狀態標籤顏色
                    let statusColor = '#3b82f6'; 
                    let statusBg = 'rgba(59, 130, 246, 0.2)';
                    if (status === '缺貨') {
                        statusColor = '#ef4444'; 
                        statusBg = 'rgba(239, 68, 68, 0.2)';
                    } else if (status === '需補貨' || status === '庫存偏低') {
                        statusColor = '#f59e0b'; 
                        statusBg = 'rgba(245, 158, 11, 0.2)';
                    }

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

                // 更新頂部卡片的真實數字
                updateDashboardSummary(totalItems, totalStockAmount, lowStockCount, outOfStockCount);
                // 重新繪製圓餅圖
                renderDonutChart(statusCounts);
                // 重新繪製折線圖
                renderLineChart();
            }
        })
        .catch(error => {
            console.error("讀取資料失敗:", error);
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #ef4444; padding: 20px;">資料同步失敗，請確認 API 網址是否正確</td></tr>';
            }
        });
}

// 動態修改網頁上方卡片數字
function updateDashboardSummary(totalItems, totalStock, lowStock, outOfStock) {
    const cardValues = document.querySelectorAll('.summary-cards .card .number');
    if (cardValues && cardValues.length >= 4) {
        cardValues[0].innerHTML = `${totalItems} <span style="font-size: 14px; font-weight: normal; color: #94a3b8;">項</span>`;
        cardValues[1].innerHTML = `${totalStock} <span style="font-size: 14px; font-weight: normal; color: #94a3b8;">個</span>`;
        cardValues[2].innerHTML = `${lowStock} <span style="font-size: 14px; font-weight: normal; color: #94a3b8;">項</span>`;
        cardValues[3].innerHTML = `${outOfStock} <span style="font-size: 14px; font-weight: normal; color: #94a3b8;">項</span>`;
    }
}

function renderDonutChart(counts) {
    var donutOption = {
        tooltip: { trigger: 'item' },
        color: ['#3b82f6', '#f59e0b', '#ef4444'], 
        series: [
            {
                name: '庫存狀態',
                type: 'pie',
                radius: ['40%', '70%'],
                itemStyle: { borderRadius: 8, borderColor: '#111827', borderWidth: 2 },
                data: [
                    { value: counts['足夠'] || 0, name: '庫存充足' },
                    { value: counts['庫存偏低'] || counts['需補貨'] || 0, name: '庫存偏低' },
                    { value: counts['缺貨'] || 0, name: '缺貨' }
                ]
            }
        ]
    };
    donutChart.setOption(donutOption);
}

function renderLineChart() {
    var lineOption = {
        tooltip: { trigger: 'axis' },
        legend: { data: ['入庫數量', '出庫數量'], textStyle: { color: '#94a3b8' }, left: 'left' },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: { type: 'category', boundaryGap: false, data: ['05/13', '05/14', '05/15', '05/16', '05/17', '05/18', '05/19'], axisLabel: { color: '#94a3b8' } },
        yAxis: { type: 'value', splitLine: { lineStyle: { color: '#1e293b' } }, axisLabel: { color: '#94a3b8' } },
        series: [
            { name: '入庫數量', type: 'line', data: [0, 0, 0, 0, 0, 0, 0], itemStyle: { color: '#3b82f6' }, smooth: true },
            { name: '出庫數量', type: 'line', data: [0, 0, 0, 0, 0, 0, 0], itemStyle: { color: '#94a3b8' }, smooth: true }
        ]
    };
    lineChart.setOption(lineOption);
}

window.addEventListener('resize', function() { donutChart.resize(); lineChart.resize(); });

// 啟動主程式
initDashboard();
