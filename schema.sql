-- CityVision AI Database Schema
-- SQLite 3

CREATE TABLE IF NOT EXISTS cameras (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    camera_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    direction TEXT NOT NULL DEFAULT 'Northbound',
    status TEXT NOT NULL DEFAULT 'READY', -- READY, PROCESSING, OFFLINE
    stream_mode TEXT NOT NULL DEFAULT 'UPLOAD MODE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS media_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    camera_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'UPLOADED', -- UPLOADED, PROCESSED, FAILED
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    FOREIGN KEY (camera_id) REFERENCES cameras(camera_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS vehicles (
    plate_number TEXT PRIMARY KEY,
    vehicle_type TEXT NOT NULL DEFAULT 'Car',
    first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_detections INTEGER DEFAULT 1,
    is_watchlist INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS detections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plate_number TEXT NOT NULL,
    camera_id TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    direction TEXT NOT NULL,
    vehicle_type TEXT NOT NULL,
    detection_confidence REAL NOT NULL,
    ocr_confidence REAL NOT NULL,
    image_path TEXT,
    media_file_id INTEGER,
    FOREIGN KEY (camera_id) REFERENCES cameras(camera_id) ON DELETE CASCADE,
    FOREIGN KEY (media_file_id) REFERENCES media_files(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS trajectory_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plate_number TEXT NOT NULL,
    camera_id TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    seq_order INTEGER NOT NULL,
    travel_time_sec INTEGER DEFAULT 0,
    distance_km REAL DEFAULT 0.0,
    FOREIGN KEY (camera_id) REFERENCES cameras(camera_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plate_number TEXT NOT NULL,
    camera_id TEXT NOT NULL,
    location TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reason TEXT NOT NULL,
    alert_type TEXT NOT NULL, -- Watchlist Match, Repeated Detection, Unusual Route, High Congestion, OCR Anomaly
    confidence REAL NOT NULL,
    severity TEXT NOT NULL DEFAULT 'High', -- Critical, High, Medium, Low
    status TEXT NOT NULL DEFAULT 'Active', -- Active, Acknowledged
    acknowledged_at TIMESTAMP,
    FOREIGN KEY (camera_id) REFERENCES cameras(camera_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS watchlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plate_number TEXT UNIQUE NOT NULL,
    reason TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'High',
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

-- Indices for rapid real-time lookups
CREATE INDEX IF NOT EXISTS idx_detections_plate ON detections(plate_number);
CREATE INDEX IF NOT EXISTS idx_detections_camera ON detections(camera_id);
CREATE INDEX IF NOT EXISTS idx_detections_time ON detections(timestamp);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_watchlist_plate ON watchlist(plate_number);
