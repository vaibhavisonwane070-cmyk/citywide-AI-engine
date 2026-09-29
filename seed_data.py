import os
import sqlite3
import random
from datetime import datetime, timedelta
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont
from config import Config
from database.db import get_db, init_db

# Predefined realistic city cameras
CAMERAS = [
    {"camera_id": "CAM-01", "name": "Shivajinagar Junction", "location": "Old Mumbai-Pune Hwy, Shivajinagar", "latitude": 18.5314, "longitude": 73.8446, "direction": "Northbound", "status": "READY"},
    {"camera_id": "CAM-02", "name": "FC Road Plaza", "location": "Fergusson College Rd, Deccan", "latitude": 18.5245, "longitude": 73.8402, "direction": "Southbound", "status": "READY"},
    {"camera_id": "CAM-03", "name": "Deccan Gymkhana Interchange", "location": "JM Road Cross, Deccan", "latitude": 18.5170, "longitude": 73.8410, "direction": "Westbound", "status": "READY"},
    {"camera_id": "CAM-04", "name": "Swargate Central Bus Hub", "location": "Jedhe Chowk, Swargate", "latitude": 18.5018, "longitude": 73.8580, "direction": "Southbound", "status": "READY"},
    {"camera_id": "CAM-05", "name": "Kothrud Paud Phata", "location": "Paud Road, Kothrud", "latitude": 18.5074, "longitude": 73.8077, "direction": "Westbound", "status": "READY"},
    {"camera_id": "CAM-06", "name": "Hinjawadi IT Park Gate 1", "location": "Hinjawadi Phase 1 Circle", "latitude": 18.5913, "longitude": 73.7389, "direction": "Eastbound", "status": "READY"},
    {"camera_id": "CAM-07", "name": "Koregaon Park North Main", "location": "North Main Rd, Lane 5", "latitude": 18.5362, "longitude": 73.8939, "direction": "Northbound", "status": "PROCESSING"},
    {"camera_id": "CAM-08", "name": "Viman Nagar Airport Road", "location": "Airport Rd, Symbiosis Chowk", "latitude": 18.5679, "longitude": 73.9143, "direction": "Eastbound", "status": "READY"},
    {"camera_id": "CAM-09", "name": "Hadapsar Magarpatta Crossing", "location": "Magarpatta South Gate", "latitude": 18.5089, "longitude": 73.9260, "direction": "Southbound", "status": "READY"},
    {"camera_id": "CAM-10", "name": "Katraj Bypass Flyover", "location": "Katraj Chowk, NH-48", "latitude": 18.4575, "longitude": 73.8677, "direction": "Southbound", "status": "READY"},
    {"camera_id": "CAM-11", "name": "Baner High Street", "location": "Baner Rd, Balewadi Phata", "latitude": 18.5590, "longitude": 73.7780, "direction": "Northbound", "status": "READY"},
    {"camera_id": "CAM-12", "name": "Aundh Parihar Chowk", "location": "Parihar Chowk, Aundh", "latitude": 18.5602, "longitude": 73.8072, "direction": "Eastbound", "status": "OFFLINE"}
]

# Watchlist data
WATCHLIST = [
    {"plate_number": "MH12DEMO01", "reason": "Reported Stolen Luxury Sedan - BOLO Active", "severity": "Critical", "notes": "Suspect vehicle involved in interstate theft ring. Intercept with caution."},
    {"plate_number": "MH14TEST02", "reason": "Unpaid Critical Violations & Surveillance Warrant", "severity": "High", "notes": "Multiple red-light evasions and high-speed corridor violations."},
    {"plate_number": "MH12AB9999", "reason": "Blacklisted Commercial Fleet Vehicle", "severity": "Medium", "notes": "Permit cancelled due to hazardous material transport violations."}
]

# Vehicle types
VEHICLE_TYPES = ["Sedan", "SUV", "Motorcycle", "Hatchback", "Bus", "Delivery Van", "Auto-rickshaw", "Truck"]

def create_sample_image(plate_number, vehicle_type, filename):
    """Generates a realistic synthetic test camera capture image with vehicle bounding box and license plate."""
    os.makedirs(Config.SAMPLE_FOLDER, exist_ok=True)
    img_path = os.path.join(Config.SAMPLE_FOLDER, filename)
    
    # Create 800x480 dark traffic street backdrop
    w, h = 800, 480
    img = np.zeros((h, w, 3), dtype=np.uint8)
    # Gradient asphalt road & evening lighting
    for y in range(h):
        val = int(25 + 30 * (y / h))
        img[y, :] = (val + 10, val + 5, val)
        
    # Road markings
    cv2.line(img, (0, int(h * 0.75)), (w, int(h * 0.75)), (60, 60, 60), 2)
    for x in range(0, w, 80):
        cv2.line(img, (x, int(h * 0.85)), (x + 40, int(h * 0.85)), (180, 180, 180), 3)
        
    # Simulated vehicle bounding box
    vx1, vy1, vx2, vy2 = 180, 100, 620, 410
    car_color = (70, 70, 90) if "Sedan" in vehicle_type else (40, 60, 100)
    cv2.rectangle(img, (vx1, vy1), (vx2, vy2), car_color, -1)
    cv2.rectangle(img, (vx1 + 20, vy1 + 20), (vx2 - 20, vy1 + 140), (20, 25, 35), -1) # Windshield
    cv2.rectangle(img, (vx1, vy1), (vx2, vy2), (0, 242, 254), 2) # CV Bounding box green/cyan

    # Headlights / taillights
    cv2.circle(img, (vx1 + 45, vy2 - 80), 20, (0, 220, 255), -1)
    cv2.circle(img, (vx2 - 45, vy2 - 80), 20, (0, 220, 255), -1)
    
    # License plate plate rectangle
    px1, py1, px2, py2 = 320, 320, 480, 375
    cv2.rectangle(img, (px1, py1), (px2, py2), (250, 250, 250), -1)
    cv2.rectangle(img, (px1, py1), (px2, py2), (20, 20, 20), 2)
    # IND flag band
    cv2.rectangle(img, (px1 + 2, py1 + 2), (px1 + 18, py2 - 2), (180, 50, 20), -1)

    # Convert to PIL to draw crisp license plate text
    pil_img = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
    draw = ImageDraw.Draw(pil_img)
    
    # Try standard font, fallback to default
    try:
        font = ImageFont.truetype("arial.ttf", 22)
        hud_font = ImageFont.truetype("arial.ttf", 14)
    except:
        font = ImageFont.load_default()
        hud_font = ImageFont.load_default()
        
    draw.text((px1 + 24, py1 + 12), plate_number, fill=(10, 10, 10), font=font)
    
    # Add Camera HUD overlay
    draw.text((15, 15), f"CAM-SYS: LIVE CAPTURE // {vehicle_type.upper()}", fill=(0, 242, 254), font=hud_font)
    draw.text((15, 35), f"DETECTED PLATE: {plate_number} (CONF: 97.8%)", fill=(52, 211, 153), font=hud_font)
    
    # Save image
    res = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
    cv2.imwrite(img_path, res)
    return f"samples/{filename}"

def seed_database():
    """Populates cameras, vehicles, detections, trajectories, watchlist, and alerts."""
    init_db()
    conn = get_db()
    cursor = conn.cursor()

    print("Seeding Cameras...")
    cursor.execute("DELETE FROM cameras")
    for cam in CAMERAS:
        cursor.execute("""
            INSERT INTO cameras (camera_id, name, location, latitude, longitude, direction, status, stream_mode)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (cam["camera_id"], cam["name"], cam["location"], cam["latitude"], cam["longitude"], cam["direction"], cam["status"], "UPLOAD MODE"))

    print("Seeding Watchlist...")
    cursor.execute("DELETE FROM watchlist")
    for w in WATCHLIST:
        cursor.execute("""
            INSERT INTO watchlist (plate_number, reason, severity, notes)
            VALUES (?, ?, ?, ?)
        """, (w["plate_number"], w["reason"], w["severity"], w["notes"]))

    # Clean existing detections, trajectory points, vehicles, alerts
    cursor.execute("DELETE FROM detections")
    cursor.execute("DELETE FROM trajectory_points")
    cursor.execute("DELETE FROM vehicles")
    cursor.execute("DELETE FROM alerts")
    cursor.execute("DELETE FROM media_files")

    # Generate sample images for the key targets
    print("Generating synthetic sample test captures...")
    img1 = create_sample_image("MH12DEMO01", "Sedan", "sample_mh12demo01.jpg")
    img2 = create_sample_image("MH14TEST02", "SUV", "sample_mh14test02.jpg")
    img3 = create_sample_image("MH13DEMO03", "Delivery Van", "sample_mh13demo03.jpg")
    img4 = create_sample_image("MH12AB1234", "Hatchback", "sample_mh12ab1234.jpg")

    now = datetime.now()

    # Define Trajectory 1: MH12DEMO01 (Critical Watchlist target moving from Hinjawadi to Katraj)
    t1_cams = ["CAM-06", "CAM-11", "CAM-01", "CAM-03", "CAM-04", "CAM-10"]
    t1_times = [
        now - timedelta(minutes=65),
        now - timedelta(minutes=52),
        now - timedelta(minutes=38),
        now - timedelta(minutes=24),
        now - timedelta(minutes=14),
        now - timedelta(minutes=4)
    ]
    
    print("Seeding Trajectory Target 1 (MH12DEMO01)...")
    cursor.execute("""
        INSERT INTO vehicles (plate_number, vehicle_type, first_seen, last_seen, total_detections, is_watchlist)
        VALUES (?, ?, ?, ?, ?, ?)
    """, ("MH12DEMO01", "Sedan", t1_times[0].strftime("%Y-%m-%d %H:%M:%S"), t1_times[-1].strftime("%Y-%m-%d %H:%M:%S"), len(t1_cams), 1))

    cam_dict = {c["camera_id"]: c for c in CAMERAS}
    
    for i, cid in enumerate(t1_cams):
        cam = cam_dict[cid]
        ts_str = t1_times[i].strftime("%Y-%m-%d %H:%M:%S")
        cursor.execute("""
            INSERT INTO detections (plate_number, camera_id, timestamp, latitude, longitude, direction, vehicle_type, detection_confidence, ocr_confidence, image_path)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, ("MH12DEMO01", cid, ts_str, cam["latitude"], cam["longitude"], cam["direction"], "Sedan", 0.96 + (i % 3) * 0.01, 0.95 + (i % 4) * 0.01, img1))
        
        # Trajectory point
        t_sec = 0 if i == 0 else int((t1_times[i] - t1_times[i-1]).total_seconds())
        cursor.execute("""
            INSERT INTO trajectory_points (plate_number, camera_id, timestamp, seq_order, travel_time_sec, distance_km)
            VALUES (?, ?, ?, ?, ?, ?)
        """, ("MH12DEMO01", cid, ts_str, i + 1, t_sec, 3.8 + i * 1.5))

    # Alert for MH12DEMO01
    cursor.execute("""
        INSERT INTO alerts (plate_number, camera_id, location, timestamp, reason, alert_type, confidence, severity, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, ("MH12DEMO01", "CAM-10", "Katraj Bypass Flyover, NH-48", t1_times[-1].strftime("%Y-%m-%d %H:%M:%S"),
          "Watchlist Match: Stolen Luxury Sedan detected at high-speed outbound corridor", "Watchlist Match", 0.98, "Critical", "Active"))

    # Define Trajectory 2: MH14TEST02 (High Watchlist target)
    t2_cams = ["CAM-12", "CAM-01", "CAM-02", "CAM-03"]
    t2_times = [
        now - timedelta(hours=2, minutes=20),
        now - timedelta(hours=2, minutes=5),
        now - timedelta(hours=1, minutes=48),
        now - timedelta(hours=1, minutes=30)
    ]
    cursor.execute("""
        INSERT INTO vehicles (plate_number, vehicle_type, first_seen, last_seen, total_detections, is_watchlist)
        VALUES (?, ?, ?, ?, ?, ?)
    """, ("MH14TEST02", "SUV", t2_times[0].strftime("%Y-%m-%d %H:%M:%S"), t2_times[-1].strftime("%Y-%m-%d %H:%M:%S"), len(t2_cams), 1))

    for i, cid in enumerate(t2_cams):
        cam = cam_dict[cid]
        ts_str = t2_times[i].strftime("%Y-%m-%d %H:%M:%S")
        cursor.execute("""
            INSERT INTO detections (plate_number, camera_id, timestamp, latitude, longitude, direction, vehicle_type, detection_confidence, ocr_confidence, image_path)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, ("MH14TEST02", cid, ts_str, cam["latitude"], cam["longitude"], cam["direction"], "SUV", 0.94, 0.93, img2))
        t_sec = 0 if i == 0 else int((t2_times[i] - t2_times[i-1]).total_seconds())
        cursor.execute("""
            INSERT INTO trajectory_points (plate_number, camera_id, timestamp, seq_order, travel_time_sec, distance_km)
            VALUES (?, ?, ?, ?, ?, ?)
        """, ("MH14TEST02", cid, ts_str, i + 1, t_sec, 2.5 + i * 1.1))

    cursor.execute("""
        INSERT INTO alerts (plate_number, camera_id, location, timestamp, reason, alert_type, confidence, severity, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, ("MH14TEST02", "CAM-03", "JM Road Cross, Deccan", t2_times[-1].strftime("%Y-%m-%d %H:%M:%S"),
          "Repeated Violation: Surveillance Warrant active for evasive maneuver", "Watchlist Match", 0.95, "High", "Active"))

    # Define Trajectory 3: MH13DEMO03 (Unusual Route Alert)
    t3_cams = ["CAM-09", "CAM-07", "CAM-08", "CAM-01"]
    t3_times = [
        now - timedelta(hours=3, minutes=15),
        now - timedelta(hours=2, minutes=50),
        now - timedelta(hours=2, minutes=20),
        now - timedelta(hours=1, minutes=55)
    ]
    cursor.execute("""
        INSERT INTO vehicles (plate_number, vehicle_type, first_seen, last_seen, total_detections, is_watchlist)
        VALUES (?, ?, ?, ?, ?, ?)
    """, ("MH13DEMO03", "Delivery Van", t3_times[0].strftime("%Y-%m-%d %H:%M:%S"), t3_times[-1].strftime("%Y-%m-%d %H:%M:%S"), len(t3_cams), 0))

    for i, cid in enumerate(t3_cams):
        cam = cam_dict[cid]
        ts_str = t3_times[i].strftime("%Y-%m-%d %H:%M:%S")
        cursor.execute("""
            INSERT INTO detections (plate_number, camera_id, timestamp, latitude, longitude, direction, vehicle_type, detection_confidence, ocr_confidence, image_path)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, ("MH13DEMO03", cid, ts_str, cam["latitude"], cam["longitude"], cam["direction"], "Delivery Van", 0.92, 0.91, img3))
        t_sec = 0 if i == 0 else int((t3_times[i] - t3_times[i-1]).total_seconds())
        cursor.execute("""
            INSERT INTO trajectory_points (plate_number, camera_id, timestamp, seq_order, travel_time_sec, distance_km)
            VALUES (?, ?, ?, ?, ?, ?)
        """, ("MH13DEMO03", cid, ts_str, i + 1, t_sec, 4.0 + i * 1.8))

    cursor.execute("""
        INSERT INTO alerts (plate_number, camera_id, location, timestamp, reason, alert_type, confidence, severity, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, ("MH13DEMO03", "CAM-01", "Old Mumbai-Pune Hwy, Shivajinagar", t3_times[-1].strftime("%Y-%m-%d %H:%M:%S"),
          "Unusual Route: Commercial cargo transit detected in restricted perimeter during peak restriction hours", "Unusual Route", 0.89, "Medium", "Active"))

    # Additional alerts: High Congestion & OCR Anomaly
    cursor.execute("""
        INSERT INTO alerts (plate_number, camera_id, location, timestamp, reason, alert_type, confidence, severity, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, ("N/A", "CAM-04", "Jedhe Chowk, Swargate", (now - timedelta(minutes=18)).strftime("%Y-%m-%d %H:%M:%S"),
          "High Congestion: Swargate interchange exceeding 92% vehicular capacity threshold", "High Congestion", 0.97, "High", "Active"))

    cursor.execute("""
        INSERT INTO alerts (plate_number, camera_id, location, timestamp, reason, alert_type, confidence, severity, status, acknowledged_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, ("MH12XX??88", "CAM-02", "Fergusson College Rd, Deccan", (now - timedelta(minutes=45)).strftime("%Y-%m-%d %H:%M:%S"),
          "OCR Anomaly: License plate partially obscured or modified (Ambiguity detected)", "OCR Anomaly", 0.62, "Low", "Acknowledged", (now - timedelta(minutes=10)).strftime("%Y-%m-%d %H:%M:%S")))

    # Generate 50+ additional background traffic detections across all cameras
    print("Generating 50+ background traffic detections...")
    other_plates = [
        ("MH12AB1234", "Car"), ("MH12CD5678", "SUV"), ("MH12EF9012", "Hatchback"),
        ("MH14KL3456", "Motorcycle"), ("MH14MN7890", "Sedan"), ("MH12PQ4321", "Bus"),
        ("MH12RS8765", "Auto-rickshaw"), ("MH14TU2109", "Car"), ("MH12VW6543", "Truck"),
        ("MH12XY0987", "Sedan"), ("MH14AA1122", "SUV"), ("MH12BB3344", "Delivery Van"),
        ("MH12CC5566", "Hatchback"), ("MH14DD7788", "Motorcycle"), ("MH12EE9900", "Car")
    ]

    for p_num, v_type in other_plates:
        # Create vehicle record
        v_cams = random.sample(CAMERAS, k=random.randint(2, 4))
        first_t = now - timedelta(hours=random.randint(6, 36))
        last_t = first_t + timedelta(minutes=random.randint(15, 120))
        
        cursor.execute("""
            INSERT INTO vehicles (plate_number, vehicle_type, first_seen, last_seen, total_detections, is_watchlist)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (p_num, v_type, first_t.strftime("%Y-%m-%d %H:%M:%S"), last_t.strftime("%Y-%m-%d %H:%M:%S"), len(v_cams), 0))

        current_time = first_t
        for seq, cam in enumerate(v_cams):
            current_time += timedelta(minutes=random.randint(5, 25))
            cursor.execute("""
                INSERT INTO detections (plate_number, camera_id, timestamp, latitude, longitude, direction, vehicle_type, detection_confidence, ocr_confidence, image_path)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (p_num, cam["camera_id"], current_time.strftime("%Y-%m-%d %H:%M:%S"),
                  cam["latitude"], cam["longitude"], cam["direction"], v_type,
                  round(random.uniform(0.88, 0.98), 2), round(random.uniform(0.85, 0.97), 2),
                  img4))

    conn.commit()
    conn.close()
    print("Database seeding completed successfully! Over 65 detections, 12 cameras, and trajectories initialized.")

if __name__ == "__main__":
    seed_database()
