/**
 * CITYVISION AI — Vehicle Search Controller
 */

document.addEventListener('DOMContentLoaded', () => {
    executeSearch();
});

function quickFillSearch(plate) {
    document.getElementById('searchPlate').value = plate;
    executeSearch();
}

function handleSearchSubmit(e) {
    e.preventDefault();
    executeSearch();
}

async function executeSearch() {
    const plate = (document.getElementById('searchPlate').value || '').trim();
    const camera = document.getElementById('searchCamera').value;
    const vType = document.getElementById('searchVehicleType').value;

    const container = document.getElementById('searchResultsContainer');
    const badge = document.getElementById('resultsCountBadge');

    container.innerHTML = `
        <div class="col-12 text-center py-5 text-muted">
            <div class="spinner-border spinner-border-sm text-info mb-2"></div>
            <div>Querying centralized ANPR index...</div>
        </div>
    `;

    try {
        const queryParams = new URLSearchParams();
        if (plate) queryParams.append('plate', plate);
        if (camera && camera !== 'ALL') queryParams.append('camera_id', camera);
        if (vType && vType !== 'ALL') queryParams.append('vehicle_type', vType);

        const res = await fetch(`/api/vehicles/search?${queryParams.toString()}`);
        const data = await res.json();

        if (data.status !== 'success') {
            container.innerHTML = `<div class="col-12"><div class="alert alert-danger">Search failed: ${data.message}</div></div>`;
            return;
        }

        const vehicles = data.vehicles || [];
        badge.textContent = vehicles.length;

        if (vehicles.length === 0) {
            container.innerHTML = `
                <div class="col-12 text-center py-5 text-muted">
                    <i class="bi bi-shield-x fs-2 d-block mb-2 text-secondary"></i>
                    <h5>No Vehicle Matches Found</h5>
                    <p class="small">No detection records match query "${plate}". Try searching one of the demo targets above.</p>
                </div>
            `;
            return;
        }

        let html = '';
        vehicles.forEach(v => {
            const visitedCams = v.cameras_list ? v.cameras_list.split(',') : [];
            const isWatchlist = v.is_watchlist === 1;

            html += `
                <div class="col-xl-4 col-md-6">
                    <div class="cyber-card h-100 ${isWatchlist ? 'border-danger' : ''}">
                        <div class="cyber-card-header">
                            <span class="plate-badge">${v.plate_number}</span>
                            <div>
                                ${isWatchlist ? '<span class="badge bg-danger"><i class="bi bi-shield-fill-exclamation me-1"></i> WATCHLIST</span>' : '<span class="badge bg-secondary">CIVILIAN</span>'}
                            </div>
                        </div>
                        <div class="cyber-card-body">
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <div>
                                    <span class="text-muted small d-block">Classification</span>
                                    <strong class="text-white fs-6"><i class="bi bi-car-front me-1 text-cyan"></i> ${v.vehicle_type}</strong>
                                </div>
                                <div class="text-end">
                                    <span class="text-muted small d-block">Total Sightings</span>
                                    <span class="badge bg-dark border border-secondary border-opacity-50 text-cyan fs-6 mono">${v.total_detections} Crossings</span>
                                </div>
                            </div>

                            <div class="p-2 mb-3 rounded bg-dark border border-secondary border-opacity-25 small">
                                <div class="d-flex justify-content-between mb-1">
                                    <span class="text-muted">First Detected:</span>
                                    <span class="text-white mono">${v.first_seen}</span>
                                </div>
                                <div class="d-flex justify-content-between">
                                    <span class="text-muted">Last Sighted:</span>
                                    <span class="text-white mono">${v.last_seen}</span>
                                </div>
                            </div>

                            <div class="mb-3">
                                <span class="text-muted small d-block mb-1">Visited Corridors (${v.cameras_visited_count || visitedCams.length} Nodes):</span>
                                <div class="d-flex flex-wrap gap-1">
                                    ${visitedCams.map(c => `<span class="badge bg-dark text-secondary border border-secondary border-opacity-25 mono small">${c.trim()}</span>`).join('')}
                                </div>
                            </div>

                            <div class="d-grid gap-2 pt-2 border-top border-secondary border-opacity-25">
                                <a href="/trajectories?plate=${encodeURIComponent(v.plate_number)}" class="btn btn-cyber text-center">
                                    <i class="bi bi-geo-alt-fill"></i> Reconstruct Multi-Camera Trajectory
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;

    } catch (err) {
        console.error('Search error:', err);
        container.innerHTML = `<div class="col-12"><div class="alert alert-danger">Error executing search.</div></div>`;
    }
}
