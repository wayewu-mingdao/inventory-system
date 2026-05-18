// 替換成你剛剛複製的 Google 網址
const API_URL = "https://script.google.com/macros/s/AKfycbz-Xsn1-43FoszRayoyrX0b0BeNeyKdKv6WowOvW0CCwnwIBbKTRDGOKHAbfvvmQUvG/exec";

// 抓取 Google Sheet 資料並填入表格
function fetchInventoryData() {
    fetch(API_URL)
        .then(response => response.json())
        .then(result => {
            if (result.status === "success") {
                const tbody = document.getElementById('inventory-table-body');
                tbody.innerHTML = ''; // 清除「載入中」文字

                // 迴圈把每一筆資料畫成表格的橫列 (Row)
                result.data.forEach(item => {
                    // 因為你的試算表欄位名稱可能跟我的範例稍微不同，這裡先抓幾個常見的欄位
                    // 如果欄位名稱是空的，會顯示 '-'
                    let code = item['耗材編號'] || '-';
                    let name = item['名稱'] || item['耗材名稱'] || '-';
                    let spec = item['規格'] || '-';
                    let stock = item['初始庫存'] || item['庫存數量'] || 0;
                    let safeStock = item['安全庫存'] || 0;

                    let rowHtml = `
                        <tr style="border-bottom: 1px solid #1e293b; color: #e2e8f0;">
                            <td style="padding: 12px;">${code}</td>
                            <td style="padding: 12px;">${name}</td>
                            <td style="padding: 12px;">${spec}</td>
                            <td style="padding: 12px;">${stock}</td>
                            <td style="padding: 12px;">${safeStock}</td>
                            <td style="padding: 12px;">
                                <button style="background: transparent; border: 1px solid #475569; color: #cbd5e1; padding: 4px 12px; border-radius: 4px; cursor: pointer;">查看</button>
                            </td>
                        </tr>
                    `;
                    tbody.innerHTML += rowHtml;
                });
            }
        })
        .catch(error => {
            console.error("讀取資料失敗:", error);
            document.getElementById('inventory-table-body').innerHTML = '<tr><td colspan="6" style="text-align: center; color: #ef4444;">資料讀取失敗，請檢查網址或權限設定</td></tr>';
        });
}

// 執行抓取資料
fetchInventoryData();
// 初始化環形圖
var donutChart = echarts.init(document.getElementById('donut-chart'));
var donutOption = {
    tooltip: { trigger: 'item' },
    color: ['#3b82f6', '#f59e0b', '#ef4444', '#64748b'], // 對應圖片的顏色
    series: [
        {
            name: '庫存狀態',
            type: 'pie',
            radius: ['40%', '70%'],
            itemStyle: {
                borderRadius: 10,
                borderColor: '#111827',
                borderWidth: 2
            },
            data: [
                { value: 876, name: '庫存充足' },
                { value: 23, name: '庫存偏低' },
                { value: 8, name: '即將耗盡' },
                { value: 12, name: '缺貨' }
            ]
        }
    ]
};
donutChart.setOption(donutOption);
// 初始化折線圖 (近7日出入庫統計)
var lineChart = echarts.init(document.getElementById('line-chart'));
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
        axisLabel: { color: '#94a3b8', formatter: function(value) { return value >= 1000 ? (value/1000) + 'K' : value; } }
    },
    series: [
        { 
            name: '入庫數量', 
            type: 'line', 
            data: [4000, 6000, 5000, 8000, 5000, 7000, 4500], 
            itemStyle: { color: '#3b82f6' }, 
            smooth: true 
        },
        { 
            name: '出庫數量', 
            type: 'line', 
            data: [1500, 2000, 3800, 4500, 2000, 3800, 2000], 
            itemStyle: { color: '#94a3b8' }, 
            smooth: true 
        }
    ]
};
lineChart.setOption(lineOption);

// 讓圖表跟著視窗縮放
window.addEventListener('resize', function() {
    donutChart.resize();
    lineChart.resize();
});
