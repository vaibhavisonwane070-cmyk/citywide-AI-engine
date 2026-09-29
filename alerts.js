/**
 * CITYVISION AI — Watchlist & Alerts Controller
 */

let allAlerts = [];

document.addEventListener('DOMContentLoaded', () => {
    loadAlerts();
    loadWatchlist();
});

async function loadAlerts() {
    const status = document.getElementById('alertStatusFilter').value;
    const tbody = document.getElementById('alertsTableBody');

    try {
        const res = await fetch(`/api/alerts?status=${status}`);
        const data = await res.json();
        if (data.status !== 'success') return;

        allAlerts = data.alerts || [];
        updateSeverityCounters();
        renderAlertsTable(allAlerts);

        // Update global topbar count
        initGlobalAlertsPolling();

    } catch (err) {
        console.error('Error fetching alerts:', err);
        tbody.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-danger">Failed to fetch alerts.</td></tr>`;
    }
}

function updateSeverityCounters() {
    // Count across all alerts or active
    const crit = allAlerts.filter(a => a.severity === 'Critical' && a.status === 'Active').length;
    const high = allAlerts.filter(a => a.severity === 'High' && a.status === 'Active').length;
    const medLow = allAlerts.filter(a => (a.severity === 'Medium' || a.severity === 'Low') && a.status === 'Active').length;
    const ack = allAlerts.filter(a => a.status === 'Acknowledged').length;

    document.getElementById('countCritical').textContent = crit;
    document.getElementById('countHigh').textContent = high;
    document.getElementById('countMedLow').textContent = medLow;
    document.getElementById('countAck').textContent = ack;
}

function renderAlertsTable(alerts) {
    const tbody = document.getElementById('alertsTableBody');
    if (!tbody) return;

    if (alerts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-muted">No alerts found for selected filter.</td></tr>`;
        return;
    }

    let html = '';
    alerts.forEach(a => {
        let sevBadge = `<span class="badge-status badge-severity-high">${a.severity}</span>`;
        if (a.severity === 'Critical') sevBadge = `<span class="badge-status badge-severity-critical"><i class="bi bi-exclamation-octagon-fill"></i> CRITICAL</span>`;
        if (a.severity === 'Medium') sevBadge = `<span class="badge-status badge-severity-medium">MEDIUM</span>`;
        if (a.severity === 'Low') sevBadge = `<span class="badge-status badge-severity-low">LOW</span>`;

        const isAck = a.status === 'Acknowledged';
        const hasPlate = a.plate_number && a.plate_number !== 'N/A' && !a.plate_number.includes('?');

        html += `
            <tr class="${!isAck && a.severity === 'Critical' ? 'table-danger bg-opacity-10' : ''}">
                <td>${sevBadge}</td>
                <td class="fw-semibold text-white">
                    <span class="d-block">${a.alert_type}</span>
                    <small class="text-muted">${a.reason}</small>
                </td>
                <td>
                    ${hasPlate ? `<span class="plate-badge plate-badge-sm">${a.plate_number}</span>` : `<span class="text-muted mono">${a.plate_number}</span>`}
                </td>
                <td><span class="badge bg-dark border border-secondary border-opacity-50 text-cyan mono">${a.camera_id}</span></td>
                <td><span class="small text-secondary"><i class="bi bi-geo-alt me-1"></i>${a.location}</span></td>
                <td class="mono small text-muted">${a.timestamp}</td>
                <td><span class="text-success">${Math.round((a.confidence || 0.95) * 100)}%</span></td>
                <td>
                    ${isAck 
                        ? `<span class="badge bg-dark text-success border border-success border-opacity-25"><i class="bi bi-check2"></i> Acknowledged</span>` 
                        : `<span class="badge bg-danger"><i class="bi bi-dot"></i> ACTIVE</span>`}
                </td>
                <td class="text-end">
                    <div class="btn-group btn-group-sm">
                        ${hasPlate ? `
                            <a href="/search?plate=${encodeURIComponent(a.plate_number)}" class="btn btn-cyber-dark" title="View Target Profile">
                                <i class="bi bi-search"></i>
                            </a>
                            <a href="/trajectories?plate=${encodeURIComponent(a.plate_number)}" class="btn btn-cyber-dark" title="View GIS Route">
                                <i class="bi bi-geo-alt-fill"></i>
                            </a>
                        ` : ''}
                        ${!isAck ? `
                            <button class="btn btn-cyber-dark text-success" onclick="acknowledgeAlert(${a.id})" title="Acknowledge Alert">
                                <i class="bi bi-check-lg"></i> Ack
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

async function acknowledgeAlert(alertId) {
    try {
        const res = await fetch(`/api/alerts/${alertId}/acknowledge`, { method: 'POST' });
        const data = await res.json();
        if (data.status === 'success') {
            showToast(`Alert #${alertId} acknowledged`, 'success');
            loadAlerts();
        } else {
            showToast('Failed to acknowledge alert', 'danger');
        }
    } catch (err) {
        showToast('Network error', 'danger');
    }
}

// Watchlist Handling
async function loadWatchlist() {
    const tbody = document.getElementById('watchlistTableBody');
    if (!tbody) return;

    try {
        const res = await fetch('/api/watchlist');
        const data = await res.json();
        if (data.status !== 'success') return;

        const list = data.watchlist || [];
        if (list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center py-3 text-muted">No monitored plates on active watchlist.</td></tr>`;
            return;
        }

        let html = '';
        list.forEach(w => {
            html += `
                <tr>
                    <td><span class="plate-badge plate-badge-sm">${w.plate_number}</span></td>
                    <td class="text-white">${w.reason}</td>
                    <td><span class="badge ${w.severity === 'Critical' ? 'bg-danger' : (w.severity === 'High' ? 'bg-warning text-dark' : 'bg-secondary')}">${w.severity}</span></td>
                    <td class="mono small text-muted">${w.added_at ? w.added_at.split(' ')[0] : 'N/A'}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="removeWatchlistPlate('${w.plate_number}')" title="Remove Plate">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;

    } catch (err) {
        console.error('Watchlist error:', err);
    }
}

async function handleAddWatchlist(e) {
    e.preventDefault();
    const plate = document.getElementById('wlPlate').value.trim();
    const reason = document.getElementById('wlReason').value.trim();
    const severity = document.getElementById('wlSeverity').value;

    try {
        const res = await fetch('/api/watchlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plate_number: plate, reason: reason, severity: severity })
        });
        const data = await res.json();

        if (data.status === 'success') {
            showToast(data.message, 'success');
            document.getElementById('wlPlate').value = '';
            document.getElementById('wlReason').value = '';
            loadWatchlist();
        } else {
            showToast(data.message, 'danger');
        }
    } catch (err) {
        showToast('Error adding to watchlist', 'danger');
    }
}

async function removeWatchlistPlate(plate) {
    if (!confirm(`Remove plate ${plate} from active watchlist monitoring?`)) return;

    try {
        const res = await fetch(`/api/watchlist/${plate}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.status === 'success') {
            showToast(data.message, 'info');
            loadWatchlist();
        } else {
            showToast(data.message, 'danger');
        }
    } catch (err) {
        showToast('Error removing plate', 'danger');
    }
}
