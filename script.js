// 1. 保留你目前設定的最新 Google 部署 URL
const API_URL = "https://script.google.com/macros/s/AKfycbwyM2uqVvcFyoMTXpzW54wm0unhQWsPWZ9QFMVlPXOwNs7yoVVQDyZMwdxYqTlAnTXx/exec";
const INVENTORY_CACHE_KEY = 'inventory-system-data-cache';

// 初始化 ECharts 圖表
const hasEcharts = typeof echarts !== 'undefined';
const allCategoryChartElement = document.getElementById('all-category-chart');
const shortageCategoryChartElement = document.getElementById('shortage-category-chart');
var allCategoryChart = hasEcharts && allCategoryChartElement ? echarts.init(allCategoryChartElement) : null;
var shortageCategoryChart = hasEcharts && shortageCategoryChartElement ? echarts.init(shortageCategoryChartElement) : null;
let inventoryData = [];

if (!hasEcharts) {
    showChartFallback('圖表元件載入失敗，請確認網路連線後重新整理頁面。');
}

function initDashboard() {
    const tbody = document.getElementById('inventory-table-body');
    const cachedData = getCachedInventoryData();

    if (cachedData.length) {
        renderInventoryData(cachedData);
    }

    if (tbody && !cachedData.length) {
        showTableMessage(tbody, '正在即時同步雲端資料庫...');
    }

    fetch(API_URL, { cache: 'no-store' })
        .then(response => {
            if (!response.ok) throw new Error("網路連線回應異常");
            return response.json();
        })
        .then(result => {
            console.log("從 Google 抓到的真實資料:", result);

            const data = Array.isArray(result) ? result : result.data;
            if (data && Array.isArray(data)) {
                saveInventoryCache(data);
                renderInventoryData(data);
            }
        })
        .catch(error => {
            console.error("讀取資料失敗:", error);
            if (tbody && !cachedData.length) {
                showTableMessage(tbody, '資料同步失敗，請確認 API 網址是否正確', 'error');
            }
        });
}

function renderInventoryData(data) {
    const tbody = document.getElementById('inventory-table-body');
    const validData = data.filter(item => item['耗材編號'] && item['耗材編號'].toString().trim() !== '');
    inventoryData = validData;
    if (tbody) tbody.textContent = '';

    let totalItems = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    validData.forEach(item => {
        let code = item['耗材編號'] || '-';
        let name = item['耗材名稱'] || '-';
        let spec = item['規格/型號'] || '-';
        let room = item['館室'] || '-';
        let currentStock = item['目前庫存量'] !== undefined ? Number(item['目前庫存量']) : 0;
        let safeStock = item['安全庫存量'] !== undefined ? Number(item['安全庫存量']) : 0;
        let status = (item['庫存狀態'] || '足夠').toString().trim();

        totalItems++;

        if (status === '缺貨') {
            outOfStockCount++;
        } else if (status === '需補貨' || status === '庫存偏低') {
            lowStockCount++;
        }

        const statusStyle = getStatusStyle(status);

        if (tbody && shouldShowInInventoryTable(status)) {
            const row = document.createElement('tr');
            row.className = 'inventory-row';

            appendCell(row, code);
            appendCell(row, name, 'item-name');
            appendCell(row, spec, 'muted');
            appendCell(row, room, 'muted');
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
        }
    });

    if (tbody && tbody.children.length === 0) {
        showTableMessage(tbody, '目前沒有缺貨或需補貨項目');
    }

    updateDashboardSummary(totalItems, lowStockCount, outOfStockCount);
    renderAllCategoryChart(validData);
    renderShortageCategoryChart(validData);
    renderRoomShortages(validData);
    renderMaterialsPage();
    renderTransactionPage();
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

function getCachedInventoryData() {
    try {
        const rawCache = localStorage.getItem(INVENTORY_CACHE_KEY);
        if (!rawCache) return [];

        const cache = JSON.parse(rawCache);
        return Array.isArray(cache.data) ? cache.data : [];
    } catch (error) {
        console.warn('讀取快取資料失敗:', error);
        return [];
    }
}

function saveInventoryCache(data) {
    try {
        localStorage.setItem(INVENTORY_CACHE_KEY, JSON.stringify({
            savedAt: new Date().toISOString(),
            data
        }));
    } catch (error) {
        console.warn('儲存快取資料失敗:', error);
    }
}

function clearInventoryCache() {
    try {
        localStorage.removeItem(INVENTORY_CACHE_KEY);
    } catch (error) {
        console.warn('清除快取資料失敗:', error);
    }
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
            if (!document.getElementById(`${link.dataset.page}-view`)) return;

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
            item['館室']
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

function initTransactionControls() {
    const form = document.getElementById('transaction-form');
    const itemSelect = document.getElementById('transaction-item');
    const quantityInput = document.getElementById('transaction-quantity');
    const categorySelect = document.getElementById('transaction-category');
    const locationSelect = document.getElementById('transaction-location');
    const searchInput = document.getElementById('transaction-search');

    if (!form || !itemSelect || !quantityInput) return;

    const dateInput = document.getElementById('transaction-date');
    if (dateInput && !dateInput.value) {
        dateInput.value = new Date().toISOString().slice(0, 10);
    }

    if (categorySelect) categorySelect.addEventListener('change', renderTransactionItems);
    if (locationSelect) locationSelect.addEventListener('change', updateTransactionPreview);
    if (searchInput) searchInput.addEventListener('input', renderTransactionItems);
    itemSelect.addEventListener('change', () => {
        renderTransactionLocations();
        updateTransactionPreview();
    });
    quantityInput.addEventListener('input', updateTransactionPreview);
    form.addEventListener('reset', () => {
        setTimeout(() => {
            if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
            renderTransactionItems();
            setTransactionStatus('');
        }, 0);
    });
    form.addEventListener('submit', handleTransactionSubmit);
}

function renderTransactionPage() {
    renderTransactionCategories();
    renderTransactionItems();
    renderTransactionLocations();
}

function renderTransactionCategories() {
    const categorySelect = document.getElementById('transaction-category');
    if (!categorySelect) return;

    const currentValue = categorySelect.value;
    const categories = [...new Set(inventoryData
        .map(item => getTransactionCategory(item))
        .filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'zh-Hant'));

    categorySelect.textContent = '';

    const allOption = document.createElement('option');
    allOption.value = '';
    allOption.textContent = '全部類別';
    categorySelect.appendChild(allOption);

    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categorySelect.appendChild(option);
    });

    if (categories.includes(currentValue)) {
        categorySelect.value = currentValue;
    }
}

function renderTransactionLocations() {
    const locationSelect = document.getElementById('transaction-location');
    if (!locationSelect) return;

    const currentValue = locationSelect.value;
    const rows = getTransactionRowsForSelectedProduct();

    locationSelect.textContent = '';

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = rows.length ? '請選擇館室' : '請先選擇耗材';
    locationSelect.appendChild(placeholder);

    rows.forEach(item => {
        const option = document.createElement('option');
        option.value = getTransactionRowKey(item);
        option.textContent = getTransactionLocationLabel(item);
        locationSelect.appendChild(option);
    });

    if (rows.some(item => getTransactionRowKey(item) === currentValue)) {
        locationSelect.value = currentValue;
    } else if (rows.length === 1) {
        locationSelect.value = getTransactionRowKey(rows[0]);
    }
}

function renderTransactionItems() {
    const itemSelect = document.getElementById('transaction-item');
    if (!itemSelect) return;

    const currentValue = itemSelect.value;
    const filteredItems = getFilteredTransactionProducts();
    itemSelect.textContent = '';

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = getTransactionItemPlaceholder(filteredItems.length);
    itemSelect.appendChild(placeholder);

    filteredItems.forEach(item => {
        const option = document.createElement('option');
        const code = item['耗材編號'] || '';
        const name = item['耗材名稱'] || '';
        const spec = item['規格/型號'] ? `｜${item['規格/型號']}` : '';
        option.value = getTransactionProductKey(item);
        option.textContent = `${code}｜${name}${spec}`;
        itemSelect.appendChild(option);
    });

    if (filteredItems.some(item => getTransactionProductKey(item) === currentValue)) {
        itemSelect.value = currentValue;
    }

    renderTransactionLocations();
    updateTransactionPreview();
}

function getFilteredTransactionRows() {
    const categorySelect = document.getElementById('transaction-category');
    const searchInput = document.getElementById('transaction-search');
    const selectedCategory = categorySelect ? categorySelect.value : '';
    const keyword = searchInput ? searchInput.value.trim().toLowerCase() : '';

    return inventoryData.filter(item => {
        const category = getTransactionCategory(item);
        const matchesCategory = !selectedCategory || category === selectedCategory;
        const searchableText = [
            item['耗材編號'],
            item['耗材名稱'],
            getTransactionCategory(item),
            item['規格/型號'],
            item['館室']
        ].map(value => String(value || '').toLowerCase()).join(' ');
        const matchesKeyword = !keyword || searchableText.includes(keyword);

        return matchesCategory && matchesKeyword;
    });
}

function getFilteredTransactionProducts() {
    const seen = new Set();
    const products = [];

    getFilteredTransactionRows().forEach(item => {
        const key = getTransactionProductKey(item);
        if (seen.has(key)) return;
        seen.add(key);
        products.push(item);
    });

    return products;
}

function getTransactionRowsForSelectedProduct() {
    const productKey = getSelectedTransactionProductKey();
    if (!productKey) return [];

    return getFilteredTransactionRows()
        .filter(item => getTransactionProductKey(item) === productKey)
        .sort((a, b) => getTransactionLocationLabel(a).localeCompare(getTransactionLocationLabel(b), 'zh-Hant'));
}

function getTransactionItemPlaceholder(filteredCount) {
    if (!inventoryData.length) return '目前沒有可用耗材資料';
    return filteredCount ? '請選擇耗材' : '沒有符合條件的耗材';
}

function getSelectedTransactionItem() {
    const locationSelect = document.getElementById('transaction-location');
    if (!locationSelect || !locationSelect.value) return null;
    return inventoryData.find(item => getTransactionRowKey(item) === locationSelect.value) || null;
}

function getSelectedTransactionProductKey() {
    const itemSelect = document.getElementById('transaction-item');
    return itemSelect ? itemSelect.value : '';
}

function getTransactionProductKey(item) {
    return encodeURIComponent(String(item['耗材編號'] || '').trim());
}

function getTransactionRowKey(item) {
    return [
        item['耗材編號'],
        item['館室']
    ].map(value => encodeURIComponent(String(value || '').trim())).join('|');
}

function getTransactionCategory(item) {
    const value = item['類別'] || item['耗材類別'] || item['分類'] || '';
    return String(value || '未分類').trim() || '未分類';
}

function getTransactionLocationLabel(item) {
    const room = item['館室'] || '未設定館室';
    return room;
}

function updateTransactionPreview() {
    const transactionType = getTransactionType();
    const item = getSelectedTransactionItem();
    const quantity = getTransactionQuantity();

    const currentStock = item && item['目前庫存量'] !== undefined ? Number(item['目前庫存量']) : 0;
    const afterStock = transactionType === 'outbound' ? currentStock - quantity : currentStock + quantity;

    setText('preview-code', item ? item['耗材編號'] || '-' : '-');
    setText('preview-name', item ? item['耗材名稱'] || '-' : '-');
    setText('preview-current', item ? currentStock : '-');
    setText('preview-after', item ? afterStock : '-');
    setText('preview-location', item ? item['館室'] || '-' : '-');
}

function getTransactionType() {
    const container = document.querySelector('.transaction-layout');
    return container ? container.dataset.transactionType : '';
}

function getTransactionQuantity() {
    const quantityInput = document.getElementById('transaction-quantity');
    return quantityInput ? Number(quantityInput.value || 0) : 0;
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function setTransactionStatus(message, type) {
    const status = document.getElementById('transaction-status');
    if (!status) return;
    status.className = type ? `form-status ${type}` : 'form-status';
    status.textContent = message;
}

function buildTransactionPayload() {
    const transactionType = getTransactionType();
    const item = getSelectedTransactionItem();
    const quantity = getTransactionQuantity();
    const currentStock = item && item['目前庫存量'] !== undefined ? Number(item['目前庫存量']) : 0;
    const afterStock = transactionType === 'outbound' ? currentStock - quantity : currentStock + quantity;

    return {
        action: transactionType,
        transactionType: transactionType === 'outbound' ? '出庫' : '入庫',
        date: document.getElementById('transaction-date')?.value || '',
        itemCode: item?.['耗材編號'] || '',
        itemName: item?.['耗材名稱'] || '',
        itemKey: item ? getTransactionRowKey(item) : '',
        category: item ? getTransactionCategory(item) : '',
        spec: item?.['規格/型號'] || '',
        room: item?.['館室'] || '',
        quantity,
        beforeStock: currentStock,
        afterStock,
        party: document.getElementById('transaction-party')?.value.trim() || '',
        note: document.getElementById('transaction-note')?.value.trim() || '',
        submittedAt: new Date().toISOString()
    };
}

async function handleTransactionSubmit(event) {
    event.preventDefault();

    const transactionType = getTransactionType();
    const item = getSelectedTransactionItem();
    const quantity = getTransactionQuantity();

    if (!getSelectedTransactionProductKey()) {
        setTransactionStatus('請先選擇耗材項目。', 'error');
        return;
    }

    if (!item) {
        setTransactionStatus('請選擇館室。', 'error');
        return;
    }

    if (!quantity || quantity < 1) {
        setTransactionStatus('數量必須大於 0。', 'error');
        return;
    }

    const currentStock = item['目前庫存量'] !== undefined ? Number(item['目前庫存量']) : 0;
    if (transactionType === 'outbound' && quantity > currentStock) {
        setTransactionStatus('出庫數量不能大於目前庫存。', 'error');
        return;
    }

    const submitButton = event.target.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    setTransactionStatus('正在寫入 Google Sheet...', '');

    try {
        const payload = buildTransactionPayload();
        const result = await writeTransactionPayload(payload);

        clearInventoryCache();
        if (!result.success) {
            throw new Error(result.message || 'Google Sheet 回傳寫入失敗');
        }

        setTransactionStatus('已寫入 Google Sheet。', 'success');
        event.target.reset();
    } catch (error) {
        console.error('寫入資料失敗:', error);
        setTransactionStatus(`寫入失敗：${error.message}。請確認 Google Apps Script 已部署 doPost 並允許存取。`, 'error');
    } finally {
        if (submitButton) submitButton.disabled = false;
        updateTransactionPreview();
    }
}

function writeTransactionPayload(payload) {
    return new Promise((resolve, reject) => {
        const callbackName = `transactionCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const script = document.createElement('script');
        const timeout = window.setTimeout(() => {
            cleanup();
            reject(new Error('Google Sheet 寫入逾時'));
        }, 15000);

        function cleanup() {
            window.clearTimeout(timeout);
            delete window[callbackName];
            script.remove();
        }

        window[callbackName] = (result) => {
            cleanup();
            resolve(result || { success: false, message: 'Google Sheet 沒有回傳結果' });
        };

        script.onerror = () => {
            cleanup();
            reject(new Error('無法連線到 Google Apps Script'));
        };

        script.src = `${API_URL}?callback=${encodeURIComponent(callbackName)}&payload=${encodeURIComponent(JSON.stringify(payload))}&t=${Date.now()}`;
        document.body.appendChild(script);
    });
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
initTransactionControls();
initDashboard();
