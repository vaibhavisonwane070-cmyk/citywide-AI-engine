/**
 * CITYVISION AI — Dashboard Map & Telemetry Controller
 */

let dashboardMap = null;
let cameraMarkersLayer = null;
let chartHourly = null;
let chartTypes = null;
let chartCameras = null;

document.addEventListener('DOMContentLoaded', () => {
    initDashboardMap();
    loadDashboardData();
    loadDashboardCharts();
});

// Initialize Leaflet GIS Map
function initDashboardMap() {
    const mapElement = document.getElementById('dashboardMap');
    if (!mapElement) return;

    // Default Pune Coordinates
    dashboardMap = L.map('dashboardMap', {
        zoomControl: true,
        attributionControl: false
    }).setView([18.5280, 73.8450], 12);

    // OpenStreetMap tiles with dark technology styling applied via CSS
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
    }).addTo(dashboardMap);

    cameraMarkersLayer = L.layerGroup().addTo(dashboardMap);
}

function centerMapOnGrid() {
    if (dashboardMap) {
        dashboardMap.setView([18.5280, 73.8450], 12);
    }
}

// Fetch dashboard KPIs, recent detections, and camera positions
async function loadDashboardData() {
    try {
        const res = await fetch('/api/dashboard/stats');
        const data = await res.json();
        if (data.status !== 'success') return;

        // 1. Update KPIs
        document.getElementById('kpi-cameras').textContent = data.kpis.active_cameras;
        document.getElementById('kpi-videos').textContent = data.kpis.videos_processed;
        document.getElementById('kpi-vehicles').textContent = data.kpis.vehicles_detected;
        document.getElementById('kpi-plates').textContent = data.kpis.unique_plates;
        document.getElementById('kpi-alerts').textContent = data.kpis.active_alerts;
        document.getElementById('kpi-ocr').textContent = data.kpis.avg_ocr_confidence;

        // 2. Render Camera Markers on GIS Map
        renderCameraMarkers(data.cameras);

        // 3. Render Recent ANPR Detections List
        renderRecentDetections(data.recent_detections);

    } catch (err) {
        console.error('Error loading dashboard stats:', err);
    }
}

function renderCameraMarkers(cameras) {
    if (!cameraMarkersLayer || !cameras) return;
    cameraMarkersLayer.clearLayers();

    cameras.forEach(cam => {
        let markerColor = '#10b981'; // Green Ready
        let statusBadge = '<span class="badge bg-success">READY</span>';
        if (cam.status === 'PROCESSING') {
            markerColor = '#00f2fe';
            statusBadge = '<span class="badge bg-info">PROCESSING</span>';
        } else if (cam.status === 'OFFLINE') {
            markerColor = '#ef4444';
            statusBadge = '<span class="badge bg-danger">OFFLINE</span>';
        }

        // Custom Leaflet DivIcon
        const customIcon = L.divIcon({
            className: 'custom-cam-pin',
            html: `
                <div style="
                    background: ${markerColor};
                    width: 22px;
                    height: 22px;
                    border-radius: 50%;
                    border: 3px solid #070d1e;
                    box-shadow: 0 0 12px ${markerColor};
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #174a9c;
                    font-size: 10px;
                    font-weight: 800;
                ">
                    <i class="bi bi-camera-fill" style="font-size: 10px;"></i>
                </div>
            `,
            iconSize: [22, 22],
            iconAnchor: [11, 11]
        });

        const marker = L.marker([cam.latitude, cam.longitude], { icon: customIcon });

        const popupHtml = `
            <div style="font-family: 'Inter', sans-serif; min-width: 210px;">
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <strong style="color: #2563eb; font-size: 0.95rem;">${cam.camera_id}</strong>
                    ${statusBadge}
                </div>
                <div class="fw-bold mb-1" style="font-size: 0.85rem; color: #18324b;">${cam.name}</div>
                <div class="text-muted small mb-2"><i class="bi bi-geo-alt"></i> ${cam.location}</div>
                <div class="small text-secondary mb-2">
                    <span class="d-block">Direction: <strong style="color: #18324b;">${cam.direction}</strong></span>
                    <span class="d-block">Stream: <strong style="color: #2563eb;">${cam.stream_mode || 'UPLOAD MODE'}</strong></span>
                </div>
                <div class="d-flex gap-2 mt-2">
                    <a href="/upload?camera_id=${cam.camera_id}" class="btn btn-sm btn-info text-dark w-100 py-1" style="font-size: 0.75rem; font-weight: 600;">
                        <i class="bi bi-cloud-arrow-up"></i> Upload Media
                    </a>
                </div>
            </div>
        `;

        marker.bindPopup(popupHtml);
        cameraMarkersLayer.addLayer(marker);
    });
}

function renderRecentDetections(detections) {
    const container = document.getElementById('recentDetectionsList');
    if (!container) return;

    if (!detections || detections.length === 0) {
        container.innerHTML = '<div class="p-4 text-center text-muted small">No recent detections recorded.</div>';
        return;
    }

    let html = '<div class="list-group list-group-flush">';
    detections.forEach(det => {
        const timeStr = det.timestamp ? det.timestamp.split(' ')[1] : '';
        const confPct = Math.round((det.ocr_confidence || 0.95) * 100);
        
        html += `
            <div class="list-group-item bg-transparent text-white border-secondary border-opacity-25 p-3">
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <span class="plate-badge plate-badge-sm">${det.plate_number}</span>
                    <span class="badge bg-dark border border-secondary border-opacity-50 text-cyan small mono">
                        ${det.camera_id}
                    </span>
                </div>
                <div class="d-flex justify-content-between align-items-center small text-muted mt-2">
                    <span><i class="bi bi-car-front me-1"></i> ${det.vehicle_type} &bull; ${det.direction}</span>
                    <span class="text-success"><i class="bi bi-shield-check"></i> ${confPct}% Conf</span>
                </div>
                <div class="d-flex justify-content-between align-items-center small text-muted mt-1">
                    <span class="text-truncate" style="max-width: 180px;"><i class="bi bi-geo-alt"></i> ${det.camera_location || det.camera_name || 'Grid Node'}</span>
                    <span class="mono">${timeStr}</span>
                </div>
                <div class="mt-2 pt-1 text-end">
                    <a href="/trajectories?plate=${encodeURIComponent(det.plate_number)}" class="btn btn-sm btn-cyber-outline py-0 px-2" style="font-size: 0.72rem;">
                        <i class="bi bi-geo-alt-fill"></i> Track Route
                    </a>
                </div>
            </div>
        `;
    });
    html += '</div>';

    container.innerHTML = html;
}

// Fetch and render bottom Chart.js widgets
async function loadDashboardCharts() {
    try {
        const res = await fetch('/api/analytics');
        const json = await res.json();
        if (json.status !== 'success') return;
        const chartsData = json.data.charts;

        // Chart 1: Hourly Traffic Volume (Bar/Line combo)
        const ctxHourly = document.getElementById('chartHourlyTraffic');
        if (ctxHourly) {
            if (chartHourly) chartHourly.destroy();
            chartHourly = new Chart(ctxHourly, {
                type: 'bar',
                data: {
                    labels: chartsData.hourly.labels,
                    datasets: [{
                        label: 'Vehicles / Hour',
                        data: chartsData.hourly.data,
                        backgroundColor: 'rgba(37, 99, 235, 0.35)',
                        borderColor: '#2563eb',
                        borderWidth: 1,
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { grid: { color: 'rgba(31,61,91,0.08)' }, ticks: { color: '#52677d', font: { size: 10 } } },
                        y: { grid: { color: 'rgba(31,61,91,0.08)' }, ticks: { color: '#52677d', font: { size: 10 } } }
                    }
                }
            });
        }

        // Chart 2: Vehicle Types (Doughnut)
        const ctxTypes = document.getElementById('chartVehicleTypes');
        if (ctxTypes) {
            if (chartTypes) chartTypes.destroy();
            chartTypes = new Chart(ctxTypes, {
                type: 'doughnut',
                data: {
                    labels: chartsData.vehicle_types.labels,
                    datasets: [{
                        data: chartsData.vehicle_types.data,
                        backgroundColor: [
                            '#2563eb', '#60a5fa', '#1d4ed8', '#93c5fd', '#38bdf8', '#f59e0b', '#10b981', '#718096'
                        ],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'right', labels: { color: '#52677d', boxWidth: 12, font: { size: 10 } } }
                    }
                }
            });
        }

        // Chart 3: Camera Activity (Horizontal Bar)
        const ctxCameras = document.getElementById('chartCameraActivity');
        if (ctxCameras) {
            if (chartCameras) chartCameras.destroy();
            chartCameras = new Chart(ctxCameras, {
                type: 'bar',
                indexAxis: 'y',
                data: {
                    labels: chartsData.camera_activity.labels,
                    datasets: [{
                        label: 'Detections',
                        data: chartsData.camera_activity.data,
                        backgroundColor: 'rgba(59, 130, 246, 0.35)',
                        borderColor: '#3b82f6',
                        borderWidth: 1,
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { grid: { color: 'rgba(31,61,91,0.08)' }, ticks: { color: '#52677d', font: { size: 10 } } },
                        y: { grid: { color: 'rgba(31,61,91,0.08)' }, ticks: { color: '#52677d', font: { size: 10 } } }
                    }
                }
            });
        }

    } catch (err) {
        console.error('Error loading dashboard charts:', err);
    }
}
