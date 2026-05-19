// 1. 保留你目前設定的最新 Google 部署 URL
const API_URL = "https://script.google.com/macros/s/AKfycbyohRUonPSdTW8c8yG9_HJEv-G8s_Nz7GXSOCoPV13N_f4Jqka7m0AhHRsTqZVUxotQ/exec";

// 初始化 ECharts 圖表
const hasEcharts = typeof echarts !== 'undefined';
var allCategoryChart = hasEcharts ? echarts.init(document.getElementById('all-category-chart')) : null;
var shortageCategoryChart = hasEcharts ? echarts.init(document.getElementById('shortage-category-chart')) : null;
let inventoryData = [];

if (!hasEcharts) {
    showChartFallback('圖表元件載入失敗，請確認網路連線後重新整理頁面。');
}

function initDashboard() {
    const tbody = document.getElementById('inventory-table-body');
    if (tbody) {
        showTableMessage(tbody, '正在即時同步雲端資料庫...');
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
                const validData = data.filter(item => item['耗材編號'] && item['耗材編號'].toString().trim() !== '');
                inventoryData = validData;
                if (tbody) tbody.textContent = '';

                let totalItems = 0;
                let totalStockAmount = 0;
                let lowStockCount = 0;
                let outOfStockCount = 0;   
                let statusCounts = { "足夠": 0, "庫存偏低": 0, "需補貨": 0, "缺貨": 0 };

                validData.forEach(item => {
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

                    if (tbody && shouldShowInInventoryTable(status)) {
                        const row = document.createElement('tr');
                        row.className = 'inventory-row';

                        appendCell(row, code);
                        appendCell(row, name, 'item-name');
                        appendCell(row, spec, 'muted');
                        appendCell(row, room, 'muted');
                        appendCell(row, location, 'muted');
                        appendCell(row, currentStock, currentStock <= safeStock ? 'stock-warning' : 'stock-ok');
                        appendCell(row, safeStock, 'muted');

                        const statusCell = appendCell(row, '');
                        const badge = document.createElement('span');
                        badge.className = 'status-badge';
                        badge.textContent = status;
                        badge.style.backgroundColor = statusBg;
                        badge.style.color = statusColor;
                        statusCell.appendChild(badge);

                        tbody.appendChild(row);
                    }
                });

                if (tbody && tbody.children.length === 0) {
                    showTableMessage(tbody, '目前沒有缺貨或需補貨項目');
                }

                // 更新頂部卡片的真實數字
                updateDashboardSummary(totalItems, lowStockCount, outOfStockCount);
                // 重新繪製圓餅圖
                renderAllCategoryChart(validData);
                renderShortageCategoryChart(validData);
                // 顯示各館室缺貨物品
                renderRoomShortages(validData);
                renderMaterialsPage();
            }
        })
        .catch(error => {
            console.error("讀取資料失敗:", error);
            if (tbody) {
                showTableMessage(tbody, '資料同步失敗，請確認 API 網址是否正確', 'error');
            }
        });
}

function appendCell(row, value, className) {
    const cell = document.createElement('td');
    cell.textContent = value;
    if (className) cell.className = className;
    row.appendChild(cell);
    return cell;
}

function showTableMessage(tbody, message, type) {
    tbody.textContent = '';
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = tbody.id === 'materials-table-body' ? 9 : 8;
    cell.className = type === 'error' ? 'table-message error' : 'table-message';
    cell.textContent = message;
    row.appendChild(cell);
    tbody.appendChild(row);
}

function showChartFallback(message) {
    document.querySelectorAll('#all-category-chart, #shortage-category-chart').forEach(chart => {
        chart.classList.add('chart-fallback');
        chart.textContent = message;
    });
}

function shouldShowInInventoryTable(status) {
    return status === '缺貨' || status === '需補貨';
}

function initNavigation() {
    document.querySelectorAll('.sidebar a[data-page]').forEach(link => {
        link.addEventListener('click', event => {
            event.preventDefault();
            switchPage(link.dataset.page);
        });
    });
}

function switchPage(page) {
    document.querySelectorAll('.view-section').forEach(section => {
        section.classList.remove('active-view');
    });

    const target = document.getElementById(`${page}-view`);
    if (target) target.classList.add('active-view');

    document.querySelectorAll('.sidebar li').forEach(item => {
        item.classList.remove('active');
    });

    const activeLink = document.querySelector(`.sidebar a[data-page="${page}"]`);
    if (activeLink) activeLink.parentElement.classList.add('active');

    const pageTitle = document.getElementById('page-title');
    if (pageTitle) {
        pageTitle.textContent = page === 'materials' ? '耗材管理' : '耗材盤點系統';
    }

    if (page === 'materials') renderMaterialsPage();
    if (page === 'dashboard') {
        if (allCategoryChart) allCategoryChart.resize();
        if (shortageCategoryChart) shortageCategoryChart.resize();
    }
}

function initMaterialControls() {
    const searchInput = document.getElementById('materials-search');
    const statusFilter = document.getElementById('materials-status-filter');
    const roomFilter = document.getElementById('materials-room-filter');

    [searchInput, statusFilter, roomFilter].forEach(control => {
        if (control) control.addEventListener('input', renderMaterialsPage);
    });
}

function renderMaterialsPage() {
    const tbody = document.getElementById('materials-table-body');
    const count = document.getElementById('materials-count');
    const searchInput = document.getElementById('materials-search');
    const statusFilter = document.getElementById('materials-status-filter');
    const roomFilter = document.getElementById('materials-room-filter');

    if (!tbody) return;

    updateRoomFilterOptions();

    const query = (searchInput ? searchInput.value : '').trim().toLowerCase();
    const selectedStatus = statusFilter ? statusFilter.value : 'all';
    const selectedRoom = roomFilter ? roomFilter.value : 'all';

    const filteredData = inventoryData.filter(item => {
        const status = (item['庫存狀態'] || '足夠').toString().trim();
        const room = (item['館室'] || '未分類').toString().trim();
        const text = [
            item['耗材編號'],
            item['耗材名稱'],
            item['類別'],
            item['規格/型號'],
            item['館室'],
            item['存放位置']
        ].join(' ').toLowerCase();

        const matchesQuery = !query || text.includes(query);
        const matchesStatus = selectedStatus === 'all' || status === selectedStatus;
        const matchesRoom = selectedRoom === 'all' || room === selectedRoom;

        return matchesQuery && matchesStatus && matchesRoom;
    });

    tbody.textContent = '';

    if (count) {
        count.textContent = `共 ${filteredData.length} 項符合條件，全部耗材 ${inventoryData.length} 項`;
    }

    if (filteredData.length === 0) {
        showTableMessage(tbody, '沒有符合條件的耗材項目');
        return;
    }

    filteredData.forEach(item => {
        const currentStock = item['目前庫存量'] !== undefined ? Number(item['目前庫存量']) : 0;
        const safeStock = item['安全庫存量'] !== undefined ? Number(item['安全庫存量']) : 0;
        const status = (item['庫存狀態'] || '足夠').toString().trim();
        const statusStyle = getStatusStyle(status);
        const row = document.createElement('tr');
        row.className = 'inventory-row';

        appendCell(row, item['耗材編號'] || '-');
        appendCell(row, item['耗材名稱'] || '-', 'item-name');
        appendCell(row, item['類別'] || '未分類', 'muted');
        appendCell(row, item['規格/型號'] || '-', 'muted');
        appendCell(row, item['館室'] || '-', 'muted');
        appendCell(row, item['存放位置'] || '-', 'muted');
        appendCell(row, currentStock, currentStock <= safeStock ? 'stock-warning' : 'stock-ok');
        appendCell(row, safeStock, 'muted');

        const statusCell = appendCell(row, '');
        const badge = document.createElement('span');
        badge.className = 'status-badge';
        badge.textContent = status;
        badge.style.backgroundColor = statusStyle.background;
        badge.style.color = statusStyle.color;
        statusCell.appendChild(badge);

        tbody.appendChild(row);
    });
}

function updateRoomFilterOptions() {
    const roomFilter = document.getElementById('materials-room-filter');
    if (!roomFilter) return;

    const selectedRoom = roomFilter.value;
    const rooms = [...new Set(inventoryData.map(item => (item['館室'] || '未分類').toString().trim()))].sort();

    roomFilter.textContent = '';
    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = '全部館室';
    roomFilter.appendChild(allOption);

    rooms.forEach(room => {
        const option = document.createElement('option');
        option.value = room;
        option.textContent = room;
        roomFilter.appendChild(option);
    });

    roomFilter.value = rooms.includes(selectedRoom) ? selectedRoom : 'all';
}

function getStatusStyle(status) {
    if (status === '缺貨') return { color: '#ef4444', background: 'rgba(239, 68, 68, 0.2)' };
    if (status === '需補貨' || status === '庫存偏低') return { color: '#f59e0b', background: 'rgba(245, 158, 11, 0.2)' };
    return { color: '#3b82f6', background: 'rgba(59, 130, 246, 0.2)' };
}

// 動態修改網頁上方卡片數字
function updateDashboardSummary(totalItems, lowStock, outOfStock) {
    const cardValues = document.querySelectorAll('.summary-cards .card .number');

    if (cardValues && cardValues.length >= 3) {
        cardValues[0].innerHTML = `${totalItems} <span style="font-size: 14px; font-weight: normal; color: #94a3b8;">項</span>`;
        cardValues[1].innerHTML = `${lowStock} <span style="font-size: 14px; font-weight: normal; color: #94a3b8;">項</span>`;
        cardValues[2].innerHTML = `${outOfStock} <span style="font-size: 14px; font-weight: normal; color: #94a3b8;">項</span>`;
    }
}

function renderAllCategoryChart(data) {
    if (!allCategoryChart) return;

    const categoryCounts = {};

    data.forEach(item => {
        const category = String(item['類別'] || '未分類').trim();

        if (!categoryCounts[category]) {
            categoryCounts[category] = 0;
        }

        categoryCounts[category]++;
    });

    const chartData = Object.keys(categoryCounts).map(category => ({
        name: category,
        value: categoryCounts[category]
    }));

    allCategoryChart.setOption({
        tooltip: { trigger: 'item' },
        legend: {
            orient: 'vertical',
            right: 10,
            top: 'center',
            textStyle: { color: '#94a3b8' }
        },
        series: [{
            name: '所有耗材比例',
            type: 'pie',
            radius: ['40%', '70%'],
            itemStyle: {
                borderRadius: 8,
                borderColor: '#111827',
                borderWidth: 2
            },
            label: { color: '#e2e8f0' },
            data: chartData
        }]
    });
}

function renderShortageCategoryChart(data) {
    if (!shortageCategoryChart) return;

    const categoryCounts = {};

    data.forEach(item => {
        const category = String(item['類別'] || '未分類').trim();
        const status = (item['庫存狀態'] || '').trim();

        if (
            status === '缺貨' ||
            status === '需補貨' ||
            status === '庫存偏低'
        ) {
            if (!categoryCounts[category]) {
                categoryCounts[category] = 0;
            }

            categoryCounts[category]++;
        }
    });

    const chartData = Object.keys(categoryCounts).map(category => ({
        name: category,
        value: categoryCounts[category]
    }));

    shortageCategoryChart.setOption({
        tooltip: { trigger: 'item' },
        legend: {
            orient: 'vertical',
            right: 10,
            top: 'center',
            textStyle: { color: '#94a3b8' }
        },
        series: [{
            name: '缺料比例',
            type: 'pie',
            radius: ['40%', '70%'],
            itemStyle: {
                borderRadius: 8,
                borderColor: '#111827',
                borderWidth: 2
            },
            label: { color: '#e2e8f0' },
            data: chartData
        }]
    });
}

function renderRoomShortages(data) {
    const container = document.getElementById('room-shortage-list');

    if (!container) return;

    const grouped = {};

    data.forEach(item => {
        const status = (item['庫存狀態'] || '').trim();

        if (status === '缺貨' || status === '需補貨') {
            const room = item['館室'] || '未分類';

            if (!grouped[room]) {
                grouped[room] = [];
            }

            grouped[room].push(item['耗材名稱']);
        }
    });

    container.textContent = '';

    Object.keys(grouped).forEach(room => {
        const group = document.createElement('div');
        group.className = 'room-shortage-group';

        const title = document.createElement('h4');
        title.textContent = room;
        group.appendChild(title);

        const tags = document.createElement('div');
        tags.className = 'shortage-tags';

        grouped[room].forEach(name => {
            const tag = document.createElement('span');
            tag.textContent = name || '-';
            tags.appendChild(tag);
        });

        group.appendChild(tags);
        container.appendChild(group);
    });

    if (Object.keys(grouped).length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = '目前沒有缺貨或需補貨項目';
        container.appendChild(empty);
    }
}

window.addEventListener('resize', function() {
    if (allCategoryChart) allCategoryChart.resize();
    if (shortageCategoryChart) shortageCategoryChart.resize();
});

// 啟動主程式
initNavigation();
initMaterialControls();
initDashboard();
