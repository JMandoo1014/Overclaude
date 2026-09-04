'use strict';

const els = {
  body: document.body,
  fivePct: document.getElementById('five-pct'),
  fiveBar: document.getElementById('five-bar'),
  fiveReset: document.getElementById('five-reset'),
  sevenPct: document.getElementById('seven-pct'),
  sevenBar: document.getElementById('seven-bar'),
  sevenReset: document.getElementById('seven-reset'),
  status: document.getElementById('status-line'),
  refreshBtn: document.getElementById('refresh-btn'),
};

els.refreshBtn.addEventListener('click', () => {
  window.overclaude.requestRefresh();
});

let lastPayload = { status: 'loading' };

function colorFor(pct) {
  if (pct >= 80) return 'var(--high)';
  if (pct >= 50) return 'var(--mid)';
  return 'var(--low)';
}

function formatCountdown(isoString) {
  if (!isoString) return '리셋 정보 없음';
  const target = new Date(isoString).getTime();
  if (Number.isNaN(target)) return '리셋 정보 없음';

  const diffMs = target - Date.now();
  if (diffMs <= 0) return '곧 리셋';

  const totalMinutes = Math.round(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) return `${hours}시간 ${minutes}분 후 리셋`;
  return `${minutes}분 후 리셋`;
}

function renderMetric(pctEl, barEl, resetEl, metric) {
  const pct = metric?.percent;
  if (pct === null || pct === undefined) {
    pctEl.textContent = '--%';
    barEl.style.width = '0%';
    resetEl.textContent = '리셋 정보 없음';
    return;
  }
  pctEl.textContent = `${pct}%`;
  barEl.style.width = `${Math.max(0, Math.min(100, pct))}%`;
  barEl.style.backgroundColor = colorFor(pct);
  resetEl.textContent = formatCountdown(metric.resetsAt);
}

function renderRefreshButton(payload) {
  const spinning = !!payload.refreshing;
  els.refreshBtn.classList.toggle('spinning', spinning);
  els.refreshBtn.disabled = spinning;
}

function render() {
  const payload = lastPayload;
  renderRefreshButton(payload);

  if (payload.status === 'loading') {
    els.body.classList.add('status-mode');
    els.status.textContent = '사용량 불러오는 중...';
    return;
  }

  if (payload.status === 'auth_required') {
    els.body.classList.add('status-mode');
    els.status.textContent = '로그인이 필요합니다\n메뉴(우클릭) → 재로그인';
    return;
  }

  if (payload.status === 'error') {
    els.body.classList.add('status-mode');
    els.status.textContent = `⚠️ ${payload.message || '알 수 없는 오류'}`;
    return;
  }

  els.body.classList.remove('status-mode');
  renderMetric(els.fivePct, els.fiveBar, els.fiveReset, payload.fiveHour);
  renderMetric(els.sevenPct, els.sevenBar, els.sevenReset, payload.sevenDay);
}

window.overclaude.onUsageUpdate((payload) => {
  lastPayload = payload;
  render();
});

// Keep reset countdowns ticking between polls without waiting on new data.
setInterval(render, 30000);

render();
