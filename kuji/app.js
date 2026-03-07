/* =============================================
   상태 변수
   ============================================= */

let kujiData = [];
let kujiMetaMap = {};
let currentMarket = 'chiikawa';
let activeKujiId = '';
let activeKujiItems = [];
let currentPrice = 0;

let totalPulls = 0;
let totalSpent = 0;
let pullHistory = [];
let lastDrawnItems = [];
let selectedAutoItemKey = null;


/* =============================================
   DOM 참조
   ============================================= */

const screenHome      = document.getElementById('screen-home');
const screenGacha     = document.getElementById('screen-gacha');
const kujiListGrid    = document.getElementById('kuji-list-grid');
const probWrapper     = document.getElementById('prob-wrapper');
const resultsWrapper  = document.getElementById('results-wrapper');
const resultsGrid     = document.getElementById('results-grid');
const probabilityTable = document.getElementById('probability-table');

const kujiLinkBadge  = document.getElementById('kuji-link-badge');
const collectionBadge = document.getElementById('collection-badge');
const statPulls      = document.getElementById('total-pulls');
const statSpent      = document.getElementById('total-spent');

const modalOverlay    = document.getElementById('result-modal');
const modalResultsGrid = document.getElementById('modal-results-grid');
const modalTitleText  = document.getElementById('modal-title-text');
const autoSetupModal  = document.getElementById('auto-setup-modal');
const autoItemList    = document.getElementById('auto-item-list');

const btnModalClose  = document.getElementById('btn-modal-close');
const btnAuto        = document.getElementById('btn-auto');
const btnAutoClose   = document.getElementById('btn-auto-close');
const btnAutoStart   = document.getElementById('btn-auto-start');
const btnShare       = document.getElementById('btn-share');


/* =============================================
   데이터
   ============================================= */

async function fetchData() {
    try {
        const [chiikawaRes, naganoRes] = await Promise.all([
            fetch('data/chiikawa.csv'),
            fetch('data/nagano.csv')
        ]);

        const chiikawaData = parseCSV(await chiikawaRes.text()).map(item => ({ ...item, market: 'chiikawa' }));
        const naganoData   = parseCSV(await naganoRes.text()).map(item => ({ ...item, market: 'nagano' }));

        kujiData = [...chiikawaData, ...naganoData];
        extractKujiMeta();
    } catch (error) {
        alert('데이터 불러오기 실패!');
    }
}

function parseCSV(csvText) {
    const rows = csvText.split(/\r?\n/);
    if (rows.length === 0) return [];

    // 따옴표를 고려한 CSV 한 줄 파싱
    function parseLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++; // escaped quote ("") 처리
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        return result;
    }

    const headers = parseLine(rows[0]);
    const data = [];

    for (let i = 1; i < rows.length; i++) {
        if (!rows[i].trim()) continue;
        const cols = parseLine(rows[i]);
        const item = {};
        headers.forEach((header, index) => {
            if (cols[index] !== undefined) item[header] = cols[index];
        });
        if (item.kuji_id) data.push(item);
    }
    return data;
}

function extractKujiMeta() {
    kujiMetaMap = {};

    kujiData.forEach(item => {
        if (!item.kuji_id) return;

        const status = item.status ? item.status.toLowerCase().trim() : 'ing';

        if (!kujiMetaMap[item.kuji_id]) {
            kujiMetaMap[item.kuji_id] = {
                id:     item.kuji_id,
                name:   item.kuji_name || item.kuji_id,
                market: item.market,
                thumb:  item.thumbnail || 'https://via.placeholder.com/300x300?text=No+Image',
                price:  item.price || 0,
                status: status,
                url:    item.url || ''
            };
        } else {
            // 썸네일이 없는 경우 뒤에서 채워넣기
            if (!kujiMetaMap[item.kuji_id].thumb.startsWith('https://via.placeholder') === false && item.thumbnail) {
                kujiMetaMap[item.kuji_id].thumb = item.thumbnail;
            }
            // 한 행이라도 'end'면 종료 상태로 표시
            if (status === 'end') {
                kujiMetaMap[item.kuji_id].status = 'end';
            }
        }
    });
}


/* =============================================
   화면 전환
   ============================================= */

function applyTheme(market) {
    document.body.classList.toggle('theme-nagano', market === 'nagano');

    document.querySelectorAll('.market-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.market === market);
    });
}

function showHome(market) {
    currentMarket = market;
    applyTheme(market);

    screenGacha.style.display = 'none';
    screenHome.style.display = 'block';

    resetSimulation();
    renderHomeList();
    window.scrollTo({ top: 0, behavior: 'auto' });
}

function enterGachaRoom(kujiId) {
    const meta = kujiMetaMap[kujiId];
    if (!meta) {
        window.location.hash = currentMarket;
        return;
    }

    activeKujiId = kujiId;
    currentMarket = meta.market;
    applyTheme(currentMarket);

    activeKujiItems = kujiData.filter(item => item.kuji_id === activeKujiId);
    currentPrice = parseInt(meta.price, 10);

    kujiLinkBadge.href = meta.url;
    kujiLinkBadge.style.display = meta.url ? 'block' : 'none';

    updateDrawButtons(currentPrice);
    renderProbabilityTable();

    screenHome.style.display = 'none';
    screenGacha.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'auto' });
}


/* =============================================
   UI 렌더링
   ============================================= */

function renderHomeList() {
    kujiListGrid.innerHTML = '';

    const marketKujis = Object.values(kujiMetaMap)
        .filter(meta => meta.market === currentMarket)
        .reverse();

    if (marketKujis.length === 0) {
        kujiListGrid.innerHTML = '<p style="text-align:center; color:#aaa; width:100%; padding:50px 0;">등록된 쿠지가 없습니다.</p>';
        return;
    }

    marketKujis.forEach(kuji => {
        const card = document.createElement('div');
        card.className = 'kuji-card';
        card.innerHTML = `
            <img src="${kuji.thumb}" class="kuji-thumb${kuji.status === 'end' ? ' ended' : ''}" loading="lazy">
            <div class="kuji-info">
                <h3 class="kuji-title">${kuji.name}</h3>
                <div class="kuji-price">1회 ¥${Number(kuji.price).toLocaleString()}</div>
            </div>
        `;

        card.addEventListener('click', () => {
            window.location.hash = encodeURIComponent(kuji.id);
        });

        // 카드에 마우스를 올리거나 터치할 때 이미지 프리로드
        const preload = () => {
            kujiData
                .filter(item => item.kuji_id === kuji.id && item.image)
                .forEach(item => { new Image().src = item.image; });
        };
        card.addEventListener('mouseenter', preload, { once: true });
        card.addEventListener('touchstart', preload, { once: true, passive: true });

        kujiListGrid.appendChild(card);
    });
}

function updateDrawButtons(price) {
    [1, 3, 5, 10].forEach(times => {
        document.getElementById(`btn-draw-${times}`).innerHTML = `
            <span class="times">${times}회</span>
            <span class="price">${(price * times).toLocaleString()}엔</span>
        `;
    });
}

function getGradeColor(grade) {
    const g = grade.toUpperCase();
    if (g.includes('A')) return '#E37276';
    if (g.includes('B')) return '#fadb5c';
    if (g.includes('C')) return '#c7baf7';
    if (g.includes('D')) return '#a5d2f2';
    return '#b0b0b0';
}

function renderProbabilityTable() {
    probabilityTable.innerHTML = '';

    // grade별로 묶기
    const groups = {};
    activeKujiItems.forEach(item => {
        if (!groups[item.grade]) groups[item.grade] = { items: [], totalRate: 0 };
        groups[item.grade].items.push(item);
        groups[item.grade].totalRate += parseFloat(item.rate);
    });

    for (const [grade, data] of Object.entries(groups)) {
        const tRate = Math.round(data.totalRate * 10) / 10;
        const gradeName = data.items[0].grade_name ? ` ${data.items[0].grade_name}` : '';

        const itemsHtml = data.items.map(item => `
            <div class="prob-item-card">
                <img src="${item.image || 'https://via.placeholder.com/60'}">
                <div class="prob-info">
                    <div class="prob-name">${item.name}</div>
                    <div class="prob-rate">${item.rate}%</div>
                </div>
            </div>
        `).join('');

        const section = document.createElement('div');
        section.className = 'grade-section';
        section.innerHTML = `
            <div class="grade-header" style="border-bottom-color: var(--theme-main);">
                <span style="color: var(--theme-main);">
                    ${grade}${gradeName}
                    <span style="color: #888; font-size: 0.85em;">(${tRate}%)</span>
                </span>
            </div>
            <div class="prob-items-grid">${itemsHtml}</div>
        `;
        probabilityTable.appendChild(section);
    }
}

function renderMainResultsGrid(shouldHighlight = true) {
    resultsGrid.innerHTML = '';

    // 각 상품의 누적 개수 계산
    const groupedCounts = pullHistory.reduce((acc, item) => {
        const key = `${item.grade}||${item.name}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});

    // 원래 상품 순서대로 결과 표시
    activeKujiItems.forEach(item => {
        const key = `${item.grade}||${item.name}`;
        if (groupedCounts[key] > 0) {
            renderResultCard(item, resultsGrid, groupedCounts[key], shouldHighlight);
        }
    });

    const totalKinds     = activeKujiItems.length;
    const collectedKinds = Object.keys(groupedCounts).length;

    collectionBadge.innerText = `${collectedKinds}/${totalKinds}`;
    collectionBadge.classList.toggle('complete', collectedKinds >= totalKinds);
    collectionBadge.style.display = 'block';

    btnShare.style.display = 'flex';
}

function renderResultCard(item, container, count = 1, shouldHighlight = true) {
    const key   = `${item.grade}||${item.name}`;
    const color = getGradeColor(item.grade);

    const isSingleGrade = new Set(activeKujiItems.map(i => i.grade)).size === 1;
    const isNewlyDrawn  = shouldHighlight && container === resultsGrid && lastDrawnItems.includes(key);
    const isGradeA      = item.grade.toUpperCase().includes('A');

    const card = document.createElement('div');
    card.className = 'prize-card'
        + (isNewlyDrawn ? ' newly-drawn' : '')
        + (isGradeA     ? ' grade-a-border' : '');

    let html = '';
    if (container === resultsGrid && count >= 2) {
        html += `<div class="qty-badge">x${count}</div>`;
    }
    if (!isSingleGrade) {
        html += `<div class="prize-grade" style="background-color: ${color};">${item.grade}</div>`;
    }
    html += `
        <img src="${item.image || 'https://via.placeholder.com/150'}" class="prize-img">
        <div class="prize-name" title="${item.name}">${item.name}</div>
    `;

    card.innerHTML = html;
    container.appendChild(card);
}


/* =============================================
   뽑기 로직
   ============================================= */

function pickItem() {
    const totalWeight = activeKujiItems.reduce((sum, item) => sum + parseFloat(item.rate), 0);
    let random = Math.random() * totalWeight;

    for (const item of activeKujiItems) {
        random -= parseFloat(item.rate);
        if (random <= 0) return item;
    }
    return activeKujiItems[activeKujiItems.length - 1]; // 부동소수점 오차 대비 fallback
}

function drawItems(times) {
    if (activeKujiItems.length === 0) return alert('상품 정보가 없습니다.');

    probWrapper.style.display = 'none';
    resultsWrapper.style.display = 'block';

    modalTitleText.innerText = `${times}회 결과`;
    modalResultsGrid.innerHTML = '';
    modalResultsGrid.classList.toggle('is-10-pull', times === 10);

    lastDrawnItems = [];

    for (let i = 0; i < times; i++) {
        const item = pickItem();
        lastDrawnItems.push(`${item.grade}||${item.name}`);
        pullHistory.push(item);
        renderResultCard(item, modalResultsGrid, 1, false);
    }

    totalPulls += times;
    totalSpent += currentPrice * times;
    updateStats();

    // 1회 뽑기는 바로 결과 강조 표시, 복수는 모달로
    if (times === 1) {
        renderMainResultsGrid(true);
        scrollToNewlyDrawnCard();
    } else {
        renderMainResultsGrid(false);
        modalOverlay.style.display = 'flex';
    }
}

function openAutoModal() {
    if (activeKujiItems.length === 0) return alert('상품 정보가 없습니다.');

    autoItemList.innerHTML = '';
    selectedAutoItemKey = null;

    const isSingleGrade = new Set(activeKujiItems.map(i => i.grade)).size === 1;

    activeKujiItems.forEach(item => {
        const key = `${item.grade}||${item.name}`;
        const gradePrefix = isSingleGrade ? '' : `[${item.grade}] `;

        const card = document.createElement('div');
        card.className = 'auto-item-card';
        card.innerHTML = `
            <img src="${item.image || 'https://via.placeholder.com/45'}" loading="lazy">
            <div class="auto-item-name">${gradePrefix}${item.name}</div>
            <div class="auto-item-rate">${item.rate}%</div>
        `;

        card.addEventListener('click', () => {
            document.querySelectorAll('.auto-item-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedAutoItemKey = key;
        });

        autoItemList.appendChild(card);
    });

    autoSetupModal.style.display = 'flex';
}

function executeAutoDraw() {
    if (!selectedAutoItemKey) return alert('상품을 선택해주세요.');

    const MAX_DRAWS = 1000;
    autoSetupModal.style.display = 'none';

    probWrapper.style.display = 'none';
    resultsWrapper.style.display = 'block';

    let count = 0;
    let found = false;

    while (!found && count < MAX_DRAWS) {
        const item = pickItem();
        pullHistory.push(item);
        count++;
        if (`${item.grade}||${item.name}` === selectedAutoItemKey) found = true;
    }

    totalPulls += count;
    totalSpent += currentPrice * count;
    updateStats();

    lastDrawnItems = [selectedAutoItemKey];
    renderMainResultsGrid();
    scrollToNewlyDrawnCard();

    const resultMsg = found
        ? `선택한 상품을 뽑기 위해 총 ${count}회를 돌렸습니다.\n${(currentPrice * count).toLocaleString()}엔을 지출했습니다.`
        : `1000회를 돌렸지만 나오지 않아 강제 종료합니다.`;

    setTimeout(() => alert(resultMsg), 150);
}


/* =============================================
   유틸
   ============================================= */

function updateStats() {
    statPulls.innerText = `${totalPulls}회`;
    statSpent.innerText = `${totalSpent.toLocaleString()}엔`;
}

function scrollToNewlyDrawnCard() {
    setTimeout(() => {
        const card = document.querySelector('.newly-drawn');
        if (!card) return;

        const rect = card.getBoundingClientRect();
        const targetScrollY = rect.top + window.pageYOffset - window.innerHeight / 2 + rect.height / 2;
        window.scrollTo({ top: targetScrollY, behavior: 'smooth' });
    }, 100);
}

function closeModal() {
    modalOverlay.style.display = 'none';
    renderMainResultsGrid(true);
    scrollToNewlyDrawnCard();
}

function resetSimulation() {
    totalPulls = 0;
    totalSpent = 0;
    pullHistory = [];
    lastDrawnItems = [];

    updateStats();

    resultsGrid.innerHTML = '';
    resultsWrapper.style.display = 'none';
    probWrapper.style.display = 'block';
    collectionBadge.style.display = 'none';
    btnShare.style.display = 'none';
    modalOverlay.style.display = 'none';
    autoSetupModal.style.display = 'none';
}


/* =============================================
   해시 라우팅
   ============================================= */

function handleRoute() {
    const hash = window.location.hash.replace('#', '');

    if (!hash) {
        window.location.hash = 'chiikawa';
        return;
    }

    if (hash === 'chiikawa' || hash === 'nagano') {
        showHome(hash);
    } else {
        const kujiId = decodeURIComponent(hash);
        if (kujiMetaMap[kujiId]) {
            enterGachaRoom(kujiId);
        } else {
            window.location.hash = 'chiikawa';
        }
    }
}

window.addEventListener('hashchange', handleRoute);


/* =============================================
   이벤트 바인딩
   ============================================= */

function setupEvents() {
    const btnInfo       = document.getElementById('btn-info');
    const tooltipBox    = document.getElementById('tooltip-box');
    const infoWrapper   = document.getElementById('info-tooltip-wrapper');
    const btnTooltipClose = document.getElementById('btn-tooltip-close');

    // 툴팁: 터치 환경에서는 클릭으로 토글
    btnInfo.addEventListener('click', e => {
        e.stopPropagation();
        if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
        tooltipBox.classList.toggle('show');
    });

    btnTooltipClose?.addEventListener('click', e => {
        e.stopPropagation();
        tooltipBox.classList.remove('show');
    });

    document.addEventListener('click', e => {
        if (!infoWrapper.contains(e.target)) tooltipBox.classList.remove('show');
    });

    // 마켓 탭
    document.querySelectorAll('.market-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            window.location.hash = btn.dataset.market;
        });
    });

    // 뽑기 버튼
    document.querySelectorAll('.draw-btn').forEach(btn => {
        btn.addEventListener('click', () => drawItems(parseInt(btn.dataset.times, 10)));
    });

    // 초기화
    document.getElementById('btn-reset').addEventListener('click', () => {
        resetSimulation();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // 결과 모달
    btnModalClose.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });

    // 자동 뽑기 모달
    btnAuto.addEventListener('click', openAutoModal);
    btnAutoClose.addEventListener('click', () => { autoSetupModal.style.display = 'none'; });
    autoSetupModal.addEventListener('click', e => { if (e.target === autoSetupModal) autoSetupModal.style.display = 'none'; });
    btnAutoStart.addEventListener('click', executeAutoDraw);

    // X(트위터) 결과 공유
    btnShare.addEventListener('click', () => {
        if (pullHistory.length === 0) return;

        const kujiName = kujiMetaMap[activeKujiId]?.name ?? '쿠지';
        const total    = pullHistory.length;

        const gradeCounts = pullHistory.reduce((acc, item) => {
            acc[item.grade] = (acc[item.grade] || 0) + 1;
            return acc;
        }, {});

        const gradeString = Object.keys(gradeCounts).sort()
            .map(g => `[${g.endsWith('상') ? g : g + '상'}] ${gradeCounts[g]}개`)
            .join(', ');

        const text = `【나가노 온라인 쿠지 시뮬레이터】\n${kujiName} ${total}회 결과: ${gradeString}를 획득했습니다.\nhttps://nagano-kuji.vercel.app`;
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
    });
}


/* =============================================
   진입점
   ============================================= */

async function init() {
    setupEvents();
    await fetchData();
    handleRoute();
}

init();
