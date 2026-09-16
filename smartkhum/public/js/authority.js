// SmartKhum — authority panel logic (Stage 4: Authority / NGO)

(function () {
  const CATEGORY_LABEL_KM = {
    water: 'ទឹក', road: 'ផ្លូវ', health: 'សុខភាព', environment: 'បរិស្ថាន', other: 'ផ្សេងៗ'
  };
  const STATUS_LABEL_KM = {
    Pending: 'កំពុងរង់ចាំ', InProgress: 'កំពុងដោះស្រាយ', Resolved: 'ដោះស្រាយរួច'
  };

  const tbody = document.getElementById('issue-tbody');
  const emptySlot = document.getElementById('empty-slot');
  const toast = document.getElementById('toast');

  function showToast(message, isError) {
    toast.textContent = message;
    toast.classList.toggle('error', !!isError);
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function currentFilters() {
    return {
      priority: document.getElementById('filter-priority').value,
      status: document.getElementById('filter-status').value
    };
  }

  async function loadIssues() {
    const filters = currentFilters();
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });

    const res = await fetch('/api/issues?' + params.toString());
    const issues = await res.json();
    renderTable(issues);
  }

  function renderTable(issues) {
    if (!issues.length) {
      tbody.innerHTML = '';
      emptySlot.innerHTML = `<div class="empty-state"><span class="icon">📋</span>មិនមានករណីត្រូវនឹងតម្រង​នេះទេ</div>`;
      return;
    }
    emptySlot.innerHTML = '';

    tbody.innerHTML = issues.map(issue => `
      <tr data-id="${issue.id}">
        <td class="id-cell">#${String(issue.id).padStart(4, '0')}</td>
        <td style="max-width:280px;">${escapeHtml(issue.description).slice(0, 140)}${issue.village ? `<br><span style="font-size:.78rem;color:var(--ink-soft);">📍 ${escapeHtml(issue.village)}</span>` : ''}</td>
        <td><span class="tag tag-cat">${CATEGORY_LABEL_KM[issue.category] || issue.category}</span></td>
        <td><span class="tag tag-${issue.priority.toLowerCase()}">${issue.priority}</span></td>
        <td>
          <select class="status-select mono" data-id="${issue.id}" style="font-size:.82rem; padding:6px 8px; border-radius:6px; border:1px solid var(--paper-line);">
            <option value="Pending" ${issue.status === 'Pending' ? 'selected' : ''}>កំពុងរង់ចាំ</option>
            <option value="InProgress" ${issue.status === 'InProgress' ? 'selected' : ''}>កំពុងដោះស្រាយ</option>
            <option value="Resolved" ${issue.status === 'Resolved' ? 'selected' : ''}>ដោះស្រាយរួច</option>
          </select>
        </td>
        <td class="mono" style="font-size:.78rem;">${new Date(issue.created_at).toLocaleDateString('km-KH')}</td>
        <td><button class="btn btn-outline feedback-btn" data-id="${issue.id}" style="font-size:.78rem; padding:8px 12px;">💬 Feedback</button></td>
      </tr>
    `).join('');

    document.querySelectorAll('.status-select').forEach(sel => {
      sel.addEventListener('change', async function () {
        const id = this.dataset.id;
        try {
          const res = await fetch(`/api/issues/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: this.value })
          });
          if (!res.ok) throw new Error('update failed');
          showToast(`✅ ករណី #${String(id).padStart(4, '0')} ត្រូវបានធ្វើបច្ចុប្បន្នភាព`);
        } catch (err) {
          showToast('❌ មិនអាចធ្វើបច្ចុប្បន្នភាពបានទេ', true);
        }
      });
    });

    document.querySelectorAll('.feedback-btn').forEach(btn => {
      btn.addEventListener('click', () => openFeedbackModal(btn.dataset.id));
    });
  }

  // ---------- Feedback modal ----------
  const modal = document.getElementById('feedback-modal');
  const feedbackText = document.getElementById('feedback-text');
  let activeIssueId = null;

  function openFeedbackModal(id) {
    activeIssueId = id;
    feedbackText.value = '';
    modal.style.display = 'flex';
  }

  document.getElementById('feedback-cancel').addEventListener('click', () => {
    modal.style.display = 'none';
  });

  document.getElementById('feedback-send').addEventListener('click', async () => {
    const message = feedbackText.value.trim();
    if (!message) return showToast('សូមសរសេរសារជាមុនសិន', true);

    try {
      const res = await fetch(`/api/issues/${activeIssueId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      if (!res.ok) throw new Error('failed');
      showToast('💬 Feedback ត្រូវបានផ្ញើទៅអ្នកភូមិ');
      modal.style.display = 'none';
    } catch (err) {
      showToast('❌ មិនអាចផ្ញើ Feedback បានទេ', true);
    }
  });

  document.getElementById('refresh-btn').addEventListener('click', loadIssues);
  ['filter-priority', 'filter-status'].forEach(id => {
    document.getElementById(id).addEventListener('change', loadIssues);
  });

  loadIssues();
  setInterval(loadIssues, 15000);
})();
