// API Base URL
const API_BASE = window.location.origin;

// Check authentication
const sessionId = localStorage.getItem('sessionId');
if (!sessionId) {
  window.location.href = '/admin/login';
}

// State
let currentIntegrationId = null;
let currentIntegrationName = '';
let editingIntegrationId = null;
let editingLinkId = null;

// DOM Elements
const integrationsView = document.getElementById('integrations-view');
const linksView = document.getElementById('links-view');
const integrationsTbody = document.getElementById('integrations-tbody');
const linksTbody = document.getElementById('links-tbody');
const breadcrumb = document.getElementById('breadcrumb');
const linksViewTitle = document.getElementById('links-view-title');

const integrationModal = document.getElementById('integration-modal');
const linkModal = document.getElementById('link-modal');
const toast = document.getElementById('toast');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadIntegrations();
  setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
  // Logout
  document.getElementById('logout-btn').addEventListener('click', async () => {
    const sessionId = localStorage.getItem('sessionId');
    if (sessionId) {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: {
          'X-Session-Id': sessionId
        }
      });
    }
    localStorage.removeItem('sessionId');
    window.location.href = '/admin/login';
  });

  // Add Integration
  document.getElementById('add-integration-btn').addEventListener('click', () => {
    editingIntegrationId = null;
    document.getElementById('integration-modal-title').textContent = 'Добавить интеграцию';
    document.getElementById('integration-form').reset();
    showModal(integrationModal);
  });

  // Integration Form
  document.getElementById('integration-form').addEventListener('submit', handleIntegrationSubmit);
  document.getElementById('cancel-integration').addEventListener('click', () => hideModal(integrationModal));
  document.getElementById('close-integration-modal').addEventListener('click', () => hideModal(integrationModal));

  // Add Link
  document.getElementById('add-link-btn').addEventListener('click', () => {
    editingLinkId = null;
    document.getElementById('link-modal-title').textContent = 'Добавить ссылку';
    document.getElementById('link-form').reset();
    showModal(linkModal);
  });

  // Link Form
  document.getElementById('link-form').addEventListener('submit', handleLinkSubmit);
  document.getElementById('cancel-link').addEventListener('click', () => hideModal(linkModal));
  document.getElementById('close-link-modal').addEventListener('click', () => hideModal(linkModal));

  // Back to Integrations
  document.getElementById('back-to-integrations').addEventListener('click', () => {
    showView('integrations');
    loadIntegrations();
  });

  // Close modal on outside click
  integrationModal.addEventListener('click', (e) => {
    if (e.target === integrationModal) hideModal(integrationModal);
  });
  linkModal.addEventListener('click', (e) => {
    if (e.target === linkModal) hideModal(linkModal);
  });
}

// API Calls
async function apiCall(endpoint, options = {}) {
  try {
    const sessionId = localStorage.getItem('sessionId');
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': sessionId,
        ...options.headers
      },
      ...options
    });

    if (response.status === 401) {
      // Unauthorized - redirect to login
      localStorage.removeItem('sessionId');
      window.location.href = '/admin/login';
      return;
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

// Load Integrations
async function loadIntegrations() {
  try {
    integrationsTbody.innerHTML = '<tr><td colspan="5" class="loading">Загрузка...</td></tr>';
    const integrations = await apiCall('/api/admin/integrations');

    if (integrations.length === 0) {
      integrationsTbody.innerHTML = '<tr><td colspan="5" class="empty">Нет интеграций</td></tr>';
      return;
    }

    integrationsTbody.innerHTML = integrations.map(integration => `
      <tr>
        <td>
          <span class="integration-name" onclick="viewLinks(${integration.id}, '${escapeJs(integration.name)}')">
            ${escapeHtml(integration.name)}
          </span>
        </td>
        <td><span class="sa-id">${escapeHtml(integration.sa_id)}</span></td>
        <td class="links-count">${integration.links_count}</td>
        <td class="date">${formatDate(integration.created_at)}</td>
        <td>
          <button class="btn btn-danger" onclick="deleteIntegration(${integration.id}, '${escapeJs(integration.name)}')">
            Удалить
          </button>
        </td>
      </tr>
    `).join('');
  } catch (error) {
    showToast('Ошибка загрузки интеграций', 'error');
    integrationsTbody.innerHTML = '<tr><td colspan="5" class="empty">Ошибка загрузки</td></tr>';
  }
}

// View Links
async function viewLinks(integrationId, integrationName) {
  currentIntegrationId = integrationId;
  currentIntegrationName = integrationName;
  
  showView('links');
  linksViewTitle.textContent = `Ссылки: ${integrationName}`;
  breadcrumb.innerHTML = `<a href="#" onclick="showView('integrations'); loadIntegrations(); return false;">Интеграции</a> → ${integrationName}`;

  try {
    linksTbody.innerHTML = '<tr><td colspan="4" class="loading">Загрузка...</td></tr>';
    const links = await apiCall(`/api/admin/integrations/${integrationId}/links`);

    if (links.length === 0) {
      linksTbody.innerHTML = '<tr><td colspan="4" class="empty">Нет ссылок</td></tr>';
      return;
    }

    linksTbody.innerHTML = links.map(link => `
      <tr>
        <td>${escapeHtml(link.label)}</td>
        <td class="url-cell" title="${escapeHtml(link.url)}">${escapeHtml(link.url)}</td>
        <td>${link.sort_order}</td>
        <td>
          <button class="btn btn-edit" onclick="editLink(${link.id}, '${escapeJs(link.label)}', '${escapeJs(link.url)}', ${link.sort_order})">
            Изменить
          </button>
          <button class="btn btn-danger" onclick="deleteLink(${link.id}, '${escapeJs(link.label)}')">
            Удалить
          </button>
        </td>
      </tr>
    `).join('');
  } catch (error) {
    showToast('Ошибка загрузки ссылок', 'error');
    linksTbody.innerHTML = '<tr><td colspan="4" class="empty">Ошибка загрузки</td></tr>';
  }
}

// Handle Integration Submit
async function handleIntegrationSubmit(e) {
  e.preventDefault();
  
  const name = document.getElementById('integration-name').value.trim();
  const sa_id = document.getElementById('integration-sa-id').value.trim();

  try {
    if (editingIntegrationId) {
      // Update not implemented in this version
      showToast('Редактирование интеграций не реализовано', 'error');
    } else {
      await apiCall('/api/admin/integrations', {
        method: 'POST',
        body: JSON.stringify({ name, sa_id })
      });
      showToast('Интеграция создана', 'success');
      hideModal(integrationModal);
      loadIntegrations();
    }
  } catch (error) {
    showToast(error.message || 'Ошибка сохранения', 'error');
  }
}

// Handle Link Submit
async function handleLinkSubmit(e) {
  e.preventDefault();
  
  const label = document.getElementById('link-label').value.trim();
  const url = document.getElementById('link-url').value.trim();
  const sort_order = parseInt(document.getElementById('link-sort-order').value);

  try {
    if (editingLinkId) {
      await apiCall(`/api/admin/links/${editingLinkId}`, {
        method: 'PUT',
        body: JSON.stringify({ label, url, sort_order })
      });
      showToast('Ссылка обновлена', 'success');
    } else {
      await apiCall(`/api/admin/integrations/${currentIntegrationId}/links`, {
        method: 'POST',
        body: JSON.stringify({ label, url, sort_order })
      });
      showToast('Ссылка создана', 'success');
    }
    
    hideModal(linkModal);
    viewLinks(currentIntegrationId, currentIntegrationName);
  } catch (error) {
    showToast(error.message || 'Ошибка сохранения', 'error');
  }
}

// Edit Link
function editLink(id, label, url, sortOrder) {
  editingLinkId = id;
  document.getElementById('link-modal-title').textContent = 'Изменить ссылку';
  document.getElementById('link-label').value = label;
  document.getElementById('link-url').value = url;
  document.getElementById('link-sort-order').value = sortOrder;
  showModal(linkModal);
}

// Delete Integration
async function deleteIntegration(id, name) {
  if (!confirm(`Удалить интеграцию "${name}"?\n\nВсе связанные ссылки также будут удалены.`)) {
    return;
  }

  try {
    await apiCall(`/api/admin/integrations/${id}`, { method: 'DELETE' });
    showToast('Интеграция удалена', 'success');
    loadIntegrations();
  } catch (error) {
    showToast(error.message || 'Ошибка удаления', 'error');
  }
}

// Delete Link
async function deleteLink(id, label) {
  if (!confirm(`Удалить ссылку "${label}"?`)) {
    return;
  }

  try {
    await apiCall(`/api/admin/links/${id}`, { method: 'DELETE' });
    showToast('Ссылка удалена', 'success');
    viewLinks(currentIntegrationId, currentIntegrationName);
  } catch (error) {
    showToast(error.message || 'Ошибка удаления', 'error');
  }
}

// UI Helpers
function showView(viewName) {
  document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
  
  if (viewName === 'integrations') {
    integrationsView.classList.add('active');
    breadcrumb.innerHTML = '';
  } else if (viewName === 'links') {
    linksView.classList.add('active');
  }
}

function showModal(modal) {
  modal.classList.add('active');
}

function hideModal(modal) {
  modal.classList.remove('active');
}

function showToast(message, type = 'success') {
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeJs(text) {
  return text.replace(/\\/g, '\\\\')
             .replace(/'/g, "\\'")
             .replace(/"/g, '\\"')
             .replace(/\n/g, '\\n')
             .replace(/\r/g, '\\r');
}

// Make functions global for onclick handlers
window.viewLinks = viewLinks;
window.editLink = editLink;
window.deleteIntegration = deleteIntegration;
window.deleteLink = deleteLink;
window.showView = showView;
window.loadIntegrations = loadIntegrations;
