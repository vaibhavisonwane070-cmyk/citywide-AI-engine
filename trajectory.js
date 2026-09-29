/**
 * CITYVISION AI — Multi-Camera Trajectory Reconstruction
 */

let trajectoryMap = null;
let trajectoryPathLayer = null;
let trajectoryMarkersLayer = null;
let currentTrajectoryData = null;

document.addEventListener('DOMContentLoaded', () => {
    initTrajectoryMap();
    loadTrajectoryForInput();
});

function initTrajectoryMap() {
    const mapEl = document.getElementById('trajectoryMap');
    if (!mapEl) return;

    trajectoryMap = L.map('trajectoryMap', {
        zoomControl: true,
        attributionControl: false
    }).setView([18.5280, 73.8450], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
    }).addTo(trajectoryMap);

    trajectoryPathLayer = L.layerGroup().addTo(trajectoryMap);
    trajectoryMarkersLayer = L.layerGroup().addTo(trajectoryMap);
}

function setTargetPlate(plate) {
    document.getElementById('trajectoryTargetInput').value = plate;
    loadTrajectoryForInput();
}

function loadTrajectoryForInput() {
    const input = document.getElementById('trajectoryTargetInput');
    if (!input) return;
    const plate = input.value.trim().toUpperCase().replace(/[\s-]/g, '');
    if (!plate) {
        showToast('Please specify a license plate', 'warning');
        return;
    }
    fetchAndRenderTrajectory(plate);
}

async function fetchAndRenderTrajectory(plate) {
    const timelineEl = document.getElementById('trajectoryTimelineList');
    timelineEl.innerHTML = `
        <div class="text-center py-4 text-muted">
            <div class="spinner-border spinner-border-sm text-info mb-2"></div>
            <div>Reconstructing trajectory for <strong>${plate}</strong>...</div>
        </div>
    `;

    try {
        const res = await fetch(`/api/vehicles/${plate}/trajectory`);
        const json = await res.json();

        if (json.status !== 'success' || !json.data.found) {
            timelineEl.innerHTML = `
                <div class="text-center py-4 text-muted">
                    <i class="bi bi-geo-alt-slash fs-2 d-block text-secondary mb-2"></i>
                    <h6>No Trajectory Available</h6>
                    <p class="small mb-0">No historical sightings found for plate <strong>${plate}</strong>. Try MH12DEMO01, MH14TEST02, or MH13DEMO03.</p>
                </div>
            `;
            clearTrajectoryMap();
            return;
        }

        currentTrajectoryData = json.data;
        renderTrajectoryMap(currentTrajectoryData);
        renderTrajectoryTimeline(currentTrajectoryData);
        renderTrajectoryMetrics(currentTrajectoryData.metrics);

    } catch (err) {
        console.error('Trajectory error:', err);
        timelineEl.innerHTML = `<div class="alert alert-danger">Error loading trajectory.</div>`;
    }
}

function clearTrajectoryMap() {
    if (trajectoryPathLayer) trajectoryPathLayer.clearLayers();
    if (trajectoryMarkersLayer) trajectoryMarkersLayer.clearLayers();
    document.getElementById('trajectoryRouteBadge').textContent = 'No Active Route';
    document.getElementById('metricTime').textContent = '--';
    document.getElementById('metricDistance').textContent = '--';
    document.getElementById('metricSpeed').textContent = '--';
}

function renderTrajectoryMap(data) {
    clearTrajectoryMap();
    const nodes = data.trajectory;
    if (!nodes || nodes.length === 0) return;

    const latLngs = [];
    const routeNames = [];

    nodes.forEach((node, idx) => {
        const latLng = [node.latitude, node.longitude];
        latLngs.push(latLng);
        routeNames.push(node.camera_id);

        // Sequence badge marker
        const isStart = idx === 0;
        const isEnd = idx === nodes.length - 1;
        
        let markerColor = '#00f2fe';
        if (isStart) markerColor = '#10b981'; // Green Start
        if (isEnd) markerColor = '#f59e0b';   // Amber End

        const customIcon = L.divIcon({
            className: 'custom-trajectory-pin',
            html: `
                <div style="
                    background: ${markerColor};
                    width: 28px;
                    height: 28px;
                    border-radius: 50%;
                    border: 3px solid #070d1e;
                    box-shadow: 0 0 16px ${markerColor};
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #070d1e;
                    font-weight: 800;
                    font-size: 11px;
                ">
                    ${idx + 1}
                </div>
            `,
            iconSize: [28, 28],
            iconAnchor: [14, 14]
        });

        const marker = L.marker(latLng, { icon: customIcon });

        const popupHtml = `
            <div style="font-family: 'Inter', sans-serif; min-width: 220px;">
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <span class="badge bg-secondary">HOP #${idx + 1}</span>
                    <strong style="color: #00f2fe;">${node.camera_id}</strong>
                </div>
                <h6 class="text-white mb-1" style="font-size: 0.88rem;">${node.camera_name || node.camera_id}</h6>
                <div class="text-muted small mb-2"><i class="bi bi-geo-alt"></i> ${node.camera_location || 'Urban Node'}</div>
                <div class="p-2 rounded bg-dark border border-secondary border-opacity-50 small mb-2">
                    <div>Time: <strong class="text-white mono">${node.timestamp}</strong></div>
                    <div>Heading: <strong class="text-info">${node.direction}</strong></div>
                    <div>Classification: <strong class="text-white">${node.vehicle_type}</strong></div>
                    ${!isStart ? `<div>Leg Transit: <strong class="text-warning">${node.hop_time_formatted} (${node.hop_distance_km} km)</strong></div>` : ''}
                </div>
            </div>
        `;

        marker.bindPopup(popupHtml);
        trajectoryMarkersLayer.addLayer(marker);
    });

    // Draw connecting polyline
    if (latLngs.length > 1) {
        // Glowing background line
        const glowLine = L.polyline(latLngs, {
            color: '#00f2fe',
            weight: 8,
            opacity: 0.25,
            smoothFactor: 1
        });
        trajectoryPathLayer.addLayer(glowLine);

        // Core path line
        const coreLine = L.polyline(latLngs, {
            color: '#00f2fe',
            weight: 3,
            opacity: 0.9,
            dashArray: '6, 6',
            smoothFactor: 1
        });
        trajectoryPathLayer.addLayer(coreLine);

        // Fit map bounds
        trajectoryMap.fitBounds(L.latLngBounds(latLngs), { padding: [40, 40] });
    } else {
        trajectoryMap.setView(latLngs[0], 14);
    }

    document.getElementById('trajectoryRouteBadge').textContent = routeNames.join(' ➔ ');
    document.getElementById('hopCountBadge').textContent = `${nodes.length} Detections`;
}

function renderTrajectoryTimeline(data) {
    const timelineEl = document.getElementById('trajectoryTimelineList');
    const nodes = data.trajectory;

    let html = '';
    nodes.forEach((node, idx) => {
        const isStart = idx === 0;
        const isEnd = idx === nodes.length - 1;

        html += `
            <div class="timeline-node">
                <div class="timeline-marker" style="border-color: ${isStart ? '#10b981' : (isEnd ? '#f59e0b' : '#00f2fe')}"></div>
                <div class="timeline-content">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <span class="badge bg-dark border border-secondary border-opacity-50 text-cyan mono">Node #${idx + 1}: ${node.camera_id}</span>
                        <span class="small mono text-white">${node.timestamp.split(' ')[1] || node.timestamp}</span>
                    </div>
                    <div class="fw-semibold text-white small mb-1">${node.camera_name || node.camera_id}</div>
                    <div class="text-muted small mb-2"><i class="bi bi-geo-alt me-1"></i>${node.camera_location || 'Corridor'}</div>
                    
                    ${!isStart ? `
                        <div class="p-2 rounded bg-dark border border-secondary border-opacity-25 small text-secondary">
                            <span class="d-block text-warning"><i class="bi bi-stopwatch me-1"></i> Elapsed: <strong>${node.hop_time_formatted}</strong></span>
                            <span class="d-block"><i class="bi bi-signpost me-1"></i> Leg Distance: <strong>${node.hop_distance_km} km</strong> (${node.estimated_speed_kmh} km/h)</span>
                        </div>
                    ` : `
                        <div class="p-2 rounded bg-dark border border-success border-opacity-25 small text-success">
                            <i class="bi bi-flag-fill me-1"></i> Initial Point of Observation
                        </div>
                    `}
                </div>
            </div>
        `;
    });

    timelineEl.innerHTML = html;
}

function renderTrajectoryMetrics(m) {
    if (!m) return;
    document.getElementById('metricTime').textContent = m.total_duration_formatted;
    document.getElementById('metricDistance').textContent = `${m.total_distance_km} km`;
    document.getElementById('metricSpeed').textContent = `${m.average_speed_kmh} km/h`;
}

function fitTrajectoryBounds() {
    if (currentTrajectoryData && currentTrajectoryData.trajectory.length > 1) {
        const latLngs = currentTrajectoryData.trajectory.map(n => [n.latitude, n.longitude]);
        trajectoryMap.fitBounds(L.latLngBounds(latLngs), { padding: [50, 50] });
    }
}
