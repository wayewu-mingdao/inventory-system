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
