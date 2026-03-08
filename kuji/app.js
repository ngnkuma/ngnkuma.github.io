const MAX_AUTO_DRAWS = 1000; 

const PLACEHOLDER_THUMB = 'https://via.placeholder.com/300x300?text=No+Image';
const PLACEHOLDER_IMG   = 'https://via.placeholder.com/150';

 

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
let collectionCompleteShown = false; 

 

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

 

 
const getItemKey = item => `${item.grade}||${item.name}`;

 
function updateStats() {
    statPulls.innerText = `${totalPulls}회`;
    statSpent.innerText = `${totalSpent.toLocaleString()}엔`;
}

 
function showToast(message, duration = 3000) {
    

    document.getElementById('app-toast')?.remove();

    const toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.className = 'toast';
    toast.innerHTML = message; 

    document.body.appendChild(toast);

    

    requestAnimationFrame(() => {
        requestAnimationFrame(() => toast.classList.add('toast-show'));
    });

    setTimeout(() => {
        toast.classList.remove('toast-show');
        setTimeout(() => toast.remove(), 300); 

    }, duration);
}

 
function scrollToNewlyDrawnCard() {
    setTimeout(() => {
        const card = document.querySelector('.newly-drawn');
        if (!card) return;
        const rect   = card.getBoundingClientRect();
        const target = rect.top + window.scrollY - window.innerHeight / 2 + rect.height / 2;
        window.scrollTo({ top: target, behavior: 'smooth' });
    }, 100);
}

 
function pickRandomItem(items, totalWeight) {
    let rand = Math.random() * totalWeight;
    for (const item of items) {
        rand -= parseFloat(item.rate);
        if (rand <= 0) return item;
    }
    return items[items.length - 1]; 

}

 

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
        showToast('데이터 불러오기 실패!');
    }
}

function parseCSV(csvText) {
    const rows = csvText.split(/\r?\n/);
    if (rows.length <= 1) return []; 

    function parseLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++; 

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
                id:      item.kuji_id,
                name:    item.kuji_name    || item.kuji_id,
                name_jp: item.kuji_name_jp || '',
                market:  item.market,
                thumb:   item.thumbnail || PLACEHOLDER_THUMB,
                price:   item.price || 0,
                status,
                url:     item.url || '',
            };
        } else {
            const meta = kujiMetaMap[item.kuji_id];
            if (meta.thumb === PLACEHOLDER_THUMB && item.thumbnail) {
                meta.thumb = item.thumbnail;
            }
            if (status === 'end') meta.status = 'end';
        }
    });
}

 

function applyTheme(market) {
    document.body.classList.toggle('theme-nagano', market === 'nagano');
    document.querySelectorAll('.market-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.market === market);
    });
}

function showHome(market) {
    currentMarket = market;
    applyTheme(market);

    screenGacha.classList.add('hidden');
    screenHome.classList.remove('hidden');

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
        kujiLinkBadge.href = meta.url;
        kujiLinkBadge.classList.remove('hidden');
    } else {
        kujiLinkBadge.classList.add('hidden');
    }

    updateDrawButtons(currentPrice);
    renderProbabilityTable();

    screenHome.classList.add('hidden');
    screenGacha.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'auto' });
}

 

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
        const isEnded = kuji.status === 'end';
        const card = document.createElement('div');
        card.className = 'kuji-card';
        card.innerHTML = `
            <div class="kuji-thumb-wrapper">
                <img src="${kuji.thumb}" class="kuji-thumb${isEnded ? ' ended' : ''}" loading="lazy">
                ${isEnded ? '<div class="ended-badge">종료</div>' : ''}
            </div>
            <div class="kuji-info">
                <h3 class="kuji-title">${kuji.name}</h3>
                <div class="kuji-price">1회 ¥${Number(kuji.price).toLocaleString()}</div>
            </div>
        `;

        card.addEventListener('click', () => {
            window.location.hash = encodeURIComponent(kuji.id);
        });

        

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
                <img src="${item.image || PLACEHOLDER_IMG}">
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

 

function renderMainResultsGrid(shouldHighlight = true) {
    resultsGrid.innerHTML = '';

    

    const counts = pullHistory.reduce((acc, item) => {
        const key = getItemKey(item);
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});

    

    const isSingleGrade = new Set(activeKujiItems.map(i => i.grade)).size === 1;
    activeKujiItems.forEach(item => {
        if (counts[getItemKey(item)]) {
            renderResultCard(item, resultsGrid, counts[getItemKey(item)], shouldHighlight, isSingleGrade);
        }
    });

    const totalKinds     = activeKujiItems.length;
    const collectedKinds = Object.keys(counts).length;
    const isComplete     = collectedKinds >= totalKinds;

    collectionBadge.innerText = `${collectedKinds}/${totalKinds}`;
    collectionBadge.classList.toggle('complete', isComplete);
    collectionBadge.classList.remove('hidden');
    btnShare.classList.remove('hidden');

    

    const justCompleted = isComplete && !collectionCompleteShown;
    if (justCompleted) collectionCompleteShown = true;
    return justCompleted;
}

function renderResultCard(item, container, count = 1, shouldHighlight = true, isSingleGrade = false) {
    const key   = getItemKey(item);
    const color = getGradeColor(item.grade);

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
        <img src="${item.image || PLACEHOLDER_IMG}" class="prize-img">
        <div class="prize-name" title="${item.name}">${item.name}</div>
    `;

    card.innerHTML = html;
    container.appendChild(card);
}

 

function drawItems(times) {
    if (activeKujiItems.length === 0) return showToast('상품 정보가 없습니다.');

    const totalWeight = activeKujiItems.reduce((sum, item) => sum + parseFloat(item.rate), 0);

    probWrapper.classList.add('hidden');
    resultsWrapper.classList.remove('hidden');

    modalTitleText.innerText   = `${times}회 결과`;
    modalResultsGrid.innerHTML = '';
    modalResultsGrid.classList.toggle('is-10-pull', times === 10);

    lastDrawnItems = [];

    const isSingleGrade = new Set(activeKujiItems.map(i => i.grade)).size === 1;
    for (let i = 0; i < times; i++) {
        const item = pickRandomItem(activeKujiItems, totalWeight);
        lastDrawnItems.push(getItemKey(item));
        pullHistory.push(item);
        renderResultCard(item, modalResultsGrid, 1, false, isSingleGrade);
    }

    totalPulls += times;
    totalSpent += currentPrice * times;
    updateStats();

    if (times === 1) {
        const justCompleted = renderMainResultsGrid(true);
        scrollToNewlyDrawnCard();
        if (justCompleted) showToast(`<span class="toast-highlight">${activeKujiItems.length}종</span> 수집 완료!`);
    } else {
        const justCompleted = renderMainResultsGrid(false);
        modalOverlay.classList.remove('hidden');
        if (justCompleted) {
            setTimeout(() => showToast(`<span class="toast-highlight">${activeKujiItems.length}종</span> 수집 완료!`), 150);
        }
    }
}

function openAutoModal() {
    if (activeKujiItems.length === 0) return showToast('상품 정보가 없습니다.');

    autoItemList.innerHTML = '';
    selectedAutoItemKey    = null;

    const isSingleGrade = new Set(activeKujiItems.map(i => i.grade)).size === 1;

    activeKujiItems.forEach(item => {
        const card = document.createElement('div');
        card.className = 'auto-item-card';
        card.innerHTML = `
            <img src="${item.image || PLACEHOLDER_IMG}" loading="lazy">
            <div class="auto-item-name">${isSingleGrade ? '' : `[${item.grade}] `}${item.name}</div>
            <div class="auto-item-rate">${item.rate}%</div>
        `;
        card.addEventListener('click', () => {
            document.querySelectorAll('.auto-item-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedAutoItemKey = getItemKey(item);
        });
        autoItemList.appendChild(card);
    });

    autoSetupModal.classList.remove('hidden');
}

function executeAutoDraw() {
    if (!selectedAutoItemKey) return showToast('상품을 선택해주세요.');

    autoSetupModal.classList.add('hidden');

    const totalWeight = activeKujiItems.reduce((sum, item) => sum + parseFloat(item.rate), 0);
    let count = 0;

    probWrapper.classList.add('hidden');
    resultsWrapper.classList.remove('hidden');

    while (count < MAX_AUTO_DRAWS) {
        const item = pickRandomItem(activeKujiItems, totalWeight);
        pullHistory.push(item);
        count++;
        if (getItemKey(item) === selectedAutoItemKey) break;
    }

    totalPulls += count;
    totalSpent += currentPrice * count;
    updateStats();

    lastDrawnItems = [selectedAutoItemKey];
    const justCompleted = renderMainResultsGrid();
    scrollToNewlyDrawnCard();

    const isMaxed   = count >= MAX_AUTO_DRAWS;
    const resultMsg = isMaxed
        ? `${MAX_AUTO_DRAWS}회를 돌렸지만 나오지 않아 강제 종료합니다.`
        : `선택한 상품을 뽑기 위해 총 <span class="toast-highlight">${count}회</span>를 돌렸습니다.\n<span class="toast-highlight">${(currentPrice * count).toLocaleString()}엔</span>을 지출했습니다.`;

    

    setTimeout(() => showToast(resultMsg, 3000), 150);
    if (justCompleted) {
        setTimeout(() => showToast(`<span class="toast-highlight">${activeKujiItems.length}종</span> 수집 완료!`), 3450);
    }
}

 

function closeModal() {
    modalOverlay.classList.add('hidden');
    renderMainResultsGrid(true);
    scrollToNewlyDrawnCard();
}

function resetSimulation() {
    totalPulls    = 0;
    totalSpent    = 0;
    pullHistory   = [];
    lastDrawnItems = [];
    collectionCompleteShown = false;

    updateStats();

    resultsGrid.innerHTML = '';
    resultsWrapper.classList.add('hidden');
    collectionBadge.classList.add('hidden');
    btnShare.classList.add('hidden');
    probWrapper.classList.remove('hidden');

    modalOverlay.classList.add('hidden');
    autoSetupModal.classList.add('hidden');
}

 

function handleRoute() {
    

    document.getElementById('app-toast')?.remove();

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

 

function setupEvents() {
    const btnInfo         = document.getElementById('btn-info');
    const tooltipBox      = document.getElementById('tooltip-box');
    const infoWrapper     = document.getElementById('info-tooltip-wrapper');
    const btnTooltipClose = document.getElementById('btn-tooltip-close');

    

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

    

    document.querySelectorAll('.market-tab').forEach(btn => {
        btn.addEventListener('click', e => {
            window.location.hash = e.currentTarget.dataset.market;
        });
    });

    

    document.querySelectorAll('.draw-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            drawItems(parseInt(e.currentTarget.dataset.times, 10));
        });
    });

    

    document.getElementById('btn-reset').addEventListener('click', () => {
        resetSimulation();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    

    btnModalClose.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', e => {
        if (e.target === modalOverlay) closeModal();
    });

    

    btnAuto.addEventListener('click', openAutoModal);
    btnAutoClose.addEventListener('click', () => { autoSetupModal.classList.add('hidden'); });
    autoSetupModal.addEventListener('click', e => {
        if (e.target === autoSetupModal) autoSetupModal.classList.add('hidden');
    });
    btnAutoStart.addEventListener('click', executeAutoDraw);

    

    btnShare.addEventListener('click', () => {
        if (pullHistory.length === 0) return;

        const isJapanese = navigator.language?.startsWith('ja');
        const meta       = kujiMetaMap[activeKujiId];
        const total      = pullHistory.length;

        

        const gradeCounts = {};
        pullHistory.forEach(item => {
            const key = item.grade;
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

 

async function init() {
    setupEvents();
    await fetchData();
    handleRoute();
}

init();
