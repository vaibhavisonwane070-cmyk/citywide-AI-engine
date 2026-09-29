/**
 * CITYVISION AI — Intelligence Reports & Export Controller
 */

let currentReportType = 'traffic';
let currentReportData = { headers: [], rows: [] };

document.addEventListener('DOMContentLoaded', () => {
    switchReport('traffic');
});

function switchReport(type) {
    currentReportType = type;
    document.querySelectorAll('#reportTabs .nav-link').forEach(el => el.classList.remove('active'));
    event && event.target && event.target.classList.add('active');

    const ts = new Date().toLocaleString();
    document.getElementById('reportTimestamp').textContent = `Audited: ${ts}`;

    if (type === 'traffic') {
        loadTrafficReport();
    } else if (type === 'anpr') {
        loadANPRReport();
    } else if (type === 'cameras') {
        loadCamerasReport();
    } else if (type === 'movement') {
        loadMovementReport();
    } else if (type === 'alerts') {
        loadAlertsReport();
    }
}

async function loadTrafficReport() {
    document.getElementById('reportTitle').textContent = 'Daily Traffic Summary Report';
    document.getElementById('reportSubtitle').textContent = '24-hour vehicle density and congestion distribution across metropolitan corridors';

    try {
        const res = await fetch('/api/analytics');
        const json = await res.json();
        const charts = json.data.charts;

        const headers = ['Hour of Day', 'Vehicular Density Volume', 'Peak Status'];
        const rows = charts.hourly.labels.map((lbl, idx) => {
            const count = charts.hourly.data[idx];
            const status = count > 12 ? 'HIGH CONGESTION' : (count > 6 ? 'MODERATE' : 'NORMAL');
            return [lbl, count, status];
        });

        currentReportData = { headers, rows, filename: 'daily_traffic_summary.csv' };
        renderReportTable(headers, rows);
    } catch (err) {
        console.error('Report error:', err);
    }
}

async function loadANPRReport() {
    document.getElementById('reportTitle').textContent = 'ANPR Optical Detection Audit Report';
    document.getElementById('reportSubtitle').textContent = 'Verified license plate characters, confidence ratings, and timestamp logging';

    try {
        const res = await fetch('/api/detections?per_page=50');
        const json = await res.json();
        const detections = json.detections || [];

        const headers = ['Plate Number', 'Camera ID', 'Location', 'Timestamp', 'Vehicle Type', 'OCR Confidence'];
        const rows = detections.map(d => [
            d.plate_number,
            d.camera_id,
            d.camera_location || 'Urban Corridor',
            d.timestamp,
            d.vehicle_type,
            `${Math.round((d.ocr_confidence || 0.95) * 100)}%`
        ]);

        currentReportData = { headers, rows, filename: 'anpr_detections_audit.csv' };
        renderReportTable(headers, rows);
    } catch (err) {
        console.error('Report error:', err);
    }
}

async function loadCamerasReport() {
    document.getElementById('reportTitle').textContent = 'Camera Network Performance Report';
    document.getElementById('reportSubtitle').textContent = 'Optical sensor node operational availability, stream mode, and event throughput';

    try {
        const res = await fetch('/api/cameras');
        const json = await res.json();
        const cameras = json.cameras || [];

        const headers = ['Camera ID', 'Name / Junction', 'GPS Coordinates', 'Direction', 'Status', 'Ingest Mode', 'Detections'];
        const rows = cameras.map(c => [
            c.camera_id,
            c.name,
            `${c.latitude}, ${c.longitude}`,
            c.direction,
            c.status,
            c.stream_mode || 'UPLOAD MODE',
            c.detection_count || 0
        ]);

        currentReportData = { headers, rows, filename: 'camera_network_performance.csv' };
        renderReportTable(headers, rows);
    } catch (err) {
        console.error('Report error:', err);
    }
}

async function loadMovementReport() {
    document.getElementById('reportTitle').textContent = 'Target Vehicle Movement & Corridors';
    document.getElementById('reportSubtitle').textContent = 'Multi-camera transit sightings, unique corridors crossed, and first/last observation points';

    try {
        const res = await fetch('/api/vehicles/search');
        const json = await res.json();
        const vehicles = json.vehicles || [];

        const headers = ['Registration Plate', 'Vehicle Type', 'First Sighted', 'Last Sighted', 'Total Sightings', 'Visited Nodes', 'Watchlist'];
        const rows = vehicles.map(v => [
            v.plate_number,
            v.vehicle_type,
            v.first_seen,
            v.last_seen,
            v.total_detections,
            v.cameras_visited_count || 1,
            v.is_watchlist ? 'YES (FLAGGED)' : 'NO'
        ]);

        currentReportData = { headers, rows, filename: 'vehicle_movements_report.csv' };
        renderReportTable(headers, rows);
    } catch (err) {
        console.error('Report error:', err);
    }
}

async function loadAlertsReport() {
    document.getElementById('reportTitle').textContent = 'Security Alerts & Violations Log';
    document.getElementById('reportSubtitle').textContent = 'Automated threat notifications, watchlist matches, and operational interventions';

    try {
        const res = await fetch('/api/alerts');
        const json = await res.json();
        const alerts = json.alerts || [];

        const headers = ['Severity', 'Alert Type', 'Target Plate', 'Camera ID', 'Location', 'Timestamp', 'Status'];
        const rows = alerts.map(a => [
            a.severity,
            a.alert_type,
            a.plate_number,
            a.camera_id,
            a.location,
            a.timestamp,
            a.status
        ]);

        currentReportData = { headers, rows, filename: 'security_alerts_log.csv' };
        renderReportTable(headers, rows);
    } catch (err) {
        console.error('Report error:', err);
    }
}

function renderReportTable(headers, rows) {
    const thead = document.getElementById('reportTableHead');
    const tbody = document.getElementById('reportTableBody');

    let headHtml = '<tr>';
    headers.forEach(h => {
        headHtml += `<th>${h}</th>`;
    });
    headHtml += '</tr>';
    thead.innerHTML = headHtml;

    if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${headers.length}" class="text-center py-4 text-muted">No records available for this report.</td></tr>`;
        return;
    }

    let bodyHtml = '';
    rows.forEach(r => {
        bodyHtml += '<tr>';
        r.forEach((cell, idx) => {
            if (idx === 0 && (typeof cell === 'string') && cell.startsWith('MH')) {
                bodyHtml += `<td><span class="plate-badge plate-badge-sm">${cell}</span></td>`;
            } else {
                bodyHtml += `<td>${cell}</td>`;
            }
        });
        bodyHtml += '</tr>';
    });
    tbody.innerHTML = bodyHtml;
}

// Client-side CSV generation
function exportCurrentReportCSV() {
    if (!currentReportData.rows || currentReportData.rows.length === 0) {
        showToast('No data to export', 'warning');
        return;
    }

    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += currentReportData.headers.map(h => `"${h}"`).join(',') + '\r\n';

    currentReportData.rows.forEach(row => {
        csvContent += row.map(val => `"${val}"`).join(',') + '\r\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', currentReportData.filename || 'cityvision_report.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast(`Downloaded ${currentReportData.filename}`, 'success');
}
