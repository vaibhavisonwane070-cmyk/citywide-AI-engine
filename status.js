/**
 * CITYVISION AI — System Status & Diagnostics Controller
 */

document.addEventListener('DOMContentLoaded', () => {
    loadSystemStatus();
});

async function loadSystemStatus() {
    const grid = document.getElementById('systemComponentsGrid');
    const pingBadge = document.getElementById('statusLastPing');

    try {
        const t0 = performance.now();
        const res = await fetch('/api/system/status');
        const t1 = performance.now();
        const latency = (t1 - t0).toFixed(1);

        if (pingBadge) {
            pingBadge.textContent = `Ping Latency: ${latency} ms`;
        }

        const data = await res.json();
        if (data.status !== 'success') return;

        const components = data.components || [];
        let html = '';

        components.forEach(comp => {
            const isOp = comp.status === 'Operational';
            const badgeClass = isOp ? 'bg-success' : 'bg-warning text-dark';
            const icon = isOp ? 'bi-check-circle-fill text-success' : 'bi-exclamation-triangle-fill text-warning';

            html += `
                <div class="col-xl-4 col-md-6">
                    <div class="cyber-card h-100">
                        <div class="cyber-card-body p-3">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <h6 class="text-white fw-bold mb-0">
                                    <i class="bi ${icon} me-1"></i> ${comp.name}
                                </h6>
                                <span class="badge ${badgeClass} small">${comp.status}</span>
                            </div>
                            <p class="small text-secondary mb-3">${comp.details}</p>
                            <div class="d-flex justify-content-between align-items-center p-2 rounded bg-dark border border-secondary border-opacity-25 small">
                                <span class="text-muted">Observed Latency:</span>
                                <span class="mono text-cyan fw-bold">${comp.latency}</span>
                            </div>
                            <div class="mt-2 text-end">
                                <span class="badge bg-dark text-muted border border-secondary border-opacity-25" style="font-size: 0.65rem;">
                                    SIMULATED BENCHMARK
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        grid.innerHTML = html;

    } catch (err) {
        console.error('Status check error:', err);
        grid.innerHTML = `<div class="col-12"><div class="alert alert-danger">Error retrieving diagnostics.</div></div>`;
    }
}
