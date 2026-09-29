"""
CITYVISION AI — Multi-Camera Trajectory Tracking Service
=========================================================
Reconstructs chronological vehicle journeys across metropolitan cameras.
Label: "Prototype Trajectory Reconstruction"
"""

import math
from datetime import datetime
from database.db import query_db

def calculate_haversine_distance(lat1, lon1, lat2, lon2):
    """Calculates geodesic distance between two GPS coordinates in kilometers."""
    R = 6371.0  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 2)

def reconstruct_trajectory(plate_number):
    """
    Reconstructs the full multi-camera route for a vehicle plate.
    Returns ordered waypoint nodes, GIS coordinates, hop timings, and metrics.
    """
    norm_plate = plate_number.upper().strip().replace(" ", "")

    # Query all detections for this vehicle joined with camera info
    query = """
        SELECT d.id, d.plate_number, d.camera_id, d.timestamp, d.latitude, d.longitude,
               d.direction, d.vehicle_type, d.detection_confidence, d.ocr_confidence, d.image_path,
               c.name as camera_name, c.location as camera_location
        FROM detections d
        LEFT JOIN cameras c ON d.camera_id = c.camera_id
        WHERE UPPER(REPLACE(d.plate_number, ' ', '')) = ?
        ORDER BY d.timestamp ASC
    """
    raw_detections = query_db(query, (norm_plate,))
    
    if not raw_detections:
        return {
            "plate_number": norm_plate,
            "found": False,
            "trajectory": [],
            "metrics": None,
            "message": f"No detections found for license plate {norm_plate}."
        }

    trajectory_nodes = []
    total_distance_km = 0.0
    total_elapsed_sec = 0

    for i, det in enumerate(raw_detections):
        node = dict(det)
        node["step_number"] = i + 1
        
        if i == 0:
            node["hop_time_sec"] = 0
            node["hop_time_formatted"] = "Start Point"
            node["hop_distance_km"] = 0.0
            node["estimated_speed_kmh"] = 0.0
        else:
            prev_node = raw_detections[i - 1]
            # Parse timestamps
            try:
                t1 = datetime.strptime(str(prev_node["timestamp"]), "%Y-%m-%d %H:%M:%S")
                t2 = datetime.strptime(str(det["timestamp"]), "%Y-%m-%d %H:%M:%S")
                hop_sec = max(1, int((t2 - t1).total_seconds()))
            except Exception:
                hop_sec = 600

            # Calculate distance
            dist = calculate_haversine_distance(
                prev_node["latitude"], prev_node["longitude"],
                det["latitude"], det["longitude"]
            )
            
            # Speed km/h = (dist / (sec / 3600))
            speed = round((dist / (hop_sec / 3600.0)), 1) if hop_sec > 0 else 0.0
            
            node["hop_time_sec"] = hop_sec
            node["hop_time_formatted"] = f"{hop_sec // 60}m {hop_sec % 60}s"
            node["hop_distance_km"] = dist
            node["estimated_speed_kmh"] = speed

            total_distance_km += dist
            total_elapsed_sec += hop_sec

        trajectory_nodes.append(node)

    first_det = trajectory_nodes[0]
    last_det = trajectory_nodes[-1]

    # Metrics summary
    avg_speed = round((total_distance_km / (total_elapsed_sec / 3600.0)), 1) if total_elapsed_sec > 0 else 0.0
    
    metrics = {
        "plate_number": norm_plate,
        "vehicle_type": first_det["vehicle_type"],
        "total_detections": len(trajectory_nodes),
        "unique_cameras": len(set(n["camera_id"] for n in trajectory_nodes)),
        "first_seen": first_det["timestamp"],
        "last_seen": last_det["timestamp"],
        "first_camera": f"{first_det['camera_id']} ({first_det['camera_name']})",
        "last_camera": f"{last_det['camera_id']} ({last_det['camera_name']})",
        "total_distance_km": round(total_distance_km, 2),
        "total_duration_formatted": f"{total_elapsed_sec // 60}m {total_elapsed_sec % 60}s",
        "average_speed_kmh": avg_speed,
        "disclaimer": "Prototype Trajectory Reconstruction — Subject to Camera Network Coverage"
    }

    return {
        "plate_number": norm_plate,
        "found": True,
        "trajectory": trajectory_nodes,
        "metrics": metrics
    }
