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