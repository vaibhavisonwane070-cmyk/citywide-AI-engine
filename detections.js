/**
 * CITYVISION AI — ANPR Detection History Controller
 */

let currentPage = 1;
let totalPages = 1;
let searchTimeout = null;
let currentDetections = [];

document.addEventListener('DOMContentLoaded', () => {
    loadDetections(1);
});

function debounceDetectionSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        loadDetections(1);
    }, 300);
}

function resetDetectionFilters() {
    document.getElementById('histSearchPlate').value = '';
    document.getElementById('histCameraFilter').value = 'ALL';
    document.getElementById('histVehicleType').value = 'ALL';
    document.getElementById('histDirection').value = 'ALL';
    loadDetections(1);
}

async function loadDetections(page = 1) {
    currentPage = page;
    const plate = (document.getElementById('histSearchPlate').value || '').trim();
    const camera = document.getElementById('histCameraFilter').value;
    const vType = document.getElementById('histVehicleType').value;
    const dir = document.getElementById('histDirection').value;
    const tbody = document.getElementById('detectionsTableBody');

    const params = new URLSearchParams({
        page: currentPage,
        per_page: 20
    });
    if (plate) params.append('search', plate);
    if (camera && camera !== 'ALL') params.append('camera_id', camera);
    if (vType && vType !== 'ALL') params.append('vehicle_type', vType);
    if (dir && dir !== 'ALL') params.append('direction', dir);

    try {
        const res = await fetch(`/api/detections?${params.toString()}`);
        const data = await res.json();
        if (data.status !== 'success') return;

        currentDetections = data.detections || [];
        totalPages = data.total_pages;

        document.getElementById('totalRecordsBadge').textContent = `${data.total} Detections`;
        document.getElementById('paginationInfo').textContent = `Showing page ${currentPage} of ${totalPages} (${data.total} records)`;
        
        document.getElementById('btnPrevPage').disabled = (currentPage <= 1);
        document.getElementById('btnNextPage').disabled = (currentPage >= totalPages);

        renderDetectionsTable(currentDetections);

    } catch (err) {
        console.error('Error fetching detections:', err);
        tbody.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-danger">Failed to load detections.</td></tr>`;
    }
}

function changePage(delta) {
    const target = currentPage + delta;
    if (target >= 1 && target <= totalPages) {
        loadDetections(target);
    }
}

function renderDetectionsTable(detections) {
    const tbody = document.getElementById('detectionsTableBody');
    if (!tbody) return;

    if (detections.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-muted">No detections matching the query criteria.</td></tr>`;
        return;
    }

    let html = '';
    detections.forEach(d => {
        const datePart = d.timestamp ? d.timestamp.split(' ')[0] : 'N/A';
        const timePart = d.timestamp ? d.timestamp.split(' ')[1] : 'N/A';
        const ocrConf = Math.round((d.ocr_confidence || 0.95) * 100);

        html += `
            <tr style="cursor: pointer;" onclick="openDetectionDetail(${d.id})">
                <td><span class="plate-badge plate-badge-sm">${d.plate_number}</span></td>
                <td><span class="badge bg-dark border border-secondary border-opacity-50 text-cyan mono">${d.camera_id}</span></td>
                <td><span class="small text-secondary"><i class="bi bi-geo-alt me-1"></i>${d.camera_location || 'Urban Corridor'}</span></td>
                <td class="mono small text-muted">${datePart}</td>
                <td class="mono small text-white">${timePart}</td>
                <td><span class="badge bg-dark text-light">${d.vehicle_type}</span></td>
                <td><span class="small text-muted">${d.direction}</span></td>
                <td><span class="text-success small fw-bold">${ocrConf}%</span></td>
                <td class="text-end" onclick="event.stopPropagation();">
                    <button class="btn btn-sm btn-cyber-dark py-0 px-2" onclick="openDetectionDetail(${d.id})" title="Inspect Frame">
                        <i class="bi bi-eye"></i>
                    </button>
                    <a href="/trajectories?plate=${encodeURIComponent(d.plate_number)}" class="btn btn-sm btn-cyber-outline py-0 px-2" title="Trajectory">
                        <i class="bi bi-geo-alt-fill"></i>
                    </a>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

function openDetectionDetail(detectionId) {
    const d = currentDetections.find(item => item.id === detectionId);
    if (!d) return;

    const modalEl = document.getElementById('detectionDetailModal');
    const bodyEl = document.getElementById('detectionDetailBody');
    const trackBtn = document.getElementById('modalTrackBtn');

    trackBtn.href = `/trajectories?plate=${encodeURIComponent(d.plate_number)}`;

    const imgSrc = d.image_path ? (d.image_path.startsWith('samples/') ? `/uploads/${d.image_path}` : `/uploads/${d.image_path}`) : '/uploads/samples/sample_mh12demo01.jpg';

    bodyEl.innerHTML = `
        <div class="row g-3">
            <div class="col-md-6">
                <div class="text-center p-2 rounded bg-black border border-secondary border-opacity-50">
                    <img src="${imgSrc}" alt="Optical Crop" class="img-fluid rounded" style="max-height: 250px; object-fit: contain;">
                </div>
                <div class="text-center mt-2 small text-muted">
                    <i class="bi bi-camera"></i> Optical ANPR Capture Frame
                </div>
            </div>
            <div class="col-md-6">
                <div class="p-3 rounded bg-dark border border-secondary border-opacity-25 h-100">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <span class="plate-badge">${d.plate_number}</span>
                        <span class="badge bg-info text-dark fw-bold">${d.vehicle_type}</span>
                    </div>

                    <div class="small text-muted mb-1">Camera Sensor: <strong class="text-cyan mono">${d.camera_id}</strong> (${d.camera_name || 'Grid Node'})</div>
                    <div class="small text-muted mb-1">Junction: <strong class="text-white">${d.camera_location || 'Urban Intersection'}</strong></div>
                    <div class="small text-muted mb-1">Timestamp: <span class="mono text-white">${d.timestamp}</span></div>
                    <div class="small text-muted mb-3">Heading Direction: <strong class="text-info">${d.direction}</strong></div>

                    <div class="p-2 rounded bg-black border border-secondary border-opacity-25 small mb-3">
                        <div class="d-flex justify-content-between">
                            <span class="text-muted">OCR Recognition Conf:</span>
                            <strong class="text-success">${Math.round((d.ocr_confidence || 0.95) * 100)}%</strong>
                        </div>
                        <div class="d-flex justify-content-between">
                            <span class="text-muted">Vehicle Detection Conf:</span>
                            <strong class="text-cyan">${Math.round((d.detection_confidence || 0.94) * 100)}%</strong>
                        </div>
                        <div class="d-flex justify-content-between">
                            <span class="text-muted">Coordinates:</span>
                            <span class="mono text-white">${d.latitude.toFixed(4)}, ${d.longitude.toFixed(4)}</span>
                        </div>
                    </div>

                    <div class="d-grid">
                        <a href="/search?plate=${encodeURIComponent(d.plate_number)}" class="btn btn-sm btn-cyber-outline">
                            <i class="bi bi-search"></i> View Vehicle Historical Profile
                        </a>
                    </div>
                </div>
            </div>
        </div>
    `;

    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}
