// SmartKhum — dashboard logic (Stage 3: Map & Dashboard)

(function () {
  const CATEGORY_LABEL_KM = {
    water: 'ទឹក', road: 'ផ្លូវ', health: 'សុខភាព', environment: 'បរិស្ថាន', other: 'ផ្សេងៗ'
  };
  const STATUS_LABEL_KM = {
    Pending: 'កំពុងរង់ចាំ', InProgress: 'កំពុងដោះស្រាយ', Resolved: 'ដោះស្រាយរួច'
  };
  const PRIORITY_COLOR = { High: '#B23A2E', Medium: '#C08A25', Low: '#4C6B3F' };

  // Default view: Cambodia
  const map = L.map('map').setView([12.5657, 104.9910], 7);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 18
  }).addTo(map);

  let markers = [];

  function clearMarkers() {
    markers.forEach(m => map.removeLayer(m));
    markers = [];
  }

  function priorityMarker(issue) {
    const color = PRIORITY_COLOR[issue.priority] || '#5B5646';
    return L.circleMarker([issue.latitude, issue.longitude], {
      radius: issue.priority === 'High' ? 10 : (issue.priority === 'Medium' ? 8 : 6),
      fillColor: color,
      color: '#fff',
      weight: 2,
      fillOpacity: 0.9
    }).bindPopup(
      `<strong>${escapeHtml(issue.description).slice(0, 90)}</strong><br>` +
      `${CATEGORY_LABEL_KM[issue.category] || issue.category} · ${issue.priority} · ${STATUS_LABEL_KM[issue.status] || issue.status}` +
      (issue.village ? `<br>📍 ${escapeHtml(issue.village)}` : '')
    );
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function currentFilters() {
    return {
      category: document.getElementById('filter-category').value,
      priority: document.getElementById('filter-priority').value,
      status: document.getElementById('filter-status').value
    };
  }

  async function loadStats() {
    const res = await fetch('/api/stats');
    const data = await res.json();
    document.getElementById('stat-total').textContent = data.total;

    const high = (data.by_priority.find(p => p.priority === 'High') || {}).c || 0;
    document.getElementById('stat-high').textContent = high;

    const pending = (data.by_status.find(s => s.status === 'Pending') || {}).c || 0;
    document.getElementById('stat-pending').textContent = pending;

    const resolved = (data.by_status.find(s => s.status === 'Resolved') || {}).c || 0;
    document.getElementById('stat-resolved').textContent = resolved;
  }

  async function loadIssues() {
    const filters = currentFilters();
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });

    const res = await fetch('/api/issues?' + params.toString());
    const issues = await res.json();

    clearMarkers();
    const withLocation = issues.filter(i => i.latitude && i.longitude);
    withLocation.forEach(issue => {
      const marker = priorityMarker(issue);
      marker.addTo(map);
      markers.push(marker);
    });

    renderList(issues);
  }

  function renderList(issues) {
    const container = document.getElementById('issue-list');
    if (!issues.length) {
      container.innerHTML = `<div class="empty-state"><span class="icon">🌾</span>មិនទាន់មានករណីរាយការណ៍នៅឡើយទេ</div>`;
      return;
    }

    container.innerHTML = issues.slice(0, 20).map(issue => `
      <div style="padding:12px 0; border-bottom:1px solid var(--paper-line); display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap;">
        <div style="flex:1; min-width:220px;">
          <div style="font-weight:600;">${escapeHtml(issue.description).slice(0, 100)}</div>
          <div style="font-size:.8rem; color:var(--ink-soft); margin-top:2px;">
            ${issue.village ? '📍 ' + escapeHtml(issue.village) + ' · ' : ''}${new Date(issue.created_at).toLocaleString('km-KH')}
          </div>
        </div>
        <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
          <span class="tag tag-cat">${CATEGORY_LABEL_KM[issue.category] || issue.category}</span>
          <span class="tag tag-${issue.priority.toLowerCase()}">${issue.priority}</span>
          <span class="tag tag-status-${issue.status.toLowerCase().replace(' ', '')}">${STATUS_LABEL_KM[issue.status] || issue.status}</span>
        </div>
      </div>
    `).join('');
  }

  async function refreshAll() {
    await Promise.all([loadStats(), loadIssues()]);
  }

  document.getElementById('refresh-btn').addEventListener('click', refreshAll);
  ['filter-category', 'filter-priority', 'filter-status'].forEach(id => {
    document.getElementById(id).addEventListener('change', loadIssues);
  });

  refreshAll();
  setInterval(refreshAll, 15000); // live-ish refresh every 15s
})();
