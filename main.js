/**
 * CITYVISION AI — Global Application JavaScript
 */

document.addEventListener('DOMContentLoaded', () => {
    initSidebarToggle();
    initGlobalAlertsPolling();
});

// Sidebar Mobile Toggle
function initSidebarToggle() {
    const toggleBtn = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('show');
        });

        // Close when clicking outside on mobile
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 992 && !sidebar.contains(e.target) && !toggleBtn.contains(e.target)) {
                sidebar.classList.remove('show');
            }
        });
    }
}

// Global Plate Search Handler
function handleGlobalSearch(event) {
    event.preventDefault();
    const input = document.getElementById('globalSearchInput');
    if (!input) return;
    const query = input.value.trim().toUpperCase().replace(/[\s-]/g, '');
    if (query) {
        window.location.href = `/search?plate=${encodeURIComponent(query)}`;
    }
}

// Toast Notifications System
function showToast(message, type = 'info', title = 'System Notification') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'cyber-toast';
    
    let iconClass = 'bi-info-circle text-info';
    let borderColor = 'var(--accent-cyan)';
    
    if (type === 'success') {
        iconClass = 'bi-check-circle-fill text-success';
        borderColor = 'var(--color-success)';
    } else if (type === 'warning') {
        iconClass = 'bi-exclamation-triangle-fill text-warning';
        borderColor = 'var(--color-warning)';
    } else if (type === 'danger') {
        iconClass = 'bi-shield-fill-x text-danger';
        borderColor = 'var(--color-danger)';
    }

    toast.style.borderColor = borderColor;
    toast.innerHTML = `
        <i class="bi ${iconClass} fs-4"></i>
        <div class="flex-grow-1">
            <strong class="d-block text-white small">${title}</strong>
            <span class="small text-secondary">${message}</span>
        </div>
        <button type="button" class="btn-close btn-close-white small ms-2" onclick="this.parentElement.remove()"></button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4500);
}

// Fetch active alerts count to update navbar & sidebar badges
async function initGlobalAlertsPolling() {
    try {
        const res = await fetch('/api/alerts?status=Active');
        if (res.ok) {
            const data = await res.json();
            const count = data.alerts ? data.alerts.length : 0;
            
            const sidebarBadge = document.getElementById('sidebar-alert-badge');
            const topbarBadge = document.getElementById('topbar-alert-counter');
            
            if (sidebarBadge) sidebarBadge.textContent = count;
            if (topbarBadge) topbarBadge.textContent = count;
        }
    } catch (err) {
        console.warn('Alerts poll notice:', err);
    }
}

// Format utilities
function formatDateTime(dateStr) {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
}

function formatPlate(plate) {
    if (!plate) return '';
    return plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
}
