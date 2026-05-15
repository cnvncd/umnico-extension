// popup.js

const UTC_OFFSET = 5;

// BASE_LINKS removed - now using links from backend API

// Статусы постбэков
const STATUSES = {
  lead:   { label: 'Регистрация', cls: 'status-lead' },
  sale:   { label: 'Депозит',     cls: 'status-sale' },
  resale: { label: 'Редепозит',   cls: 'status-resale' },
};

function formatDate(str) {
  if (!str) return '—';
  const d = new Date(str);
  if (isNaN(d)) return str;
  const s = new Date(d.getTime() + UTC_OFFSET * 3600000);
  const p = n => String(n).padStart(2, '0');
  return `${p(s.getUTCDate())}.${p(s.getUTCMonth() + 1)}.${s.getUTCFullYear()} `
       + `${p(s.getUTCHours())}:${p(s.getUTCMinutes())}`;
}

function isDeposit(status) {
  return status === 'sale' || status === 'resale';
}

document.addEventListener('DOMContentLoaded', () => {
  const tabButtons  = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');

  function switchTab(tabName) {
    tabButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabName));
    tabContents.forEach(c => c.classList.toggle('active', c.id === tabName));
  }
  tabButtons.forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const url   = tabs[0]?.url || '';
    const tabId = tabs[0]?.id;
    const match = url.match(/\/details\/([^/?#]+)/);

    if (!match) {
      ['main-links', 'postbacks'].forEach(id => {
        document.getElementById(id).innerHTML = '<p class="empty">Откройте страницу сделки</p>';
      });
      document.getElementById('postbacks-count').textContent = '0';
      return;
    }

    const leadId = match[1];

    const saIdPromise = chrome.scripting.executeScript({
      target: { tabId },
      func: async (id) => {
        try {
          const res = await fetch(`https://umnico.com/api/messaging/${id}/sources`, { credentials: 'include' });
          const data = await res.json();
          return Array.isArray(data) && data.length ? data[0].saId : null;
        } catch { return null; }
      },
      args: [leadId]
    }).then(r => r?.[0]?.result || null).catch(() => null);

    saIdPromise.then(saId => {
      const backendPromise = new Promise(resolve => {
        chrome.runtime.sendMessage({ type: 'fetchData', leadId, referer: url, saId }, resolve);
      });

      backendPromise.then(response => {
        if (!response?.success) {
          ['main-links', 'postbacks'].forEach(id => {
            document.getElementById(id).innerHTML = '<p class="empty">Ошибка загрузки</p>';
          });
          document.getElementById('postbacks-count').textContent = '!';
          return;
        }

        const data     = response.data;
        const postbacks = data.postback_data || [];
        const hasDeposit = postbacks.some(p => isDeposit(p.status));

        const badge = document.getElementById('postbacks-count');
        badge.textContent = postbacks.length;
        if (hasDeposit) badge.classList.add('has-deposit');

        renderMainLinks(data.referral_links_data, saId, leadId);
        renderPostbacks(postbacks);
      });
    });
  });

  function renderMainLinks(links, saId, leadId) {
    const el = document.getElementById('main-links');
    let html = '';

    if (links && links.length) {
      links.forEach(item => {
        const fullLink = `${item.link}?c=${leadId}`;
        html += `<button class="quick-link-btn copy-link" data-link="${fullLink}">
          ${fullLink}
          ${item.description ? `<div class="link-label">${item.description}</div>` : ''}
        </button>`;
      });
    } else {
      html = '<p class="empty">Нет ссылок для этой интеграции</p>';
    }

    el.innerHTML = html;
    attachCopyListeners(el);
  }

  function renderPostbacks(data) {
    const el = document.getElementById('postbacks');
    if (!data || !data.length) {
      el.innerHTML = '<p class="empty">Нет постбэков</p>';
      return;
    }

    const items = data.map(item => {
      const status   = (item.status || '').toLowerCase();
      const st       = STATUSES[status] || { label: item.status || '—', cls: '' };
      const depositCls = isDeposit(status) ? 'deposit' : '';

      return `<li class="postback-item ${depositCls}">
        <div class="postback-row">
          <span class="postback-status ${st.cls}">${st.label}</span>
          ${item.created_at ? `<span class="postback-date">${formatDate(item.created_at)}</span>` : ''}
        </div>
        ${item.info ? `<div class="postback-info">${item.info}</div>` : ''}
      </li>`;
    }).join('');

    el.innerHTML = `<ul class="postbacks-list">${items}</ul>`;
  }

  function attachCopyListeners(container) {
    container.querySelectorAll('.copy-link').forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault();
        navigator.clipboard.writeText(el.dataset.link).then(() => {
          const orig = el.innerHTML;
          el.innerHTML = '✓ Скопировано';
          el.classList.add('copied');
          setTimeout(() => { 
            el.innerHTML = orig; 
            el.classList.remove('copied'); 
          }, 2000);
        });
      });
    });
  }

  function showToast(text) {
    const t = document.createElement('div');
    t.className = 'copy-notification';
    t.textContent = text;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2000);
  }
});
