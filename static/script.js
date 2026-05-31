// ══ State ══════════════════════════════════════════════════
let allLogLines   = [];
let autoScroll    = true;
let liveCount     = 0;
let charts        = {};
let analysisTimer = null;
let uploadedStats = null;

// ══ Navigation ═════════════════════════════════════════════
function goTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelectorAll('.nav-tab')[
    ['dashboard','live','analyze','report'].indexOf(page)
  ].classList.add('active');

  if (page === 'dashboard') loadDashboard();
  if (page === 'report')    loadLatestReport();
}

// ══ Toast ══════════════════════════════════════════════════
function toast(msg, type='info') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = `toast show ${type}`;
  setTimeout(() => el.classList.remove('show'), 3500);
}

// ══ Cowrie Control ═════════════════════════════════════════
function updateStatusUI(running) {
  const pill = document.getElementById('statusPill');
  const txt  = document.getElementById('statusText');
  pill.className = 'status-pill ' + (running ? 'on' : 'off');
  txt.textContent = running ? 'ONLINE' : 'OFFLINE';
  document.getElementById('btnStart').disabled = running;
  document.getElementById('btnStop').disabled  = !running;
}

async function checkStatus() {
  try {
    const r = await fetch('/api/cowrie/status');
    const d = await r.json();
    updateStatusUI(d.running);
  } catch {}
}

async function cowrieStart() {
  const btnStart = document.getElementById('btnStart');
  btnStart.disabled = true;
  btnStart.textContent = '⏳ Starting...';
  toast('Starting Cowrie...', 'info');
  try {
    const r = await fetch('/api/cowrie/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const d = await r.json();
    if (d.success) {
      updateStatusUI(true);
      toast('✓ Cowrie started!', 'ok');
    } else {
      toast('⚠ ' + d.message, 'err');
      btnStart.disabled = false;
    }
  } catch(e) {
    toast('Error: ' + e.message, 'err');
    btnStart.disabled = false;
  } finally {
    btnStart.textContent = '▶ Start';
  }
}

async function cowrieStop() {
  const btnStop = document.getElementById('btnStop');
  btnStop.disabled = true;
  btnStop.textContent = '⏳ Stopping...';
  toast('Stopping Cowrie...', 'info');
  try {
    const r = await fetch('/api/cowrie/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const d = await r.json();
    if (d.success) {
      updateStatusUI(false);
      toast('Cowrie stopped', 'info');
    } else {
      toast('⚠ ' + d.message, 'err');
      btnStop.disabled = false;
    }
  } catch(e) {
    toast('Error: ' + e.message, 'err');
    btnStop.disabled = false;
  } finally {
    btnStop.textContent = '■ Stop';
  }
}

// ══ Dashboard ══════════════════════════════════════════════
async function loadDashboard() {
  try {
    const r = await fetch('/api/dashboard/stats');
    const d = await r.json();

    document.getElementById('dSessions').textContent  = d.total_sessions   || 0;
    document.getElementById('dIPs').textContent       = d.unique_ips        || 0;
    document.getElementById('dCommands').textContent  = d.total_commands    || 0;
    document.getElementById('dLogins').textContent    = d.login_attempts    || 0;
    document.getElementById('dDownloads').textContent = d.files_downloaded  || 0;
    document.getElementById('dDangerous').textContent = d.dangerous_commands|| 0;

    // Top IPs
    const ipEl = document.getElementById('topIPs');
    if (d.top_ips && d.top_ips.length) {
      ipEl.innerHTML = d.top_ips.map((ip,i) =>
        `<span style="color:var(--muted)">${String(i+1).padStart(2,'0')}.</span> <span style="color:var(--cyan)">${ip}</span>`
      ).join('<br>');
    }

    // Charts
    buildAttackChart(d);
    buildActivityChart(d);
  } catch(e) { console.error(e); }
}

function buildAttackChart(d) {
  const ctx = document.getElementById('chartAttack');
  if (charts.attack) charts.attack.destroy();
  charts.attack = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Login Attempts', 'Commands', 'Downloads', 'Dangerous'],
      datasets: [{
        data: [
          d.login_attempts    || 0,
          d.total_commands    || 0,
          d.files_downloaded  || 0,
          d.dangerous_commands|| 0,
        ],
        backgroundColor: ['#ff8c00','#00e5ff','#ff3d5a','#b060ff'],
        borderColor: '#0d1520', borderWidth: 3,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 2,
      plugins: { legend: { labels: { color:'#ccd8e8', padding:10, font:{size:11} } } },
      cutout: '60%',
    }
  });
}

function buildActivityChart(d) {
  const ctx = document.getElementById('chartActivity');
  if (charts.activity) charts.activity.destroy();
  charts.activity = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Sessions','Unique IPs','Commands','Logins','Downloads','Dangerous'],
      datasets: [{
        data: [
          d.total_sessions    || 0,
          d.unique_ips        || 0,
          d.total_commands    || 0,
          d.login_attempts    || 0,
          d.files_downloaded  || 0,
          d.dangerous_commands|| 0,
        ],
        backgroundColor: ['#00e5ff55','#ff8c0055','#00ff8855','#ff3d5a55','#ffe50055','#b060ff55'],
        borderColor:      ['#00e5ff',  '#ff8c00',  '#00ff88',  '#ff3d5a',  '#ffe500',  '#b060ff' ],
        borderWidth: 2, borderRadius: 6,
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color:'#3d5570', font:{size:10} }, grid: { color:'#162030' } },
        y: { ticks: { color:'#3d5570' },                 grid: { color:'#162030' } },
      }
    }
  });
}

// ══ Live Logs ══════════════════════════════════════════════
function classifyEvent(eid) {
  if (eid.includes('login.failed'))  return 'login-fail';
  if (eid.includes('login.success')) return 'login-ok';
  if (eid.includes('command'))       return 'command';
  if (eid.includes('download'))      return 'download';
  if (eid.includes('connect'))       return 'connect';
  return '';
}

function formatEvent(e) {
  const eid = e.eventid || '';
  if (eid.includes('login.failed'))  return `LOGIN FAILED  user=${e.username} pass=${e.password}`;
  if (eid.includes('login.success')) return `LOGIN SUCCESS user=${e.username} pass=${e.password}`;
  if (eid.includes('command.input')) return `CMD  ${e.input}`;
  if (eid.includes('download'))      return `DOWNLOAD  ${e.url || e.shasum || ''}`;
  if (eid.includes('connect'))       return `CONNECT  src=${e.src_ip}`;
  if (eid.includes('closed'))        return `SESSION CLOSED  duration=${e.duration}s`;
  return eid;
}

function addLogLine(e) {
  const term   = document.getElementById('logTerminal');
  // Clear placeholder
  const empty  = term.querySelector('.log-empty');
  if (empty) empty.remove();

  const cls    = classifyEvent(e.eventid || '');
  const time   = (e.timestamp || '').slice(11,19) || new Date().toTimeString().slice(0,8);
  const detail = `${e.src_ip || ''}  ${formatEvent(e)}`;

  allLogLines.push({ cls, time, event: e.eventid || '', detail, raw: e });

  const div    = document.createElement('div');
  div.className= `log-line ${cls}`;
  div.innerHTML= `<span class="log-time">${time}</span><span class="log-event">${(e.eventid||'').replace('cowrie.','')}</span><span class="log-detail">${detail}</span>`;
  term.appendChild(div);

  liveCount++;
  document.getElementById('logCount').textContent = liveCount + ' events';
  const badge = document.getElementById('liveBadge');
  badge.textContent = liveCount;
  badge.classList.add('show');

  if (autoScroll) term.scrollTop = term.scrollHeight;
}

function filterLogs() {
  const q = document.getElementById('logFilter').value.toLowerCase();
  document.querySelectorAll('.log-line').forEach(el => {
    el.style.display = (!q || el.textContent.toLowerCase().includes(q)) ? '' : 'none';
  });
}

function clearLogs() {
  document.getElementById('logTerminal').innerHTML =
    '<div class="log-empty">📡 Cleared. Waiting for new events...</div>';
  allLogLines = []; liveCount = 0;
  document.getElementById('logCount').textContent = '0 events';
  document.getElementById('liveBadge').classList.remove('show');
}

function toggleAutoScroll() {
  autoScroll = !autoScroll;
  document.getElementById('btnScroll').textContent =
    autoScroll ? '⬇ Auto-scroll ON' : '⬇ Auto-scroll OFF';
}

// SSE connection
function connectSSE() {
  const es = new EventSource('/api/logs/stream');
  es.onmessage = e => {
    try { addLogLine(JSON.parse(e.data)); } catch {}
  };
  es.onerror = () => setTimeout(connectSSE, 1000);
}

// ══ Upload ═════════════════════════════════════════════════
const uploadArea = document.getElementById('uploadArea');
uploadArea.addEventListener('dragover',  e => { e.preventDefault(); uploadArea.classList.add('over'); });
uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('over'));
uploadArea.addEventListener('drop', e => {
  e.preventDefault(); uploadArea.classList.remove('over');
  if (e.dataTransfer.files[0]) uploadFile(e.dataTransfer.files[0]);
});

function handleUpload(input) {
  if (input.files[0]) uploadFile(input.files[0]);
}

async function uploadFile(file) {
  const fd = new FormData();
  fd.append('file', file);
  toast('Uploading...', 'info');
  try {
    const r = await fetch('/api/logs/upload', { method:'POST', body: fd });
    const d = await r.json();
    if (d.success) {
      uploadArea.classList.add('loaded');
      document.getElementById('filePill').classList.add('show');
      document.getElementById('pillName').textContent = file.name;
      document.getElementById('pillSize').textContent = formatBytes(file.size);
      uploadedStats = d.stats;
      showQuickStats(d.stats);
      toast('✓ Log uploaded!', 'ok');
    } else toast('⚠ ' + d.message, 'err');
  } catch(e) { toast('Upload failed: ' + e.message, 'err'); }
}

function showQuickStats(s) {
  document.getElementById('quickStats').innerHTML = `
    <span style="color:var(--cyan)">Sessions        </span><span style="color:#fff">${s.total_sessions}</span><br>
    <span style="color:var(--cyan)">Unique IPs      </span><span style="color:#fff">${s.unique_ips}</span><br>
    <span style="color:var(--cyan)">Login Attempts  </span><span style="color:var(--orange)">${s.login_attempts}</span><br>
    <span style="color:var(--cyan)">Commands        </span><span style="color:var(--yellow)">${s.total_commands}</span><br>
    <span style="color:var(--cyan)">Downloads       </span><span style="color:var(--red)">${s.files_downloaded}</span><br>
    <span style="color:var(--cyan)">Dangerous Cmds  </span><span style="color:var(--red)">${s.dangerous_commands}</span><br>
    <br>
    <span style="color:var(--muted)">Top IPs:</span><br>
    ${(s.top_ips||[]).map(ip=>`  <span style="color:var(--green)">${ip}</span>`).join('<br>')||'—'}
  `;
}

// ══ AI Analysis ════════════════════════════════════════════
async function startAnalysis() {
  const key = document.getElementById('apiKeyInput').value.trim();
  if (!key) { toast('Enter your API key', 'err'); return; }

  document.getElementById('btnAnalyze').disabled = true;
  const pw = document.getElementById('progressWrap');
  pw.classList.add('show');
  setProgress(10, 'Sending logs to Gemini AI...');
  toast('Analysis started...', 'info');

  try {
    const r = await fetch('/api/analyze', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ api_key: key })
    });
    const d = await r.json();
    if (!d.success) {
      toast('⚠ ' + d.message, 'err');
      document.getElementById('btnAnalyze').disabled = false;
      pw.classList.remove('show');
      return;
    }
    setProgress(40, 'AI is analyzing attack patterns...');
    pollAnalysis();
  } catch(e) {
    toast('Error: ' + e.message, 'err');
    document.getElementById('btnAnalyze').disabled = false;
    pw.classList.remove('show');
  }
}

function pollAnalysis() {
  if (analysisTimer) clearInterval(analysisTimer);
  let pct = 40;
  analysisTimer = setInterval(async () => {
    pct = Math.min(pct + 5, 90);
    setProgress(pct, 'Gemini is reading your logs...');
    try {
      const r = await fetch('/api/analyze/result');
      const d = await r.json();
      if (d.done) {
        clearInterval(analysisTimer);
        if (d.error) {
          toast('⚠ ' + d.error, 'err');
          setProgress(0, '');
        } else {
          setProgress(100, '✓ Analysis complete!');
          toast('✓ Report generated!', 'ok');
          setTimeout(() => {
            document.getElementById('progressWrap').classList.remove('show');
            document.getElementById('btnAnalyze').disabled = false;
            goTo('report');
          }, 1200);
        }
      }
    } catch {}
  }, 2000);
}

function setProgress(pct, label) {
  document.getElementById('progressBar').style.width = pct + '%';
  document.getElementById('progressLabel').textContent = label;
  if (pct >= 100) {
    document.getElementById('progressBar').classList.remove('pulse');
  }
}

// ══ Report ═════════════════════════════════════════════════
async function loadLatestReport() {
  try {
    const r = await fetch('/api/report/latest');
    const d = await r.json();
    if (d.exists) {
      renderReport(d.report);
      document.getElementById('reportMeta').textContent = d.name;
    }
  } catch {}
}

function renderReport(text) {
  const el = document.getElementById('reportContent');
  let html = text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/(═+.*?═+)/g, '<span class="r-title">$1</span>')
    .replace(/(\d+\.\s+[A-Z][A-Z\s&()]+)/g, '<span class="r-section">$1</span>')
    .replace(/\bCRITICAL\b/g, '<span class="r-critical">CRITICAL</span>')
    .replace(/\bHIGH\b/g,     '<span class="r-high">HIGH</span>')
    .replace(/\bMEDIUM\b/g,   '<span class="r-medium">MEDIUM</span>')
    .replace(/\bLOW\b/g,      '<span class="r-low">LOW</span>');
  el.innerHTML = html;
}

async function downloadReport() {
  try {
    const r = await fetch('/api/report/download');
    if (r.ok) {
      const blob = await r.blob();
      const a    = document.createElement('a');
      a.href     = URL.createObjectURL(blob);
      a.download = `honeypot_report_${new Date().toISOString().slice(0,10)}.txt`;
      a.click();
      toast('✓ Report downloaded!', 'ok');
    } else toast('No report found. Run analysis first.', 'err');
  } catch(e) { toast('Download failed: ' + e.message, 'err'); }
}

// ══ Helpers ════════════════════════════════════════════════
function formatBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b/1024).toFixed(1) + ' KB';
  return (b/1048576).toFixed(1) + ' MB';
}

// ══ Init ═══════════════════════════════════════════════════
checkStatus();
setInterval(checkStatus, 2000);
loadDashboard();
setInterval(() => {
  if (document.getElementById('page-dashboard').classList.contains('active')) {
    loadDashboard();
  }
}, 2000);
connectSSE();