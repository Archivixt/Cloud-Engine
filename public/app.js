let currentFileId = null;

document.addEventListener('DOMContentLoaded', () => {
  checkBotStatus();
  loadFiles();
  loadDownloadHistory();
  setupDropZone();
});

function switchTab(tabName) {
  document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  
  document.querySelector(`.nav-tab[onclick="switchTab('${tabName}')"]`).classList.add('active');
  document.getElementById(`${tabName}-tab`).classList.add('active');
  
  if (tabName === 'files') loadFiles();
  if (tabName === 'history') loadDownloadHistory();
}

async function checkBotStatus() {
  try {
    const response = await fetch('/api/status');
    const data = await response.json();
    
    const indicator = document.getElementById('statusIndicator');
    const text = document.getElementById('statusText');
    
    if (data.ready) {
      indicator.classList.add('ready');
      text.textContent = 'Discord connected';
    } else {
      text.textContent = 'Bot not ready';
    }
  } catch (error) {
    document.getElementById('statusText').textContent = 'Server offline';
  }
}

function setupDropZone() {
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'));
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'));
  });

  dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) uploadFile(files[0]);
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) uploadFile(e.target.files[0]);
  });
}

async function uploadFile(file) {
  const dropZone = document.getElementById('dropZone');
  const uploadProgress = document.getElementById('uploadProgress');
  const uploadResult = document.getElementById('uploadResult');

  dropZone.parentElement.hidden = true;
  uploadProgress.hidden = false;
  uploadResult.hidden = true;

  document.getElementById('progressFileName').textContent = file.name;
  document.getElementById('progressPercent').textContent = '0%';
  document.getElementById('progressFill').style.width = '0%';
  document.getElementById('progressDetail').textContent = 'Starting upload...';

  const formData = new FormData();
  formData.append('file', file);

  try {
    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        document.getElementById('progressPercent').textContent = `${percent}%`;
        document.getElementById('progressFill').style.width = `${percent}%`;
        document.getElementById('progressDetail').textContent = `Uploading to Discord...`;
      }
    });

    xhr.onload = async () => {
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText);
        showUploadResult(data);
      } else {
        const data = JSON.parse(xhr.responseText);
        showError(data.error || 'Upload failed');
      }
    };

    xhr.onerror = () => showError('Network error');
    xhr.open('POST', '/api/upload');
    xhr.send(formData);
  } catch (error) {
    showError('Upload failed: ' + error.message);
  }
}

function showUploadResult(data) {
  const uploadProgress = document.getElementById('uploadProgress');
  const uploadResult = document.getElementById('uploadResult');

  uploadProgress.hidden = true;
  uploadResult.hidden = false;

  document.getElementById('resultFileId').textContent = data.fileId;
  document.getElementById('resultFileName').textContent = data.fileName;
  document.getElementById('resultFileSize').textContent = formatBytes(data.totalSize);
  document.getElementById('resultChunkCount').textContent = data.chunkCount;

  currentFileId = data.fileId;
  loadFiles();
  showToast('Upload complete!', 'success');
}

function showError(message) {
  const dropZone = document.getElementById('dropZone');
  const uploadProgress = document.getElementById('uploadProgress');
  
  dropZone.parentElement.hidden = false;
  uploadProgress.hidden = true;
  
  showToast('Error: ' + message, 'error');
  setTimeout(resetUpload, 2000);
}

function copyFileId() {
  if (currentFileId) {
    navigator.clipboard.writeText(currentFileId);
    showToast('File ID copied!', 'success');
  }
}

function goToDownload() {
  window.location.href = `/download/${currentFileId}`;
}

function resetUpload() {
  const dropZone = document.getElementById('dropZone');
  const uploadProgress = document.getElementById('uploadProgress');
  const uploadResult = document.getElementById('uploadResult');
  const fileInput = document.getElementById('fileInput');

  dropZone.parentElement.hidden = false;
  uploadProgress.hidden = true;
  uploadResult.hidden = true;
  fileInput.value = '';
  currentFileId = null;
}

async function loadFiles() {
  const filesList = document.getElementById('filesList');
  
  try {
    const response = await fetch('/api/files');
    const data = await response.json();

    if (!data.files || data.files.length === 0) {
      filesList.innerHTML = '<p class="empty-state">No files uploaded yet. Drop a file above to get started!</p>';
      return;
    }

    filesList.innerHTML = data.files.map(file => `
      <div class="file-item">
        <div class="file-details">
          <div class="file-name">${escapeHtml(file.originalName)}</div>
          <div class="file-meta">
            <span>${formatBytes(file.totalSize)}</span>
            <span><span class="badge badge-chunk">${file.chunkCount} chunks</span></span>
            <span>${formatDate(file.createdAt)}</span>
          </div>
          <div class="file-id">ID: ${file.id}</div>
        </div>
        <div class="file-actions">
          <button class="btn btn-secondary" onclick="copyId('${file.id}')" title="Copy ID">Copy ID</button>
          <button class="btn download-btn" onclick="downloadFile('${file.id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Download
          </button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    filesList.innerHTML = '<p class="empty-state">Failed to load files</p>';
  }
}

function copyId(id) {
  navigator.clipboard.writeText(id);
  showToast('File ID copied!', 'success');
}

async function downloadFile(fileId) {
  try {
    showToast('Preparing download...', 'success');
    
    const prepareResponse = await fetch(`/api/files/${fileId}/download`);
    const prepareData = await prepareResponse.json();

    if (prepareData.success) {
      loadDownloadHistory();
      setTimeout(() => {
        window.location.href = `/api/files/${fileId}/download/zip`;
      }, 500);
    } else {
      showToast(prepareData.error || 'Download failed', 'error');
    }
  } catch (error) {
    showToast('Download failed', 'error');
  }
}

async function loadDownloadHistory() {
  const historyList = document.getElementById('downloadHistory');
  
  try {
    const response = await fetch('/api/downloads');
    const data = await response.json();

    if (!data.downloads || data.downloads.length === 0) {
      historyList.innerHTML = '<p class="empty-state">No downloads yet. Go to "My Files" to download!</p>';
      return;
    }

    historyList.innerHTML = data.downloads.map(item => `
      <div class="download-history-item">
        <div>
          <div class="file-name">${escapeHtml(item.fileName)}</div>
          <div class="file-id">ID: ${item.fileId}</div>
        </div>
        <div style="text-align: right;">
          <div class="download-time">${formatDate(item.downloadedAt)}</div>
          <button class="btn btn-primary" onclick="downloadFile('${item.fileId}')" style="margin-top: 0.3rem; padding: 0.3rem 0.8rem; font-size: 0.8rem;">
            Download
          </button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    historyList.innerHTML = '<p class="empty-state">Failed to load download history</p>';
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + ' min ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' hours ago';
  
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast show ' + type;
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

setInterval(checkBotStatus, 30000);
