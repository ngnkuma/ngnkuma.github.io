/* ======================
   상태
   ====================== */

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

/* ======================
   DOM 참조
   ====================== */

const screenHome       = document.getElementById('screen-home');
const screenGacha      = document.getElementById('screen-gacha');
const kujiListGrid     = document.getElementById('kuji-list-grid');
const probWrapper      = document.getElementById('prob-wrapper');
const resultsWrapper   = document.getElementById('results-wrapper');
const resultsGrid      = document.getElementById('results-grid');
const probabilityTable = document.getElementById('probability-table');

const kujiLinkBadge   = document.getElementById('kuji-link-badge');
const collectionBadge = document.getElementById('collection-badge');
const statPulls       = document.getElementById('total-pulls');
const statSpent       = document.getElementById('total-spent');

const modalOverlay     = document.getElementById('result-modal');
const modalResultsGrid = document.getElementById('modal-results-grid');
const modalTitleText   = document.getElementById('modal-title-text');
const autoSetupModal   = document.getElementById('auto-setup-modal');
const autoItemList     = document.getElementById('auto-item-list');

const btnModalClose = document.getElementById('btn-modal-close');
const btnAuto       = document.getElementById('btn-auto');
const btnAutoClose  = document.getElementById('btn-auto-close');
const btnAutoStart  = document.getElementById('btn-auto-start');
const btnShare      = document.getElementById('btn-share');

/* ======================
   데이터
   ====================== */

async function fetchData() {
    try {
        const [chiikawaRes, naganoRes] = await Promise.all([
            fetch('data/chiikawa.csv'),
            fetch('data/nagano.csv'),
        ]);

        const [chiikawaText, naganoText] = await Promise.all([
            chiikawaRes.text(),
            naganoRes.text(),
        ]);

        kujiData = [
            ...parseCSV(chiikawaText).map(item => ({ ...item, market: 'chiikawa' })),
            ...parseCSV(naganoText).map(item => ({ ...item, market: 'nagano' })),
        ];

        extractKujiMeta();
    } catch (error) {
        alert('데이터 불러오기 실패!');
    }
}

function parseCSV(csvText) {
    const rows = csvText.split(/\r?\n/);
    if (rows.length === 0) return [];

    function parseLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++; // 이스케이프된 큰따옴표 건너뜀
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

    return rows.slice(1).reduce((data, row) => {
        if (!row.trim()) return data;
        const cols = parseLine(row);
        const item = {};
        headers.forEach((header, i) => {
            if (cols[i] !== undefined) item[header] = cols[i];
        });
        if (item.kuji_id) data.push(item);
        return data;
    }, []);
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
                status,
                url:    item.url || '',
            };
        } else {
            const meta = kujiMetaMap[item.kuji_id];
            if (meta.thumb === 'https://via.placeholder.com/300x300?text=No+Image' && item.thumbnail) {
                meta.thumb = item.thumbnail;
            }
            if (status === 'end') meta.status = 'end';
        }
    });
}

/* ======================
   UI — 화면 전환
   ====================== */

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
    screenHome.style.display  = 'block';

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

    activeKujiId    = kujiId;
    currentMarket   = meta.market;
    activeKujiItems = kujiData.filter(item => item.kuji_id === kujiId);
    currentPrice    = parseInt(meta.price, 10);

    applyTheme(currentMarket);

    if (meta.url) {
        kujiLinkBadge.href          = meta.url;
        kujiLinkBadge.style.display = 'block';
    } else {
        kujiLinkBadge.style.display = 'none';
    }

    updateDrawButtons(currentPrice);
    renderProbabilityTable();

    screenHome.style.display  = 'none';
    screenGacha.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'auto' });
}

/* ======================
   UI — 홈 목록
   ====================== */

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

        // hover/터치 시 해당 쿠지 이미지 프리로드
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

/* ======================
   UI — 뽑기 화면
   ====================== */

function updateDrawButtons(price) {
    [1, 3, 5, 10].forEach(n => {
        const btn = document.querySelector(`.draw-btn[data-times="${n}"]`);
        if (btn) {
            btn.innerHTML = `
                <span class="times">${n}회</span>
                <span class="price">${(price * n).toLocaleString()}엔</span>
            `;
        }
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

    const groups = {};
    activeKujiItems.forEach(item => {
        if (!groups[item.grade]) groups[item.grade] = { items: [], totalRate: 0 };
        groups[item.grade].items.push(item);
        groups[item.grade].totalRate += parseFloat(item.rate);
    });

    for (const [grade, data] of Object.entries(groups)) {
        const tRate     = Math.round(data.totalRate * 10) / 10;
        const gradeName = data.items[0].grade_name ? ` ${data.items[0].grade_name}` : '';

        const itemsHTML = data.items.map(item => `
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
            <div class="prob-items-grid">${itemsHTML}</div>
        `;
        probabilityTable.appendChild(section);
    }
}

/* ======================
   UI — 결과 카드
   ====================== */

function renderMainResultsGrid(shouldHighlight = true) {
    resultsGrid.innerHTML = '';

    const counts = {};
    pullHistory.forEach(item => {
        const key = `${item.grade}||${item.name}`;
        counts[key] = (counts[key] || 0) + 1;
    });

    activeKujiItems.forEach(item => {
        const key = `${item.grade}||${item.name}`;
        if (counts[key]) renderResultCard(item, resultsGrid, counts[key], shouldHighlight);
    });

    const totalKinds     = activeKujiItems.length;
    const collectedKinds = Object.keys(counts).length;

    collectionBadge.innerText = `${collectedKinds}/${totalKinds}`;
    collectionBadge.classList.toggle('complete', collectedKinds >= totalKinds);
    collectionBadge.style.display = 'block';
    btnShare.style.display = 'flex';
}

function renderResultCard(item, container, count = 1, shouldHighlight = true) {
    const card = document.createElement('div');
    card.className = 'prize-card';

    const key = `${item.grade}||${item.name}`;

    if (shouldHighlight && container === resultsGrid && lastDrawnItems.includes(key)) {
        card.classList.add('newly-drawn');
    }
    if (item.grade.toUpperCase().includes('A')) {
        card.classList.add('grade-a-border');
    }

    const isSingleGrade = new Set(activeKujiItems.map(i => i.grade)).size === 1;
    const color = getGradeColor(item.grade);

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

/* ======================
   쿠지 로직
   ====================== */

/** 가중치 기반 랜덤 아이템 1개 추출 */
function pickRandomItem(items, totalWeight) {
    let rand = Math.random() * totalWeight;
    for (const item of items) {
        rand -= parseFloat(item.rate);
        if (rand <= 0) return item;
    }
    return items[items.length - 1]; // 부동소수점 오차 대비 폴백
}

function drawItems(times) {
    if (activeKujiItems.length === 0) return alert('상품 정보가 없습니다.');

    const totalWeight = activeKujiItems.reduce((sum, item) => sum + parseFloat(item.rate), 0);

    probWrapper.style.display    = 'none';
    resultsWrapper.style.display = 'block';

    modalTitleText.innerText   = `${times}회 결과`;
    modalResultsGrid.innerHTML = '';
    modalResultsGrid.classList.toggle('is-10-pull', times === 10);

    lastDrawnItems = [];

    for (let i = 0; i < times; i++) {
        const item = pickRandomItem(activeKujiItems, totalWeight);
        lastDrawnItems.push(`${item.grade}||${item.name}`);
        pullHistory.push(item);
        renderResultCard(item, modalResultsGrid, 1, false);
    }

    totalPulls += times;
    totalSpent += currentPrice * times;
    updateStats();

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
    selectedAutoItemKey    = null;

    const isSingleGrade = new Set(activeKujiItems.map(i => i.grade)).size === 1;

    activeKujiItems.forEach(item => {
        const key  = `${item.grade}||${item.name}`;
        const card = document.createElement('div');
        card.className = 'auto-item-card';
        card.innerHTML = `
            <img src="${item.image || 'https://via.placeholder.com/45'}" loading="lazy">
            <div class="auto-item-name">${isSingleGrade ? '' : `[${item.grade}] `}${item.name}</div>
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

    autoSetupModal.style.display = 'none';

    const MAX_DRAWS   = 1000;
    const totalWeight = activeKujiItems.reduce((sum, item) => sum + parseFloat(item.rate), 0);
    let count = 0;

    probWrapper.style.display    = 'none';
    resultsWrapper.style.display = 'block';

    while (count < MAX_DRAWS) {
        const item = pickRandomItem(activeKujiItems, totalWeight);
        pullHistory.push(item);
        count++;
        if (`${item.grade}||${item.name}` === selectedAutoItemKey) break;
    }

    if (count >= MAX_DRAWS) alert('1000회를 돌렸지만 나오지 않아 강제 종료합니다.');

    totalPulls += count;
    totalSpent += currentPrice * count;
    updateStats();

    lastDrawnItems = [selectedAutoItemKey];
    renderMainResultsGrid();
    scrollToNewlyDrawnCard();

    setTimeout(() => {
        alert(`선택한 상품을 뽑기 위해 총 ${count}회를 돌렸습니다.\n${(currentPrice * count).toLocaleString()}엔을 지출했습니다.`);
    }, 150);
}

/* ======================
   유틸
   ====================== */

function updateStats() {
    statPulls.innerText = `${totalPulls}회`;
    statSpent.innerText = `${totalSpent.toLocaleString()}엔`;
}

function scrollToNewlyDrawnCard() {
    setTimeout(() => {
        const card = document.querySelector('.newly-drawn');
        if (!card) return;
        const rect   = card.getBoundingClientRect();
        const target = rect.top + window.pageYOffset - window.innerHeight / 2 + rect.height / 2;
        window.scrollTo({ top: target, behavior: 'smooth' });
    }, 100);
}

function closeModal() {
    modalOverlay.style.display = 'none';
    renderMainResultsGrid(true);
    scrollToNewlyDrawnCard();
}

function resetSimulation() {
    totalPulls    = 0;
    totalSpent    = 0;
    pullHistory   = [];
    lastDrawnItems = [];

    updateStats();

    resultsGrid.innerHTML         = '';
    resultsWrapper.style.display  = 'none';
    collectionBadge.style.display = 'none';
    btnShare.style.display        = 'none';
    probWrapper.style.display     = 'block';

    modalOverlay.style.display    = 'none';
    autoSetupModal.style.display  = 'none';
}

/* ======================
   라우팅
   ====================== */

function handleRoute() {
    const raw  = window.location.hash.replace('#', '');
    const hash = raw || 'chiikawa';

    if (!raw) {
        window.location.hash = hash;
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

/* ======================
   이벤트 바인딩
   ====================== */

function setupEvents() {
    const btnInfo         = document.getElementById('btn-info');
    const tooltipBox      = document.getElementById('tooltip-box');
    const infoWrapper     = document.getElementById('info-tooltip-wrapper');
    const btnTooltipClose = document.getElementById('btn-tooltip-close');

    // 정보 툴팁 (터치 환경만 JS 토글, 마우스 환경은 CSS hover 처리)
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
        btn.addEventListener('click', e => {
            window.location.hash = e.currentTarget.dataset.market;
        });
    });

    // 뽑기 버튼
    document.querySelectorAll('.draw-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            drawItems(parseInt(e.currentTarget.dataset.times, 10));
        });
    });

    // 초기화
    document.getElementById('btn-reset').addEventListener('click', () => {
        resetSimulation();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // 뽑기 결과 모달
    btnModalClose.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', e => {
        if (e.target === modalOverlay) closeModal();
    });

    // 자동 뽑기 모달
    btnAuto.addEventListener('click', openAutoModal);
    btnAutoClose.addEventListener('click', () => { autoSetupModal.style.display = 'none'; });
    autoSetupModal.addEventListener('click', e => {
        if (e.target === autoSetupModal) autoSetupModal.style.display = 'none';
    });
    btnAutoStart.addEventListener('click', executeAutoDraw);

    // X(트위터) 결과 공유
    btnShare.addEventListener('click', () => {
        if (pullHistory.length === 0) return;

        const isJapanese = navigator.language?.startsWith('ja');
        const meta       = kujiMetaMap[activeKujiId];
        const total      = pullHistory.length;

        // 등급별 개수 집계
        // grade(한국어 키)와 grade_jp(일본어 키)를 함께 저장
        const gradeCounts = {};
        pullHistory.forEach(item => {
            const key = item.grade; // 등급 정렬용 기준은 항상 grade
            if (!gradeCounts[key]) {
                gradeCounts[key] = { count: 0, grade_jp: item.grade_jp || item.grade };
            }
            gradeCounts[key].count++;
        });

        const sortedGrades = Object.keys(gradeCounts).sort();

        let text;

        if (isJapanese) {
            const kujiNameJp = meta?.name_jp || meta?.name || 'くじ';
            const gradeLines = sortedGrades
                .map(g => `[${gradeCounts[g].grade_jp}] ×${gradeCounts[g].count}`)
                .join('\n');
            text = `【ナガノオンラインくじシミュレーター】\n「${kujiNameJp}」${total}回引いた結果\n${gradeLines}\nhttps://nagano-kuji.vercel.app`;
        } else {
            const kujiName   = meta?.name || '쿠지';
            const gradeLines = sortedGrades
                .map(g => `[${g}] x${gradeCounts[g].count}`)
                .join('\n');
            text = `【나가노 온라인 쿠지 시뮬레이터】\n${kujiName} ${total}회 결과:\n${gradeLines}\nhttps://nagano-kuji.vercel.app`;
        }

        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
    });
}

/* ======================
   초기 실행
   ====================== */

async function init() {
    setupEvents();
    await fetchData();
    handleRoute();
}

init();
