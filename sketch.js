let table;
let quiz = [];
let current = 0;
let score = 0;
let totalQuestions = 4; // 從題庫亂數抽取數量（改為 4 題）
// optionTexts: 4 個選項文字
let optionTexts = [];
// optionStates: 'normal' | 'disabled' | 'correct' | 'wrong'
let optionStates = [];
// optionRects: 儲存每個選項在 canvas 的位置與大小
let optionRects = [];
let nextButton;
let restartButton;
let state = 'loading'; // loading, question, feedback, result
let feedbackText = '';
let confetti = [];
let shakeAmt = 0;
let osc;
let canvas;

function preload() {
  // 載入 CSV，請放在專案根目錄
  table = loadTable('questions.csv', 'csv', 'header');
}

function setup() {
  let cw = floor(windowWidth * 0.8);
  let ch = floor(windowHeight * 0.9);
  canvas = createCanvas(cw, ch);
  canvas.parent('canvas-container');
  textFont('Arial');

  // 使用 canvas 繪製選項（不建立 DOM 按鈕）
  for (let i = 0; i < 4; i++) {
    optionTexts.push('');
    optionStates.push('normal');
    optionRects.push({x:0,y:0,w:0,h:0});
  }
  nextButton = createButton('下一題');
  nextButton.class('next-btn');
  nextButton.mousePressed(nextQuestion);
  nextButton.parent('controls');
  nextButton.hide();

  restartButton = createButton('重新開始');
  restartButton.class('restart-btn');
  restartButton.mousePressed(startQuiz);
  restartButton.parent('controls');
  restartButton.hide();

  // 簡單音效
  osc = new p5.Oscillator('sine');

  if (!table || table.getRowCount() === 0) {
    state = 'error';
    console.error('無法載入 questions.csv 或題庫為空');
  } else {
    startQuiz();
  }
  positionButtons();
}

function windowResized() {
  let cw = floor(windowWidth * 0.8);
  let ch = floor(windowHeight * 0.9);
  resizeCanvas(cw, ch);
  positionButtons();
}

function positionButtons() {
  const canvasRect = canvas.elt.getBoundingClientRect();
  const btnY = canvasRect.bottom - 60;
  const btnX = canvasRect.left + canvasRect.width / 2;
  nextButton.position(btnX - 60, btnY);
  restartButton.position(btnX + 60, btnY);
}

function startQuiz() {
  // 重設
  quiz = [];
  current = 0;
  score = 0;
  feedbackText = '';
  confetti = [];
  shakeAmt = 0;

  // 從 table 中亂數抽取 totalQuestions 題（不重複）
  // 先把每一列轉成純物件，避免直接使用 TableRow 導致欄位存取失敗
  const rawRows = table.getRows();
  const rows = rawRows.map(r => {
    try {
      return {
        question: r.get('question'),
        optionA: r.get('optionA'),
        optionB: r.get('optionB'),
        optionC: r.get('optionC'),
        optionD: r.get('optionD'),
        answer: r.get('answer'),
        explanation: (r.get('explanation') || '')
      };
    } catch (e) {
      // 如果沒有 header，嘗試以索引取值備援
      return {
        question: r.getString(0),
        optionA: r.getString(1),
        optionB: r.getString(2),
        optionC: r.getString(3),
        optionD: r.getString(4),
        answer: r.getString(5),
        explanation: r.getString(6) || ''
      };
    }
  });
  // shuffle
  for (let i = rows.length - 1; i > 0; i--) {
    const j = floor(random(i + 1));
    const tmp = rows[i];
    rows[i] = rows[j];
    rows[j] = tmp;
  }
  const pickCount = min(totalQuestions, rows.length);
  quiz = rows.slice(0, pickCount);

  // 顯示第一題
  console.log('startQuiz: rows=', rows.length, 'pickCount=', pickCount);
  console.log('startQuiz: sample row0=', rows[0]);
  showQuestion();
  state = 'question';
  nextButton.hide();
  restartButton.hide();
}

function showQuestion() {
  // 將題目與選項文字套入按鈕
  const q = quiz[current];
  if (!q) {
    // 如果發生未找到題目的狀況，重設為第一題或顯示錯誤
    console.warn('showQuestion: 無效題目 index', current, 'quiz length', quiz.length);
    current = 0;
    if (!quiz[0]) {
      const statusEl = select('#status');
      if (statusEl) statusEl.html('<div class="qnum">無可用題目</div>');
      optionTexts = ['','','',''];
      optionStates = ['disabled','disabled','disabled','disabled'];
      return;
    }
  }

  const statusEl = select('#status');
  const totalDisplay = quiz.length || totalQuestions;
  if (statusEl) statusEl.html(`<div class="qnum">題目 ${current + 1} / ${totalDisplay}</div>`);
  optionTexts = [q.optionA || q.option1 || '', q.optionB || q.option2 || '', q.optionC || q.option3 || '', q.optionD || q.option4 || ''];
  optionStates = ['normal','normal','normal','normal'];
  console.log('showQuestion: current=', current, 'q=', q);
  console.log('showQuestion: optionTexts=', optionTexts);
}

function handleAnswer(i) {
  if (state !== 'question') return;
  const q = quiz[current];
  const chosen = ['A', 'B', 'C', 'D'][i];
  const correct = q.answer.trim().toUpperCase();

  // 禁止再按（以 state 標記）
  for (let k = 0; k < optionStates.length; k++) optionStates[k] = 'disabled';

  if (chosen === correct) {
    score++;
    feedbackText = '答對！' + (q.explanation ? (' 解說：' + q.explanation) : '');
    playTone(880, 0.15);
    spawnConfetti(30);
    optionStates[i] = 'correct';
  } else {
    feedbackText = '答錯！正確答案：' + correct + (q.explanation ? ('；解說：' + q.explanation) : '');
    playTone(220, 0.18);
    shakeAmt = 12;
    optionStates[i] = 'wrong';
    const correctIndex = {A:0,B:1,C:2,D:3}[correct];
    if (typeof correctIndex !== 'undefined') optionStates[correctIndex] = 'correct';
  }

  state = 'feedback';
  nextButton.show();
}

function nextQuestion() {
  current++;
  nextButton.hide();
  if (current >= quiz.length) {
    state = 'result';
    showResult();
  } else {
    state = 'question';
    showQuestion();
  }
}

function showResult() {
  // 清空畫面上的選項文字
  optionTexts = ['','','',''];
  optionStates = ['disabled','disabled','disabled','disabled'];
  let msg = '';
  if (score === totalQuestions) msg = '太棒了！全對👏';
  else if (score >= totalQuestions - 1) msg = '表現不錯，繼續加油！';
  else if (score > 0) msg = '有進步空間，建議再練習題目。';
  else msg = '需要多加練習，再試一次吧。';

  const statusEl = select('#status');
  if (statusEl) statusEl.html(`<div class="result">你的分數：${score} / ${totalQuestions}<div class="result-msg">${msg}</div></div>`);
  restartButton.show();
}

function draw() {
  background(40, 48, 63);

  // 應用搖晃效果
  if (shakeAmt > 0) {
    translate(random(-shakeAmt, shakeAmt), random(-shakeAmt, shakeAmt));
    shakeAmt = lerp(shakeAmt, 0, 0.2);
    if (shakeAmt < 0.5) shakeAmt = 0;
  }

  // 動態字型大小
  let baseFont = max(18, floor(height * 0.045));
  let optionFont = max(16, floor(height * 0.035));

  // 面板與選項大小
  const boxH = max(48, floor(height * 0.13));
  const gap = max(12, floor(width * 0.02));
  const panelPadding = max(16, floor(width * 0.03));
  const questionAreaH = max(80, floor(height * 0.18));
  const panelW = min(width - 80, floor(width * 0.9));
  const panelH = questionAreaH + (boxH * 2 + gap) + panelPadding * 2;
  const panelX = (width - panelW) / 2;
  const panelY = (height - panelH) / 2;

  // 白色面板
  push();
  noStroke();
  fill(0, 0, 0, 40);
  rect(panelX + 6, panelY + 6, panelW, panelH, 12);
  fill(255);
  rect(panelX, panelY, panelW, panelH, 12);
  pop();

  // 題目文字
  push();
  fill(20);
  textAlign(LEFT, TOP);
  textSize(baseFont);
  const qTextX = panelX + panelPadding;
  const qTextY = panelY + panelPadding;
  let qText = '';
  const q = quiz[current];
  if (q) qText = q.question || Object.values(q)[0] || '';
  if (qText) {
    text(`Q${current + 1}: ${qText}`, qTextX, qTextY, panelW - panelPadding * 2, questionAreaH);
  } else if (state === 'loading') {
    text('載入中...', qTextX, qTextY);
  } else if (state === 'error') {
    text('題庫載入失敗，請確認 questions.csv 存在且有資料。', qTextX, qTextY, panelW - panelPadding * 2, questionAreaH);
  } else {
    text('目前沒有可用題目（請確認 questions.csv 是否存在與有資料）', qTextX, qTextY, panelW - panelPadding * 2, questionAreaH);
    return;
  }
  pop();

  // 選項卡片
  const optsStartX = panelX + panelPadding;
  const optsStartY = panelY + panelPadding + questionAreaH;
  const optsInnerW = panelW - panelPadding * 2;
  const innerBoxW = (optsInnerW - gap) / 2;

  for (let i = 0; i < 4; i++) {
    const col = i % 2;
    const row = floor(i / 2);
    const x = optsStartX + col * (innerBoxW + gap);
    const y = optsStartY + row * (boxH + gap);
    optionRects[i] = {x, y, w: innerBoxW, h: boxH};

    noStroke();
    fill(0, 0, 0, 24);
    rect(x + 4, y + 4, innerBoxW, boxH, 8);

    fill(255);
    stroke(220);
    strokeWeight(1);
    rect(x, y, innerBoxW, boxH, 8);

    if (optionStates[i] === 'correct') {
      noStroke();
      fill(182, 240, 194, 200);
      rect(x, y, innerBoxW, boxH, 8);
    } else if (optionStates[i] === 'wrong') {
      noStroke();
      fill(255, 214, 214, 200);
      rect(x, y, innerBoxW, boxH, 8);
    }

    // 文字
    noStroke();
    textAlign(LEFT, TOP);
    textSize(optionFont);
    if (optionStates[i] === 'disabled') fill(140);
    else fill(20);
    const label = ['A','B','C','D'][i] + '. ' + (optionTexts[i] || '');
    const textX = x + 12;
    const textY = y + 10;
    text(label, textX, textY, innerBoxW - 24, boxH - 16);
  }

  // confetti
  for (let i = confetti.length - 1; i >= 0; i--) {
    const p = confetti[i];
    p.vy += 0.2;
    p.x += p.vx;
    p.y += p.vy;
    push();
    translate(p.x, p.y);
    rotate(p.rot);
    fill(p.col);
    rect(-p.s/2, -p.s/2, p.s, p.s);
    pop();
    p.rot += 0.1;
    if (p.y > height + 50) confetti.splice(i, 1);
  }

  // 回饋
  if (state === 'feedback') {
    fill(255, 255, 255, 220);
    rect(panelX + 24, panelY + panelH - 100, panelW - 48, 80, 8);
    fill(20);
    textSize(optionFont);
    textAlign(LEFT, TOP);
    text(feedbackText, panelX + 36, panelY + panelH - 88, panelW - 96, 64);
  }
}

function spawnConfetti(n) {
  for (let i = 0; i < n; i++) {
    confetti.push({
      x: random(width/2 - 60, width/2 + 60),
      y: random(0, 40),
      vx: random(-2, 2),
      vy: random(1, 3),
      rot: random(TAU),
      s: random(6, 12),
      col: color(random(80, 255), random(80, 255), random(80, 255))
    });
  }
}

function playTone(freq, dur) {
  osc.start();
  osc.freq(freq);
  osc.amp(0.2, 0.02);
  setTimeout(() => {
    osc.amp(0, 0.1);
    setTimeout(() => osc.stop(), 120);
  }, dur * 1000);
}

function mousePressed() {
  // 在 canvas 上點選選項
  if (state !== 'question') return;
  // mouseX/mouseY 是相對於 canvas
  for (let i = 0; i < optionRects.length; i++) {
    const r = optionRects[i];
    if (!r) continue;
    if (mouseX >= r.x && mouseX <= r.x + r.w && mouseY >= r.y && mouseY <= r.y + r.h) {
      handleAnswer(i);
      break;
    }
  }
}

