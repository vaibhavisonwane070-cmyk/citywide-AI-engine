/**
 * CITYVISION AI — Camera Network Management Controller
 */

let camerasList = [];
let pickerMap = null;
let pickerMarker = null;
let detailMap = null;

document.addEventListener('DOMContentLoaded', () => {
    loadCameras();
    initCameraPickerModal();
});

// Load all cameras from REST API
async function loadCameras() {
    try {
        const res = await fetch('/api/cameras');
        const data = await res.json();
        if (data.status !== 'success') return;

        camerasList = data.cameras || [];
        updateCameraStats(camerasList);
        renderCamerasTable(camerasList);
    } catch (err) {
        console.error('Error fetching cameras:', err);
        showToast('Failed to load camera network', 'danger');
    }
}

// Update Top KPI counters
function updateCameraStats(cameras) {
    const total = cameras.length;
    const ready = cameras.filter(c => c.status === 'READY').length;
    const processing = cameras.filter(c => c.status === 'PROCESSING').length;
    const offline = cameras.filter(c => c.status === 'OFFLINE').length;

    document.getElementById('cam-stat-total').textContent = total;
    document.getElementById('cam-stat-ready').textContent = ready;
    document.getElementById('cam-stat-processing').textContent = processing;
    document.getElementById('cam-stat-offline').textContent = offline;
}

// Render Table
function renderCamerasTable(cameras) {
    const tbody = document.getElementById('camerasTableBody');
    if (!tbody) return;

    if (cameras.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-muted">No cameras match the current filter.</td></tr>`;
        return;
    }

    let html = '';
    cameras.forEach(cam => {
        let statusBadge = `<span class="badge-status badge-status-ready"><i class="bi bi-broadcast"></i> READY</span>`;
        if (cam.status === 'PROCESSING') {
            statusBadge = `<span class="badge-status badge-status-processing"><i class="bi bi-gear-wide-connected"></i> PROCESSING</span>`;
        } else if (cam.status === 'OFFLINE') {
            statusBadge = `<span class="badge-status badge-status-offline"><i class="bi bi-slash-circle"></i> OFFLINE</span>`;
        }

        html += `
            <tr>
                <td><span class="badge bg-dark border border-secondary border-opacity-50 text-cyan mono fw-bold">${cam.camera_id}</span></td>
                <td class="fw-semibold text-white">${cam.name}</td>
                <td><span class="text-secondary small"><i class="bi bi-geo-alt me-1"></i>${cam.location}</span></td>
                <td><span class="badge bg-dark text-secondary">${cam.direction}</span></td>
                <td class="mono small text-muted">${cam.latitude.toFixed(4)}, ${cam.longitude.toFixed(4)}</td>
                <td><span class="badge bg-dark text-info border border-info border-opacity-25 small">${cam.stream_mode || 'UPLOAD MODE'}</span></td>
                <td><span class="fw-bold text-white">${cam.detection_count || 0}</span> <small class="text-muted">events</small></td>
                <td>${statusBadge}</td>
                <td class="text-end">
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-cyber-dark" onclick="viewCameraDetail('${cam.camera_id}')" title="Inspect Node">
                            <i class="bi bi-eye"></i>
                        </button>
                        <button class="btn btn-cyber-dark" onclick="editCamera('${cam.camera_id}')" title="Configure Node">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-cyber-dark text-danger" onclick="deleteCamera('${cam.camera_id}')" title="Decommission Node">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

// Filter table
function filterCameraTable() {
    const term = (document.getElementById('cameraFilterInput').value || '').trim().toLowerCase();
    const status = document.getElementById('cameraStatusFilter').value;

    const filtered = camerasList.filter(c => {
        const matchesTerm = !term || 
            c.camera_id.toLowerCase().includes(term) ||
            c.name.toLowerCase().includes(term) ||
            c.location.toLowerCase().includes(term);

        const matchesStatus = (status === 'ALL') || (c.status === status);
        return matchesTerm && matchesStatus;
    });

    renderCamerasTable(filtered);
}

// Coordinate Picker Map in Add/Edit Modal
function initCameraPickerModal() {
    const modalEl = document.getElementById('cameraModal');
    if (!modalEl) return;

    modalEl.addEventListener('shown.bs.modal', () => {
        if (!pickerMap) {
            pickerMap = L.map('cameraPickerMap').setView([18.5204, 73.8567], 12);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(pickerMap);

            pickerMap.on('click', (e) => {
                const { lat, lng } = e.latlng;
                document.getElementById('inputCameraLat').value = lat.toFixed(6);
                document.getElementById('inputCameraLng').value = lng.toFixed(6);
                setPickerMarker(lat, lng);
            });
        } else {
            pickerMap.invalidateSize();
        }

        const latVal = parseFloat(document.getElementById('inputCameraLat').value) || 18.5204;
        const lngVal = parseFloat(document.getElementById('inputCameraLng').value) || 73.8567;
        setPickerMarker(latVal, lngVal);
        pickerMap.setView([latVal, lngVal], 13);
    });
}

function setPickerMarker(lat, lng) {
    if (!pickerMap) return;
    if (pickerMarker) {
        pickerMarker.setLatLng([lat, lng]);
    } else {
        pickerMarker = L.marker([lat, lng], { draggable: true }).addTo(pickerMap);
        pickerMarker.on('dragend', (e) => {
            const pos = e.target.getLatLng();
            document.getElementById('inputCameraLat').value = pos.lat.toFixed(6);
            document.getElementById('inputCameraLng').value = pos.lng.toFixed(6);
        });
    }
}

// Open Add Camera
function openAddCameraModal() {
    document.getElementById('cameraModalTitle').innerHTML = `<i class="bi bi-webcam me-2 text-cyan"></i> Register New Camera Node`;
    document.getElementById('cameraEditMode').value = 'add';
    document.getElementById('inputCameraId').value = `CAM-${camerasList.length + 1 < 10 ? '0' : ''}${camerasList.length + 1}`;
    document.getElementById('inputCameraId').removeAttribute('readonly');
    document.getElementById('inputCameraName').value = '';
    document.getElementById('inputCameraLocation').value = '';
    document.getElementById('inputCameraDirection').value = 'Northbound';
    document.getElementById('inputCameraStatus').value = 'READY';
    document.getElementById('inputCameraLat').value = '18.5204';
    document.getElementById('inputCameraLng').value = '73.8567';
}

// Open Edit Camera
function editCamera(cameraId) {
    const cam = camerasList.find(c => c.camera_id === cameraId);
    if (!cam) return;

    document.getElementById('cameraModalTitle').innerHTML = `<i class="bi bi-pencil-square me-2 text-warning"></i> Configure Camera ${cam.camera_id}`;
    document.getElementById('cameraEditMode').value = 'edit';
    document.getElementById('inputCameraId').value = cam.camera_id;
    document.getElementById('inputCameraId').setAttribute('readonly', 'true');
    document.getElementById('inputCameraName').value = cam.name;
    document.getElementById('inputCameraLocation').value = cam.location;
    document.getElementById('inputCameraDirection').value = cam.direction;
    document.getElementById('inputCameraStatus').value = cam.status;
    document.getElementById('inputCameraLat').value = cam.latitude;
    document.getElementById('inputCameraLng').value = cam.longitude;

    const modal = new bootstrap.Modal(document.getElementById('cameraModal'));
    modal.show();
}

// Submit Add/Edit Form
async function handleCameraFormSubmit(e) {
    e.preventDefault();
    const mode = document.getElementById('cameraEditMode').value;
    const cameraId = document.getElementById('inputCameraId').value.trim().toUpperCase();
    const payload = {
        camera_id: cameraId,
        name: document.getElementById('inputCameraName').value.trim(),
        location: document.getElementById('inputCameraLocation').value.trim(),
        direction: document.getElementById('inputCameraDirection').value,
        status: document.getElementById('inputCameraStatus').value,
        latitude: parseFloat(document.getElementById('inputCameraLat').value),
        longitude: parseFloat(document.getElementById('inputCameraLng').value)
    };

    try {
        let res;
        if (mode === 'add') {
            res = await fetch('/api/cameras', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } else {
            res = await fetch(`/api/cameras/${cameraId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }

        const data = await res.json();
        if (data.status === 'success') {
            showToast(data.message, 'success');
            bootstrap.Modal.getInstance(document.getElementById('cameraModal')).hide();
            loadCameras();
        } else {
            showToast(data.message || 'Operation failed', 'danger');
        }
    } catch (err) {
        showToast('Network error processing camera node', 'danger');
    }
}

// Delete Camera
async function deleteCamera(cameraId) {
    if (!confirm(`Are you sure you want to decommission and delete camera node ${cameraId}? Associated detection records will be affected.`)) {
        return;
    }

    try {
        const res = await fetch(`/api/cameras/${cameraId}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.status === 'success') {
            showToast(data.message, 'success');
            loadCameras();
        } else {
            showToast(data.message || 'Failed to delete camera', 'danger');
        }
    } catch (err) {
        showToast('Network error while deleting camera', 'danger');
    }
}

// View Camera Detail Modal
async function viewCameraDetail(cameraId) {
    const modalEl = document.getElementById('cameraDetailModal');
    const bodyEl = document.getElementById('cameraDetailBody');
    const uploadBtn = document.getElementById('detailUploadBtn');
    
    uploadBtn.href = `/upload?camera_id=${cameraId}`;
    bodyEl.innerHTML = `<div class="text-center py-4"><div class="spinner-border text-info"></div></div>`;
    
    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    try {
        const res = await fetch(`/api/cameras/${cameraId}`);
        const data = await res.json();
        if (data.status !== 'success') {
            bodyEl.innerHTML = `<div class="alert alert-danger">Error retrieving camera details.</div>`;
            return;
        }

        const cam = data.camera;
        const stats = data.stats || { detections: 0, plates: 0 };
        const files = data.files || [];

        bodyEl.innerHTML = `
            <div class="row g-3">
                <div class="col-md-6">
                    <div class="p-3 rounded bg-dark border border-secondary border-opacity-25">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <span class="badge bg-info text-dark fw-bold fs-6">${cam.camera_id}</span>
                            <span class="badge ${cam.status === 'READY' ? 'bg-success' : 'bg-warning'}">${cam.status}</span>
                        </div>
                        <h6 class="text-white fw-bold mb-1">${cam.name}</h6>
                        <p class="text-secondary small mb-3"><i class="bi bi-geo-alt me-1"></i>${cam.location}</p>
                        
                        <div class="small text-muted mb-1">Stream Ingest Mode: <strong class="text-info">${cam.stream_mode || 'UPLOAD MODE'}</strong></div>
                        <div class="small text-muted mb-1">Traffic Direction: <strong class="text-white">${cam.direction}</strong></div>
                        <div class="small text-muted mb-3">Coordinates: <span class="mono text-white">${cam.latitude}, ${cam.longitude}</span></div>
                        
                        <div class="row g-2 pt-2 border-top border-secondary border-opacity-25 text-center">
                            <div class="col-6">
                                <span class="d-block h5 text-cyan mb-0">${stats.detections}</span>
                                <small class="text-muted">Total Crossings</small>
                            </div>
                            <div class="col-6">
                                <span class="d-block h5 text-primary mb-0">${stats.plates}</span>
                                <small class="text-muted">Unique Plates</small>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div id="modalDetailMap" style="height: 220px; border-radius: 8px; border: 1px solid var(--border-color);"></div>
                </div>
            </div>

            <div class="mt-4">
                <h6 class="text-white fw-semibold mb-2"><i class="bi bi-file-earmark-play me-1 text-info"></i> Ingested Media Files (${files.length})</h6>
                ${files.length === 0 ? '<p class="text-muted small">No media files uploaded to this camera node yet.</p>' : `
                    <div class="table-responsive" style="max-height: 150px;">
                        <table class="table table-sm table-cyber small mb-0">
                            <thead>
                                <tr><th>Filename</th><th>Type</th><th>Size</th><th>Status</th></tr>
                            </thead>
                            <tbody>
                                ${files.map(f => `
                                    <tr>
                                        <td class="text-truncate" style="max-width: 150px;">${f.filename}</td>
                                        <td>${f.file_type}</td>
                                        <td>${Math.round(f.file_size / 1024)} KB</td>
                                        <td><span class="badge bg-dark text-success">${f.status}</span></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `}
            </div>
        `;

        // Render leafet marker for modal
        setTimeout(() => {
            const mapDiv = document.getElementById('modalDetailMap');
            if (mapDiv) {
                const m = L.map('modalDetailMap', { attributionControl: false }).setView([cam.latitude, cam.longitude], 14);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(m);
                L.marker([cam.latitude, cam.longitude]).addTo(m);
            }
        }, 300);

    } catch (err) {
        bodyEl.innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`;
    }
}
