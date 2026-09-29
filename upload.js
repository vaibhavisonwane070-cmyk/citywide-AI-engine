/**
 * CITYVISION AI — Upload & Pipeline Controller
 */

let selectedFile = null;

document.addEventListener('DOMContentLoaded', () => {
    initCameraSelectionFromUrl();
    initDropzone();
});

// Auto-select camera if query param present
function initCameraSelectionFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const camId = params.get('camera_id');
    if (camId) {
        const select = document.getElementById('cameraSelect');
        if (select) {
            select.value = camId;
        }
    }
}

// Drag & Drop Handling
function initDropzone() {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');

    if (!dropzone || !fileInput) return;

    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.add('dragover');
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('dragover');
        });
    });

    dropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            handleFileSelect(files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (fileInput.files.length > 0) {
            handleFileSelect(fileInput.files[0]);
        }
    });
}

function handleFileSelect(file) {
    selectedFile = file;

    document.getElementById('fileName').textContent = file.name;
    document.getElementById('fileSize').textContent = `${(file.size / 1024).toFixed(1)} KB`;
    document.getElementById('fileSourceBadge').textContent = 'Local Upload';
    document.getElementById('fileInfoBox').classList.remove('d-none');
    document.getElementById('btnStartPipeline').removeAttribute('disabled');

    logPipeline(`Selected file: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
}

function clearSelectedFile() {
    selectedFile = null;
    document.getElementById('fileInput').value = '';
    document.getElementById('fileInfoBox').classList.add('d-none');
    document.getElementById('btnStartPipeline').setAttribute('disabled', 'true');
    logPipeline('File selection cleared.');
}

function logPipeline(msg) {
    const logBox = document.getElementById('pipelineLog');
    if (!logBox) return;
    const timeStr = new Date().toTimeString().split(' ')[0];
    const line = document.createElement('div');
    line.textContent = `[${timeStr}] ${msg}`;
    logBox.appendChild(line);
    logBox.scrollTop = logBox.scrollHeight;
}

// Progress Stepper Updates
function setPipelineStep(stepNumber, percent, statusText) {
    document.getElementById('pipelineProgressBar').style.width = `${percent}%`;
    document.getElementById('pipelineStatusBadge').textContent = statusText;

    for (let i = 1; i <= 5; i++) {
        const stepEl = document.getElementById(`step${i}`);
        if (i < stepNumber) {
            stepEl.className = 'step-item completed';
        } else if (i === stepNumber) {
            stepEl.className = 'step-item active';
        } else {
            stepEl.className = 'step-item';
        }
    }
}

// Execute the end-to-end processing pipeline
async function runProcessingPipeline() {
    if (!selectedFile) {
        showToast('Please select an image or video first', 'warning');
        return;
    }

    const cameraId = document.getElementById('cameraSelect').value;
    const btn = document.getElementById('btnStartPipeline');
    btn.setAttribute('disabled', 'true');
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Processing Pipeline...`;

    document.getElementById('resultsCard').classList.add('d-none');

    try {
        // Step 1: Uploading Ingest
        setPipelineStep(1, 20, 'UPLOADING');
        logPipeline(`[STEP 1] Ingesting media capture into camera node ${cameraId}...`);

        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('camera_id', cameraId);

        const uploadRes = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        const uploadData = await uploadRes.json();
        if (uploadData.status !== 'success') {
            throw new Error(uploadData.message || 'Upload failed');
        }
        const mediaFileId = uploadData.media_file_id;
        logPipeline(`[STEP 1 DONE] Ingested file ID: #${mediaFileId}`);

        // Step 2: OpenCV Frame Extraction
        setPipelineStep(2, 40, 'OPENCV DECODE');
        logPipeline('[STEP 2] OpenCV decoding frame raster & normalizing color space...');

        // Step 3: Vehicle Detection
        setPipelineStep(3, 60, 'VEHICLE DETECTION');
        logPipeline('[STEP 3] Running vehicle detection and ByteTrack video association...');

        // Step 4: Plate Detection & OCR
        setPipelineStep(4, 80, 'ANPR OCR');
        logPipeline('[STEP 4] Localizing registration plate polygon & executing OCR extraction...');

        // Trigger /api/process
        const procPayload = {
            media_file_id: mediaFileId,
            camera_id: cameraId
        };

        const procRes = await fetch('/api/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(procPayload)
        });

        const procData = await procRes.json();
        if (procData.status !== 'success') {
            throw new Error(procData.message || 'AI Pipeline failed');
        }

        setPipelineStep(5, 100, procData.detected ? 'COMMITTED' : 'NO PLATE');
        if (procData.detected) {
            logPipeline(`[STEP 5 DONE] Stored detection event #${procData.detection_id} in SQLite database.`);
        } else {
            logPipeline(`[RESULT] ${procData.message}`);
        }

        // Display results
        renderPipelineResults(procData);
        showToast(procData.message, procData.detected ? 'success' : 'warning');

    } catch (err) {
        console.error('Pipeline error:', err);
        setPipelineStep(1, 0, 'FAILED');
        logPipeline(`[ERROR] ${err.message}`);
        showToast(`Pipeline failure: ${err.message}`, 'danger');
    } finally {
        btn.removeAttribute('disabled');
        btn.innerHTML = `<i class="bi bi-play-circle-fill"></i> Execute AI Pipeline Analysis`;
    }
}

function renderPipelineResults(data) {
    const resCard = document.getElementById('resultsCard');
    const p = data.pipeline_result;
    
    document.getElementById('resPlateLabel').textContent = data.detected ? 'Identified Registration Plate:' : 'No readable registration plate:';
    document.getElementById('resPlateNumber').textContent = p.plate_number || 'No readable plate';
    document.getElementById('resVehicleType').textContent = p.vehicle_type;
    document.getElementById('resOcrConf').textContent = data.detected ? `${Math.round(p.ocr_confidence * 100)}%` : 'N/A';
    document.getElementById('resDetConf').textContent = data.detected ? `${Math.round(p.detection_confidence * 100)}%` : 'N/A';
    document.getElementById('resLatency').textContent = `${p.processing_time_ms} ms`;
    document.getElementById('resFormatNote').textContent = `${p.format_note || 'Format unavailable'} · ${p.plate_localizer || 'OpenCV'}`;

    // Annotated Image Preview
    const imgEl = document.getElementById('resAnnotatedImg');
    imgEl.src = `/uploads/${p.image_path}`;

    // Alert Banner if Watchlist match
    const alertBanner = document.getElementById('resultAlertBanner');
    if (data.alert) {
        alertBanner.classList.remove('d-none');
        document.getElementById('resultAlertTitle').textContent = `SECURITY ALERT: ${data.alert.severity.toUpperCase()} WATCHLIST TARGET`;
        document.getElementById('resultAlertReason').textContent = data.alert.reason;
    } else {
        alertBanner.classList.add('d-none');
    }

    // Action buttons
    document.getElementById('resTrackBtn').href = `/trajectories?plate=${encodeURIComponent(p.plate_number)}`;
    document.getElementById('resSearchBtn').href = `/search?plate=${encodeURIComponent(p.plate_number)}`;
    document.getElementById('resTrackBtn').classList.toggle('d-none', !data.detected);
    document.getElementById('resSearchBtn').classList.toggle('d-none', !data.detected);

    resCard.classList.remove('d-none');
}
