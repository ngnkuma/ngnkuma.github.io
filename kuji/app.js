/* 상태 */

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

const screenHome = document.getElementById('screen-home');
const screenGacha = document.getElementById('screen-gacha');
const kujiListGrid = document.getElementById('kuji-list-grid');
const probWrapper = document.getElementById('prob-wrapper');
const resultsWrapper = document.getElementById('results-wrapper');
const resultsGrid = document.getElementById('results-grid');
const probabilityTable = document.getElementById('probability-table');

const kujiLinkBadge = document.getElementById('kuji-link-badge');
const collectionBadge = document.getElementById('collection-badge');
const statPulls = document.getElementById('total-pulls');
const statSpent = document.getElementById('total-spent');

const modalOverlay = document.getElementById('result-modal');
const modalResultsGrid = document.getElementById('modal-results-grid');
const modalTitleText = document.getElementById('modal-title-text');
const autoSetupModal = document.getElementById('auto-setup-modal');
const autoItemList = document.getElementById('auto-item-list');

const btnModalClose = document.getElementById('btn-modal-close');
const btnAuto = document.getElementById('btn-auto');
const btnAutoClose = document.getElementById('btn-auto-close');
const btnAutoStart = document.getElementById('btn-auto-start');

const btnShare = document.getElementById('btn-share');


/* 데이터 */

async function fetchData() {
    const chiikawaUrl = 'data/chiikawa.csv';
    const naganoUrl = 'data/nagano.csv';

    try {
        const [chiikawaRes, naganoRes] = await Promise.all([
            fetch(chiikawaUrl),
            fetch(naganoUrl)
        ]);

        const chiikawaText = await chiikawaRes.text();
        const naganoText = await naganoRes.text();

        const chiikawaData = parseCSV(chiikawaText).map(item => ({ ...item, market: 'chiikawa' }));
        const naganoData = parseCSV(naganoText).map(item => ({ ...item, market: 'nagano' }));

        kujiData = [...chiikawaData, ...naganoData];
        extractKujiMeta(); 
    } catch (error) {
        alert('데이터 불러오기 실패!');
    }
}

function parseCSV(csvText) {
    const rows = csvText.split(/\r?\n/);
    
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

    if (rows.length === 0) return [];
    
    const headers = parseLine(rows[0]);
    const data = [];

    for (let i = 1; i < rows.length; i++) {
        if (!rows[i].trim()) continue;
        const cols = parseLine(rows[i]);
        const item = {};
        
        headers.forEach((header, index) => {
            if (cols[index] !== undefined) {
                item[header] = cols[index];
            }
        });
        
        if (item.kuji_id) data.push(item);
    }
    return data;
}

function extractKujiMeta() {
    kujiMetaMap = {};
    kujiData.forEach(item => {
        if (!item.kuji_id) return;
        
        let currentStatus = item.status ? item.status.toLowerCase().trim() : 'ing';

        if (!kujiMetaMap[item.kuji_id]) {
            kujiMetaMap[item.kuji_id] = {
                id: item.kuji_id,          
                name: item.kuji_name || item.kuji_id, 
                market: item.market,
                thumb: item.thumbnail || 'https://via.placeholder.com/300x300?text=No+Image',
                price: item.price || 0,
                status: currentStatus,
                url: item.url || '' 
            };
        } else {
            if (kujiMetaMap[item.kuji_id].thumb === 'https://via.placeholder.com/300x300?text=No+Image' && item.thumbnail) {
                kujiMetaMap[item.kuji_id].thumb = item.thumbnail;
            }
            if (currentStatus === 'end') {
                kujiMetaMap[item.kuji_id].status = 'end';
            }
        }
    });
}


/* UI */

function showHome(market) {
    currentMarket = market;
    
    document.querySelectorAll('.market-tab').forEach(b => b.classList.remove('active'));
    const activeTab = document.querySelector(`.market-tab[data-market="${market}"]`);
    if (activeTab) activeTab.classList.add('active');

    if (currentMarket === 'nagano') {
        document.body.classList.add('theme-nagano');
    } else {
        document.body.classList.remove('theme-nagano');
    }
    
    screenGacha.style.display = 'none';
    screenHome.style.display = 'block';

    resetSimulation(); 
    renderHomeList();
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
        const card = document.createElement('div');
        card.className = 'kuji-card';
        const thumbClass = kuji.status === 'end' ? 'kuji-thumb ended' : 'kuji-thumb';

        card.innerHTML = `
            <img src="${kuji.thumb}" class="${thumbClass}" loading="lazy">
            <div class="kuji-info">
                <h3 class="kuji-title">${kuji.name}</h3> 
                <div class="kuji-price">1회 ¥${Number(kuji.price).toLocaleString()}</div>
            </div>
        `;
        
        card.addEventListener('click', () => {
            window.location.hash = encodeURIComponent(kuji.id);
        });

        // hover 시 프리로드
        const preloadAction = () => {
            const itemsToPreload = kujiData.filter(item => item.kuji_id === kuji.id);
            itemsToPreload.forEach(item => {
                if (item.image) {
                    const img = new Image();
                    img.src = item.image; 
                }
            });
        };
        
        card.addEventListener('mouseenter', preloadAction, { once: true });
        card.addEventListener('touchstart', preloadAction, { once: true });

        kujiListGrid.appendChild(card);
    });
}

function enterGachaRoom(kujiId) {
    activeKujiId = kujiId;
    const meta = kujiMetaMap[kujiId];
    
    if (!meta) {
        window.location.hash = currentMarket;
        return;
    }

    // 테마 유지
    currentMarket = meta.market;
    
    document.querySelectorAll('.market-tab').forEach(b => b.classList.remove('active'));
    const activeTab = document.querySelector(`.market-tab[data-market="${currentMarket}"]`);
    if (activeTab) activeTab.classList.add('active');

    if (currentMarket === 'nagano') {
        document.body.classList.add('theme-nagano');
    } else {
        document.body.classList.remove('theme-nagano');
    }
 

    activeKujiItems = kujiData.filter(item => item.kuji_id === activeKujiId);
    currentPrice = parseInt(meta.price, 10);
    
    if (meta.url) {
        kujiLinkBadge.href = meta.url;
        kujiLinkBadge.style.display = 'block';
    } else {
        kujiLinkBadge.style.display = 'none';
    }

    updateButtons(currentPrice);
    renderProbabilityTable();
    
    screenHome.style.display = 'none';
    screenGacha.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'auto' });
}

function updateButtons(price) {
    document.getElementById('btn-draw-1').innerHTML = `<span class="times">1회</span><span class="price">${price.toLocaleString()}엔</span>`;
    document.getElementById('btn-draw-3').innerHTML = `<span class="times">3회</span><span class="price">${(price * 3).toLocaleString()}엔</span>`;
    document.getElementById('btn-draw-5').innerHTML = `<span class="times">5회</span><span class="price">${(price * 5).toLocaleString()}엔</span>`;
    document.getElementById('btn-draw-10').innerHTML = `<span class="times">10회</span><span class="price">${(price * 10).toLocaleString()}엔</span>`;
}

function getGradeColor(grade) {
    const g = grade.toUpperCase();
    if (g.includes('A')) return '#E37276'; 
    if (g.includes('B')) return '#fadb5c'; 
    if (g.includes('C')) return '#c7baf7'; 
    if (g.includes('D')) return '#a5d2f2'; 
    if (g.includes('E')) return '#b0b0b0'; 
    return '#b0b0b0'; 
}

function renderProbabilityTable() {
    probabilityTable.innerHTML = '';
    
    const groups = {};
    activeKujiItems.forEach(item => {
        if (!groups[item.grade]) {
            groups[item.grade] = { items: [], totalRate: 0 };
        }
        groups[item.grade].items.push(item);
        groups[item.grade].totalRate += parseFloat(item.rate);
    });

    for (const [grade, data] of Object.entries(groups)) {
        const section = document.createElement('div');
        section.className = 'grade-section';
        const tRate = Math.round(data.totalRate * 10) / 10;
        const headerColor = 'var(--theme-main)'; 
        const gradeName = data.items[0].grade_name ? ` ${data.items[0].grade_name}` : '';

        let html = `
            <div class="grade-header" style="border-bottom-color: ${headerColor};">
                <span style="color: ${headerColor};">${grade}${gradeName} <span style="color: #888; font-size: 0.85em;">(${tRate}%)</span></span>
            </div>
            <div class="prob-items-grid">
        `;

        data.items.forEach(item => {
            const imgSrc = item.image || 'https://via.placeholder.com/60';
            html += `
                <div class="prob-item-card">
                    <img src="${imgSrc}">
                    <div class="prob-info">
                        <div class="prob-name">${item.name}</div>
                        <div class="prob-rate">${item.rate}%</div>
                    </div>
                </div>
            `;
        });

        html += `</div>`;
        section.innerHTML = html;
        probabilityTable.appendChild(section);
    }
}

function renderMainResultsGrid(shouldHighlight = true) {
    resultsGrid.innerHTML = '';
    
    const groupedCounts = {};
    pullHistory.forEach(item => {
        const key = item.grade + '||' + item.name;
        if (!groupedCounts[key]) {
            groupedCounts[key] = 0;
        }
        groupedCounts[key]++;
    });
    
    activeKujiItems.forEach(item => {
        const key = item.grade + '||' + item.name;
        if (groupedCounts[key] > 0) {
            renderResultCard(item, resultsGrid, groupedCounts[key], shouldHighlight);
        }
    });

    const totalKinds = activeKujiItems.length;
    const collectedKinds = Object.keys(groupedCounts).length;
    
    collectionBadge.innerText = `${collectedKinds}/${totalKinds}`;
    if (collectedKinds >= totalKinds) {
        collectionBadge.classList.add('complete');
    } else {
        collectionBadge.classList.remove('complete');
    }
    collectionBadge.style.display = 'block';
    // 공유 버튼 표시
    if (btnShare) btnShare.style.display = 'flex';
}

function renderResultCard(item, container, count = 1, shouldHighlight = true) {
    const card = document.createElement('div');
    card.className = 'prize-card';
    
    const itemUniqueKey = item.grade + '||' + item.name;
    
    if (shouldHighlight && container === resultsGrid && lastDrawnItems.includes(itemUniqueKey)) {
        card.classList.add('newly-drawn');
    }

    if (item.grade.toUpperCase().includes('A')) {
        card.classList.add('grade-a-border');
    }

    const imgSrc = item.image || 'https://via.placeholder.com/150';
    const color = getGradeColor(item.grade);
    const textColor = 'color: white;';

    const uniqueGrades = new Set(activeKujiItems.map(i => i.grade));
    const isSingleGrade = uniqueGrades.size === 1;

    let html = ``;
    
    if (container === resultsGrid && count >= 2) {
        html += `<div class="qty-badge">x${count}</div>`;
    }

    if (!isSingleGrade) {
        html += `<div class="prize-grade" style="background-color: ${color}; ${textColor}">${item.grade}</div>`;
    }
    
    html += `
        <img src="${imgSrc}" class="prize-img">
        <div class="prize-name" title="${item.name}">${item.name}</div>
    `;
    
    card.innerHTML = html;
    container.appendChild(card);
}


/* 쿠지 로직 */

function drawItems(times) {
    if (activeKujiItems.length === 0) return alert('상품 정보가 없습니다.');

    const totalWeight = activeKujiItems.reduce((sum, item) => sum + parseFloat(item.rate), 0);

    probWrapper.style.display = 'none';
    resultsWrapper.style.display = 'block'; 

    modalTitleText.innerText = `${times}회 결과`; 
    modalResultsGrid.innerHTML = '';

    if (times === 10) {
        modalResultsGrid.classList.add('is-10-pull');
    } else {
        modalResultsGrid.classList.remove('is-10-pull');
    }

    lastDrawnItems = [];

    for (let i = 0; i < times; i++) {
        let randomNum = Math.random() * totalWeight;
        let cumulativeWeight = 0;
        let selectedItem = null;

        for (let item of activeKujiItems) {
            cumulativeWeight += parseFloat(item.rate);
            if (randomNum <= cumulativeWeight) {
                selectedItem = item;
                break;
            }
        }
        if (!selectedItem) selectedItem = activeKujiItems[activeKujiItems.length - 1];

        const currentItemKey = selectedItem.grade + '||' + selectedItem.name;
        lastDrawnItems.push(currentItemKey);
        
        pullHistory.push(selectedItem);
        renderResultCard(selectedItem, modalResultsGrid, 1, false); 
    }

    totalPulls += times;
    totalSpent += (currentPrice * times);
    
    statPulls.innerText = `${totalPulls}회`;
    statSpent.innerText = `${totalSpent.toLocaleString()}엔`;

    const isSinglePull = (times === 1);
    renderMainResultsGrid(isSinglePull);

    if (times === 1) {
        scrollToNewlyDrawnCard();
    } else {
        modalOverlay.style.display = 'flex';
    }
}

function openAutoModal() { // 자동
    if (activeKujiItems.length === 0) return alert('상품 정보가 없습니다.');
    
    autoItemList.innerHTML = '';
    selectedAutoItemKey = null; 

    const uniqueGrades = new Set(activeKujiItems.map(i => i.grade));
    const isSingleGrade = uniqueGrades.size === 1;

    activeKujiItems.forEach(item => {
        const card = document.createElement('div');
        card.className = 'auto-item-card';
        const imgSrc = item.image || 'https://via.placeholder.com/45';
        const gradeText = isSingleGrade ? '' : `[${item.grade}] `;

        card.innerHTML = `
            <img src="${imgSrc}" loading="lazy">
            <div class="auto-item-name">${gradeText}${item.name}</div>
            <div class="auto-item-rate">${item.rate}%</div>
        `;
        
        const itemUniqueKey = item.grade + '||' + item.name;

        card.addEventListener('click', () => {
            document.querySelectorAll('.auto-item-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedAutoItemKey = itemUniqueKey; 
        });
        
        autoItemList.appendChild(card);
    });

    autoSetupModal.style.display = 'flex';
}

function executeAutoDraw() {
    if (!selectedAutoItemKey) return alert('상품을 선택해주세요.');

    autoSetupModal.style.display = 'none';

    const totalWeight = activeKujiItems.reduce((sum, item) => sum + parseFloat(item.rate), 0);
    let targetFound = false;
    let autoDrawCount = 0;

    probWrapper.style.display = 'none'; 
    resultsWrapper.style.display = 'block'; 

    while (!targetFound) {
        autoDrawCount++;
        let randomNum = Math.random() * totalWeight;
        let cumulativeWeight = 0;
        let selectedItem = null;

        for (let item of activeKujiItems) {
            cumulativeWeight += parseFloat(item.rate);
            if (randomNum <= cumulativeWeight) {
                selectedItem = item;
                break;
            }
        }
        if (!selectedItem) selectedItem = activeKujiItems[activeKujiItems.length - 1];

        pullHistory.push(selectedItem);
        const currentItemKey = selectedItem.grade + '||' + selectedItem.name;

        if (currentItemKey === selectedAutoItemKey) {
            targetFound = true;
        }

        if (autoDrawCount >= 1000) { // 최대 1000회로 설정
            alert('1000회를 돌렸지만 나오지 않아 강제 종료합니다.');
            break;
        }
    }

    totalPulls += autoDrawCount;
    totalSpent += (currentPrice * autoDrawCount);
    
    statPulls.innerText = `${totalPulls}회`;
    statSpent.innerText = `${totalSpent.toLocaleString()}엔`;

    lastDrawnItems = [selectedAutoItemKey];

    renderMainResultsGrid();
    scrollToNewlyDrawnCard();

    setTimeout(() => {
        alert(`선택한 상품을 뽑기 위해 총 ${autoDrawCount}회를 돌렸습니다.\n${(currentPrice * autoDrawCount).toLocaleString()}엔을 지출했습니다.`);
    }, 150);
}

function scrollToNewlyDrawnCard() {
    setTimeout(() => {
        const newlyDrawnCard = document.querySelector('.newly-drawn');
        if (newlyDrawnCard) {
            const cardRect = newlyDrawnCard.getBoundingClientRect();
            const absoluteElementTop = cardRect.top + window.pageYOffset;
            const middle = absoluteElementTop - (window.innerHeight / 2) + (cardRect.height / 2);
            
            window.scrollTo({
                top: middle,
                behavior: 'smooth'
            });
        }
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
    
    statPulls.innerText = `0회`;
    statSpent.innerText = `0엔`;
    resultsGrid.innerHTML = '';
    
    resultsWrapper.style.display = 'none'; 
    collectionBadge.style.display = 'none';

    if (btnShare) btnShare.style.display = 'none';

    probWrapper.style.display = 'block';

    modalOverlay.style.display = 'none';      
    autoSetupModal.style.display = 'none';  
}


/* 초기화 & 이벤트 바인딩 */

function handleRoute() {
    let hash = window.location.hash.replace('#', '');
    
    if (!hash) {
        hash = 'chiikawa';
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
    const btnInfo = document.getElementById('btn-info');
    const tooltipBox = document.getElementById('tooltip-box');
    const infoWrapper = document.getElementById('info-tooltip-wrapper');
    const btnTooltipClose = document.getElementById('btn-tooltip-close');

    // 툴팁 
    btnInfo.addEventListener('click', (e) => {
        e.stopPropagation(); 
        if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
            return; 
        }
        tooltipBox.classList.toggle('show');
    });

    if (btnTooltipClose) {
        btnTooltipClose.addEventListener('click', (e) => {
            e.stopPropagation();
            tooltipBox.classList.remove('show');
        });
    }

    document.addEventListener('click', (e) => {
        if (!infoWrapper.contains(e.target)) {
            tooltipBox.classList.remove('show');
        }
    });

    // 탭 이동 
    document.querySelectorAll('.market-tab').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetMarket = e.target.dataset.market;
            window.location.hash = targetMarket; 
        });
    });

    // 뽑기 버튼 
    document.querySelectorAll('.draw-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const times = parseInt(e.currentTarget.dataset.times, 10);
            drawItems(times);
        });
    });

    // 리셋 & 모달 
    document.getElementById('btn-reset').addEventListener('click', () => {
        resetSimulation();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    btnModalClose.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });

    // 자동 뽑기 
    btnAuto.addEventListener('click', openAutoModal);
    btnAutoClose.addEventListener('click', () => {
        autoSetupModal.style.display = 'none';
    });
    autoSetupModal.addEventListener('click', (e) => {
        if (e.target === autoSetupModal) {
            autoSetupModal.style.display = 'none';
        }
    });
    btnAutoStart.addEventListener('click', executeAutoDraw);

    // 트위터 결과 공유
    if (btnShare) {
        btnShare.addEventListener('click', () => {
            if (pullHistory.length === 0) return;

            const meta = kujiMetaMap[activeKujiId];
            const kujiName = meta ? meta.name : '쿠지';
            const total = pullHistory.length;
            
            // 등급별 개수 카운트
            const gradeCounts = {};
            pullHistory.forEach(item => {
                const grade = item.grade;
                gradeCounts[grade] = (gradeCounts[grade] || 0) + 1;
            });

            // 등급 정렬
            const sortedGrades = Object.keys(gradeCounts).sort();
            const gradeString = sortedGrades.map(g => {

                const displayGrade = g.endsWith('상') ? g : `${g}상`;
                return `[${displayGrade}] ${gradeCounts[g]}개`;
            }).join(', ');

            // 트위터 출력 텍스트
            const text = `【나가노 온라인 쿠지 시뮬레이터】\n${kujiName} ${total}회 결과: ${gradeString}를 획득했습니다.\nhttps://nagano-kuji.vercel.app`;
            
            // 트위터 전송
            const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
            window.open(twitterUrl, '_blank');
        });
    }
}


/* 모바일 확대 방지 */

document.documentElement.addEventListener('touchstart', function (event) {
     if (event.touches.length > 1) {
          event.preventDefault(); 
        } 
    }, false);

var lastTouchEnd = 0; 

document.documentElement.addEventListener('touchend', function (event) {
     var now = (new Date()).getTime();
     if (now - lastTouchEnd <= 200) {
          event.preventDefault(); 
        } lastTouchEnd = now; 
    }, false);

async function init() {
    setupEvents();
    await fetchData();
    handleRoute(); 
}

init();