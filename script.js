// ==========================================================
// 헬퍼 함수 및 색상 설정
// ==========================================================
const colorMap = {
    'red': '#FF0000',
    'green': '#00FF00',
    'blue': '#0000FF',
    'yellow': '#FFFF00',
    'purple': '#800080',
    'orange': '#FFA500',
    'pink': '#FFC0CB',
    'black': '#000000',
    'white': '#FFFFFF',
    'gray': '#808080'
};

function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

// ==========================================================
// 캔버스 및 기본 설정
// ==========================================================
const canvas = document.getElementById('artCanvas');
const ctx = canvas ? canvas.getContext('2d') : null;
const cursorGuide = document.getElementById('cursor-guide');

if (!canvas || !ctx || !cursorGuide) {
    console.error("Canvas, Context, or Cursor Guide element not found. Initialization failed.");
}

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 600; 
if (canvas) {
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
}

const COLS = 3;
const ROWS = 4;
const GAP = 10; 

const maxCellW = (CANVAS_WIDTH - (COLS + 1) * GAP) / COLS;
const maxCellH = (CANVAS_HEIGHT - (ROWS + 1) * GAP) / ROWS;
const CELL_BASE_DIM = Math.min(maxCellW, maxCellH); 

const CELL_BASE_W = CELL_BASE_DIM;
const CELL_BASE_H = CELL_BASE_DIM;

const MIN_CELL_DIM = CELL_BASE_DIM;
const BALL_R_UNIT = MIN_CELL_DIM / 2; 

const CORNER_DRAG_DETECTION_RADIUS = 20;
const MERGE_CENTER_THRESHOLD = 20;

// ==========================================================
// 아트 상태 및 초기화
// ==========================================================

function initializeGrid() {
    const newGrid = [];
    for (let r = 0; r < ROWS; r++) {
        newGrid[r] = [];
        for (let c = 0; c < COLS; c++) {
            newGrid[r][c] = {
                borderRadiusFactors: [0, 0, 0, 0],
                isMerged: false,
                color: 'black',
                gridX: c, gridY: r, 
                gridMinX: c, gridMaxX: c, 
                gridMinY: r, gridMaxY: r, 
                x: c * (CELL_BASE_W + GAP) + GAP, 
                y: r * (CELL_BASE_H + GAP) + GAP, 
                w: CELL_BASE_W, 
                h: CELL_BASE_H, 
                id: r * COLS + c 
            };
        }
    }
    return newGrid;
}

let grid = initializeGrid();
let mergedShapes = [];

let isDragging = false; 
let currentDragCell = null;
let currentCornerIndex = -1;

let mergeStartCell = null; 
let currentMouseX = 0;
let currentMouseY = 0;

const ball = {
    x: 0, y: 0, r: BALL_R_UNIT, 
    color: '#ffcc00', 
    visible: false, isFixed: false, 
    fixedBallRef: null 
};

const BALL_MANUAL_SPEED = 10;
let currentTypedColor = ''; 

let isBallGrabbed = false;
const GRAB_FOLLOW_SPEED = 0.2; 

// 고정된 공들을 저장하는 배열
let fixedBalls = []; 
let nextFixedBallId = 0; 

// ==========================================================
// 드로잉 로직
// ==========================================================

function drawActualRoundedRect(cellData) {
    if (!ctx) return;
    const { x, y, w, h, borderRadiusFactors, color } = cellData;
    ctx.fillStyle = color;
    ctx.beginPath();
    
    const maxDimension = Math.min(w, h); 
    
    const r_tl = borderRadiusFactors[0] * maxDimension * 0.5; 
    const r_tr = borderRadiusFactors[1] * maxDimension * 0.5; 
    const r_br = borderRadiusFactors[2] * maxDimension * 0.5; 
    const r_bl = borderRadiusFactors[3] * maxDimension * 0.5; 

    const adj_r_tl = Math.min(r_tl, w, h); 
    const adj_r_tr = Math.min(r_tr, w, h); 
    const adj_r_br = Math.min(r_br, w, h); 
    const adj_r_bl = Math.min(r_bl, w, h); 

    ctx.moveTo(x + adj_r_tl, y);
    ctx.lineTo(x + w - adj_r_tr, y);
    ctx.arcTo(x + w, y, x + w, y + adj_r_tr, adj_r_tr);
    
    ctx.lineTo(x + w, y + h - adj_r_br);
    ctx.arcTo(x + w, y + h, x + w - adj_r_br, y + h, adj_r_br);

    ctx.lineTo(x + adj_r_bl, y + h);
    ctx.arcTo(x, y + h, x, y + h - adj_r_bl, adj_r_bl);

    ctx.lineTo(x, y + adj_r_tl);
    ctx.arcTo(x, y, x + adj_r_tl, y, adj_r_tl);
    
    ctx.closePath();
    ctx.fill();
}

function drawFixedBalls() {
    if (!ctx) return;
    
    fixedBalls.forEach(fb => {
        // 현재 제어 중인 공은 fixedBalls 배열에서 그리지 않음
        if (ball.visible && ball.fixedBallRef && ball.fixedBallRef.id === fb.id) {
            return;
        }

        ctx.fillStyle = fb.color;
        ctx.beginPath();
        ctx.arc(fb.x, fb.y, fb.r, 0, Math.PI * 2);
        ctx.fill();
        
        // 고정된 공임을 나타내는 테두리
        ctx.strokeStyle = '#808080';
        ctx.lineWidth = 1;
        ctx.stroke();
    });
}

function drawBall() {
    if (!ctx) return;
    
    if (ball.visible) { 
        ctx.strokeStyle = ball.color; 
        ctx.lineWidth = isBallGrabbed ? 5 : 3; 
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); 
        ctx.stroke();
    }
    
    ctx.fillStyle = ball.color;
    ctx.beginPath();
    const innerRadius = ball.r - (isBallGrabbed ? 5 : 3);
    if (innerRadius > 0) { 
        ctx.arc(ball.x, ball.y, innerRadius, 0, Math.PI * 2); 
        ctx.fill();
    }
}

function draw() {
    if (!ctx) return;
    
    // 캔버스 초기화 (잔상 제거)
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 1. 그리드 셀 및 병합된 셰이프 그리기
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const cell = grid[r][c];
            if (!cell.isMerged && mergedShapes.indexOf(cell) === -1) { 
                drawActualRoundedRect(cell);
            }
        }
    }

    mergedShapes.forEach(masterCell => {
        drawActualRoundedRect(masterCell);
    });
    
    // 2. 고정된 공 그리기
    drawFixedBalls();
    
    // 3. 현재 움직이는 공 그리기
    if (ball.visible && !ball.isFixed) {
        drawBall();
    }
    
    // ==========================================================
    // 4. 곡률/병합 안내 원 그리기 (시각적 피드백)
    // ==========================================================
    if (isDragging && currentDragCell) {
        // 곡률 변경 상태 (흰색 테두리)
        const cell = currentDragCell;
        const cornerX = (currentCornerIndex === 1 || currentCornerIndex === 2) ? cell.x + cell.w : cell.x;
        const cornerY = (currentCornerIndex === 2 || currentCornerIndex === 3) ? cell.y + cell.h : cell.y;
        
        ctx.strokeStyle = 'white'; 
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(cornerX, cornerY, CORNER_DRAG_DETECTION_RADIUS + 5, 0, Math.PI * 2);
        ctx.stroke();
        
    } else if (mergeStartCell) {
        // 병합 시작 상태 (흰색 테두리)
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 4;

        const currentCell = getCellAt(currentMouseX, currentMouseY);
        let guideR = 15;

        if (currentCell && currentCell !== mergeStartCell && !currentCell.isMerged) {
            // 다른 셀 위에 있고, 병합 가능한 셀 위일 경우
            guideR = MERGE_CENTER_THRESHOLD;
        }

        ctx.beginPath();
        ctx.arc(currentMouseX, currentMouseY, guideR, 0, Math.PI * 2);
        ctx.stroke();
    }
}

// ==========================================================
// 마우스 이벤트 핸들러
// ==========================================================

function getCanvasMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * (CANVAS_WIDTH / rect.width);
    const mouseY = (e.clientY - rect.top) * (CANVAS_HEIGHT / rect.height);
    return { mouseX, mouseY };
}

function getCellAt(mouseX, mouseY) {
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const cell = grid[r][c];
            const cellStartX = c * (CELL_BASE_W + GAP) + GAP;
            const cellStartY = r * (CELL_BASE_H + GAP) + GAP;
            
            if (mouseX >= cellStartX && mouseX < cellStartX + CELL_BASE_W &&
                mouseY >= cellStartY && mouseY < cellStartY + CELL_BASE_H) {
                return cell;
            }
        }
    }
    return null;
}

function getCellAndCorner(mouseX, mouseY) {
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const cell = grid[r][c];
            
            if (cell.isMerged) continue; 
            
            const cellDrawX = cell.x;
            const cellDrawY = cell.y;
            const cellDrawW = cell.w;
            const cellDrawH = cell.h;

            if (mouseX >= cellDrawX && mouseX < cellDrawX + cellDrawW &&
                mouseY >= cellDrawY && mouseY < cellDrawY + cellDrawH) {
                
                const corners = [
                    [cellDrawX, cellDrawY, 0], [cellDrawX + cellDrawW, cellDrawY, 1],
                    [cellDrawX + cellDrawW, cellDrawY + cellDrawH, 2], [cellDrawX, cellDrawY + cellDrawH, 3]
                ];

                for (let i = 0; i < corners.length; i++) {
                    const [cx, cy] = corners[i];
                    const dist = Math.sqrt(Math.pow(mouseX - cx, 2) + Math.pow(mouseY - cy, 2));
                    if (dist < CORNER_DRAG_DETECTION_RADIUS) {
                        return { cell, cornerIndex: i, cornerX: cx, cornerY: cy };
                    }
                }
                return { cell, cornerIndex: -1 };
            }
        }
    }
    return { cell: null, cornerIndex: -1 };
}

function handleFixedBallClick(mouseX, mouseY) {
    for (let i = 0; i < fixedBalls.length; i++) {
        const fb = fixedBalls[i];
        const distToCenter = Math.sqrt(Math.pow(mouseX - fb.x, 2) + Math.pow(mouseY - fb.y, 2));

        if (distToCenter < fb.r) {
            // 고정된 공을 클릭하면 현재 움직이는 공(ball)로 재활성화
            ball.visible = true;
            ball.isFixed = false;
            ball.x = fb.x;
            ball.y = fb.y;
            ball.r = fb.r;
            ball.color = fb.color;
            
            // 기존 fixedBalls 배열에서 이 공을 제거
            fixedBalls.splice(i, 1); 
            ball.fixedBallRef = null; 

            currentTypedColor = ''; 
            isBallGrabbed = true; // 클릭하자마자 마우스로 잡은 상태로 시작

            return true; 
        }
    }
    return false;
}


if (canvas) {
    canvas.addEventListener('mousedown', (e) => {
        const { mouseX, mouseY } = getCanvasMousePos(e);
        const { cell, cornerIndex } = getCellAndCorner(mouseX, mouseY);
        
        // 1. 고정된 공 클릭 처리 (재활성화)
        if (handleFixedBallClick(mouseX, mouseY)) {
            return;
        }

        // 2. 현재 움직이는 공 클릭 처리 (드래그 시작)
        const distToBallCenter = Math.sqrt(Math.pow(mouseX - ball.x, 2) + Math.pow(mouseY - ball.y, 2));
        if (ball.visible && !ball.isFixed && distToBallCenter < ball.r * 1.5) {
            isBallGrabbed = true;
            isDragging = false; 
            mergeStartCell = null; 
            return;
        }

        // 3. 사각형 모서리/병합 클릭 처리
        if (cell && cornerIndex !== -1) { 
            isDragging = true;
            currentDragCell = cell;
            currentCornerIndex = cornerIndex;
            mergeStartCell = null; 
        } else if (cell && !cell.isMerged) { 
            mergeStartCell = cell;
            isDragging = false; 
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        const { mouseX, mouseY } = getCanvasMousePos(e);
        currentMouseX = mouseX; 
        currentMouseY = mouseY;
        
        if (cursorGuide) {
            cursorGuide.style.left = `${e.clientX}px`;
            cursorGuide.style.top = `${e.clientY}px`;
            cursorGuide.style.opacity = '1'; 
        }

        // HTML 커서 가이드 스타일 변경 (캔버스 드로잉과 분리)
        let guideSize = 60; 
        if (isBallGrabbed) {
            guideSize = 80;
            if (cursorGuide) cursorGuide.classList.add('cursor-guide-active');
        } else {
            if (cursorGuide) cursorGuide.classList.remove('cursor-guide-active');
        }

        if (cursorGuide) {
            cursorGuide.style.width = `${guideSize}px`;
            cursorGuide.style.height = `${guideSize}px`;
            cursorGuide.style.transform = `translate(-50%, -50%)`;
        }

        if (isDragging && currentDragCell) {
            
            const cell = currentDragCell;
            const cornerX = (currentCornerIndex === 1 || currentCornerIndex === 2) ? cell.x + cell.w : cell.x;
            const cornerY = (currentCornerIndex === 2 || currentCornerIndex === 3) ? cell.y + cell.h : cell.y;

            const deltaX = Math.abs(mouseX - cornerX);
            const deltaY = Math.abs(mouseY - cornerY);
            
            const dragDist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            
            const maxDragInfluence = 120;
            const newRadiusFactor = Math.min(3.0, dragDist / maxDragInfluence);
            
            cell.borderRadiusFactors[currentCornerIndex] = newRadiusFactor; 
        } 
        
        draw();
    });

    canvas.addEventListener('mouseup', () => {
        if (isBallGrabbed) {
            isBallGrabbed = false;
        }

        if (mergeStartCell) {
            const targetCell = getCellAt(currentMouseX, currentMouseY); 

            if (targetCell && targetCell !== mergeStartCell && !targetCell.isMerged) {
                const targetX = targetCell.x + targetCell.w / 2;
                const targetY = targetCell.y + targetCell.h / 2;
                
                const distToCenter = Math.sqrt(Math.pow(currentMouseX - targetX, 2) + Math.pow(currentMouseY - targetY, 2));
                
                if (distToCenter < MERGE_CENTER_THRESHOLD) {
                    handleMerge(targetCell);
                }
            }
        }
        
        isDragging = false;
        currentDragCell = null;
        currentCornerIndex = -1;
        mergeStartCell = null;
        
        if (cursorGuide) {
            cursorGuide.classList.remove('cursor-guide-active');
            cursorGuide.style.width = `60px`;
            cursorGuide.style.height = `60px`;
        }

        draw();
    });
}


// ==========================================================
// 병합 로직
// ==========================================================

function handleMerge(targetCell) {
    const c1 = mergeStartCell; 
    const c2 = targetCell;     

    const isSingleCell = (c2.gridMinX === c2.gridMaxX && c2.gridMinY === c2.gridMaxY);
    const isAdjacentStrictly = (
        (c2.gridMaxX === c1.gridMinX - 1 && c2.gridY >= c1.gridMinY && c2.gridY <= c1.gridMaxY) || 
        (c2.gridMinX === c1.gridMaxX + 1 && c2.gridY >= c1.gridMinY && c2.gridY <= c1.gridMaxY) || 
        (c2.gridMaxY === c1.gridMinY - 1 && c2.gridX >= c1.gridMinX && c2.gridX <= c1.gridMaxX) || 
        (c2.gridMinY === c1.gridMaxY + 1 && c2.gridX >= c1.gridMinX && c2.gridX <= c1.gridMaxX)    
    );
    
    if (isSingleCell && isAdjacentStrictly) {
        
        const newMinX = Math.min(c1.gridMinX, c2.gridMinX);
        const newMaxX = Math.max(c1.gridMaxX, c2.gridMaxX);
        const newMinY = Math.min(c1.gridMinY, c2.gridMinY);
        const newMaxY = Math.max(c1.gridMaxY, c2.gridMaxY);
        
        const newX = newMinX * (CELL_BASE_W + GAP) + GAP;
        const newY = newMinY * (CELL_BASE_H + GAP) + GAP;
        const newW = (newMaxX - newMinX + 1) * CELL_BASE_W + (newMaxX - newMinX) * GAP;
        const newH = (newMaxY - newMinY + 1) * CELL_BASE_H + (newMaxY - newMinY) * GAP;
        
        c1.x = newX;
        c1.y = newY;
        c1.w = newW;
        c1.h = newH;
        
        c1.gridMinX = newMinX; 
        c1.gridMaxX = newMaxX; 
        c1.gridMinY = newMinY; 
        c1.gridMaxY = newMaxY; 

        c2.isMerged = true; 
        
        if (mergedShapes.indexOf(c1) === -1) {
            mergedShapes.push(c1);
        }
    } else {
        console.log("병합 실패: 조건(단일 셀, 엄격한 인접)을 만족하지 못했습니다.");
    }

    mergeStartCell = null; 
    draw();
}

// ==========================================================
// 공 및 키보드 로직
// ==========================================================

function processColorChange() {
    const colorKey = currentTypedColor.toLowerCase();
    let colorChanged = false;
    
    if (colorMap[colorKey]) {
        ball.color = colorMap[colorKey];
        colorChanged = true;
    } 
    else {
        let hexCode = colorKey;
        if (!hexCode.startsWith('#')) {
            hexCode = '#' + hexCode;
        }
        if (hexCode.match(/^#([0-9a-f]{3}){1,2}$/i)) {
             ball.color = hexCode;
             colorChanged = true;
        }
    }
    
    if (colorChanged) {
        currentTypedColor = ''; 
    }
    
    return colorChanged;
}

document.addEventListener('keydown', (e) => {
    
    // --- 1. Reset Logic ---
    if (e.key === 'Escape') {
        ball.visible = false;
        ball.isFixed = false;
        fixedBalls = []; 
        ball.fixedBallRef = null;
        mergedShapes.length = 0;
        grid = initializeGrid();
        currentTypedColor = ''; 
        isBallGrabbed = false; 
        draw();
        return;
    }

    // --- 2. Ball Control (B: 띄우기, Enter: 고정) ---
    if (e.key.toUpperCase() === 'B') {
        if (!ball.visible || ball.isFixed) {
            ball.visible = true;
            ball.isFixed = false;
            ball.fixedBallRef = null;
            
            currentTypedColor = ''; 
            isBallGrabbed = false; 
            
            const allCells = grid.flat();
            const unmergedCells = allCells.filter(c => !c.isMerged && mergedShapes.indexOf(c) === -1);
            
            if (unmergedCells.length > 0) {
                const randomCell = unmergedCells[Math.floor(Math.random() * unmergedCells.length)];
                
                ball.x = randomCell.x + randomCell.w / 2;
                ball.y = randomCell.y + randomCell.h / 2;
                ball.color = getRandomColor(); 
            } else {
                ball.visible = false; 
                console.log("모든 셀이 병합되어 공을 배치할 수 없습니다.");
            }
        }
        draw();
        return;
    } 
    
    // Enter 로직: 공이 움직이는 상태일 때만 고정
    if (ball.visible && !ball.isFixed && e.key === 'Enter') {
        e.preventDefault(); 
        
        ball.isFixed = true;
        currentTypedColor = ''; 
        isBallGrabbed = false; 
        
        const newFixedBall = {
            x: ball.x, y: ball.y, r: ball.r, color: ball.color, id: nextFixedBallId++
        };
        fixedBalls.push(newFixedBall);
        ball.fixedBallRef = newFixedBall; 

        // 공을 고정했으므로, 움직이는 공은 숨김 처리
        ball.visible = false; 
        
        draw();
        return;
    }

    // --- 3. Color Typing & Manual Movement (움직이는 상태일 때만) ---
    if (ball.visible && !isBallGrabbed && !ball.isFixed) {
        
        // Manual Movement (Arrow Keys)
        let dx = 0;
        let dy = 0;
        
        if (e.key === 'ArrowUp') dy = -BALL_MANUAL_SPEED;
        else if (e.key === 'ArrowDown') dy = BALL_MANUAL_SPEED;
        else if (e.key === 'ArrowLeft') dx = -BALL_MANUAL_SPEED;
        else if (e.key === 'ArrowRight') dx = BALL_MANUAL_SPEED;

        if (dx !== 0 || dy !== 0) {
            e.preventDefault(); 
            
            ball.x += dx;
            ball.y += dy;
            
            ball.x = Math.max(ball.r, Math.min(CANVAS_WIDTH - ball.r, ball.x));
            ball.y = Math.max(ball.r, Math.min(CANVAS_HEIGHT - ball.r, ball.y));
            
            draw();
            return;
        }
        
        // 색상 타이핑 로직
        const char = e.key;
        
        if (char.length === 1 && /^[a-zA-Z0-9#]$/.test(char)) {
            currentTypedColor += char;
            processColorChange();
            draw();
            return; 
        } else if (e.key === 'Backspace' && currentTypedColor.length > 0) {
            currentTypedColor = currentTypedColor.slice(0, -1);
            processColorChange();
            draw();
            return; 
        }
    }

    draw(); 
});


// ==========================================================
// 애니메이션 루프
// ==========================================================
function animate() {
    if (ball.visible && isBallGrabbed && !ball.isFixed) {
        const targetX = currentMouseX;
        const targetY = currentMouseY;

        ball.x += (targetX - ball.x) * GRAB_FOLLOW_SPEED;
        ball.y += (targetY - ball.y) * GRAB_FOLLOW_SPEED;

        ball.x = Math.max(ball.r, Math.min(CANVAS_WIDTH - ball.r, ball.x));
        ball.y = Math.max(ball.r, Math.min(CANVAS_HEIGHT - ball.r, ball.y));
    }
    
    draw();     
    requestAnimationFrame(animate);
}

if (canvas && ctx) {
    draw();
    animate(); 
}