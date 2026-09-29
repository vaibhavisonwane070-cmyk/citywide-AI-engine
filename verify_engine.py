"""
CITYVISION AI — Automated End-to-End Verification Test Script
Tests all pages, REST endpoints, database operations, and AI pipeline processing.
"""

import app as app_module
from services.ocr_service import extract_plate_from_crop, validate_plate_format

app = app_module.app
def run_tests():
    print("==================================================================")
    print("STARTING CITYVISION AI SYSTEM VERIFICATION TESTS")
    print("==================================================================")
    
    client = app.test_client()
    passed = 0
    failed = 0

    def assert_test(name, condition, details=""):
        nonlocal passed, failed
        if condition:
            print(f" [PASS] {name}")
            passed += 1
        else:
            print(f" [FAIL] {name} - {details}")
            failed += 1

    # 1. Test Static Pages
    pages = [
        ('/login', 'Operator Portal'),
        ('/dashboard', 'Urban Traffic Intelligence Command Center'),
        ('/cameras', 'Camera Network Management'),
        ('/upload', 'Camera Media Ingest & AI Pipeline'),
        ('/detections', 'ANPR Optical Detection History'),
        ('/search', 'Vehicle Intelligence Search'),
        ('/trajectories', 'Multi-Camera GIS Trajectory Reconstruction'),
        ('/analytics', 'Urban Traffic Intelligence Analytics'),
        ('/alerts', 'Watchlist & High-Interest Alert Center'),
        ('/reports', 'Traffic Intelligence Reports & Audit Logs'),
        ('/status', 'System Infrastructure & AI Health Monitor'),
    ]

    print("\n--- Testing Page Endpoints (HTML) ---")
    for url, title_snip in pages:
        res = client.get(url)
        assert_test(f"GET {url}", res.status_code == 200 and title_snip in res.get_data(as_text=True), f"Status: {res.status_code}")

    # 2. Test Quick Login
    print("\n--- Testing Authentication ---")
    login_res = client.get('/quick-login', follow_redirects=True)
    assert_test("GET /quick-login", login_res.status_code == 200 and "Urban Traffic Intelligence" in login_res.get_data(as_text=True))

    # 3. Test REST API Endpoints
    print("\n--- Testing REST API Endpoints (JSON) ---")
    
    # /api/dashboard/stats
    res = client.get('/api/dashboard/stats')
    data = res.get_json() or {}
    assert_test("GET /api/dashboard/stats", res.status_code == 200 and data.get("status") == "success" and "kpis" in data)

    # /api/cameras
    res = client.get('/api/cameras')
    data = res.get_json() or {}
    cams = data.get("cameras", [])
    assert_test("GET /api/cameras", res.status_code == 200 and len(cams) >= 10, f"Found {len(cams)} cameras")

    # /api/detections
    res = client.get('/api/detections')
    data = res.get_json() or {}
    dets = data.get("detections", [])
    assert_test("GET /api/detections", res.status_code == 200 and len(dets) > 0, f"Found {len(dets)} detections")

    # /api/vehicles/search
    res = client.get('/api/vehicles/search?plate=MH12DEMO01')
    data = res.get_json() or {}
    vehs = data.get("vehicles", [])
    assert_test("GET /api/vehicles/search?plate=MH12DEMO01", res.status_code == 200 and len(vehs) >= 1 and vehs[0]["plate_number"] == "MH12DEMO01")

    # /api/vehicles/MH12DEMO01/trajectory
    res = client.get('/api/vehicles/MH12DEMO01/trajectory')
    data = res.get_json() or {}
    traj_data = data.get("data", {})
    assert_test("GET /api/vehicles/MH12DEMO01/trajectory", res.status_code == 200 and traj_data.get("found") is True and len(traj_data.get("trajectory", [])) >= 4)

    # /api/analytics
    res = client.get('/api/analytics')
    data = res.get_json() or {}
    an_data = data.get("data", {})
    assert_test("GET /api/analytics", res.status_code == 200 and "charts" in an_data and "kpis" in an_data)

    # /api/alerts
    res = client.get('/api/alerts')
    data = res.get_json() or {}
    alerts = data.get("alerts", [])
    assert_test("GET /api/alerts", res.status_code == 200 and len(alerts) >= 3, f"Found {len(alerts)} alerts")

    # /api/watchlist
    res = client.get('/api/watchlist')
    data = res.get_json() or {}
    wl = data.get("watchlist", [])
    assert_test("GET /api/watchlist", res.status_code == 200 and len(wl) >= 2, f"Found {len(wl)} targets")

    # /api/system/status
    res = client.get('/api/system/status')
    data = res.get_json() or {}
    comps = data.get("components", [])
    assert_test("GET /api/system/status", res.status_code == 200 and len(comps) == 6)

    # 4. Verify OCR and no-detection behavior without requiring downloaded model weights
    print("\n--- Testing OCR and No-Detection Behavior ---")
    empty_ocr = extract_plate_from_crop(None)
    assert_test("OCR does not invent a plate", empty_ocr["plate_number"] == "" and empty_ocr["ocr_confidence"] == 0)
    assert_test("OCR rejects unsupported plate formats", not validate_plate_format("NOTAPLATE")[0])

    original_pipeline = app_module.process_media_pipeline
    app_module.process_media_pipeline = lambda **kwargs: {
        "plate_number": "", "vehicle_type": "Unknown", "detection_confidence": 0.0,
        "ocr_confidence": 0.0, "is_valid_format": False,
        "format_note": "No readable plate", "image_path": "test.jpg",
        "processing_time_ms": 1, "ai_mode": "OPENCV + OCR", "track_id": None,
        "tracking": "Not available", "message": "No readable registration plate was detected."
    }
    try:
        res = client.post('/api/process', json={
            "camera_id": "CAM-01", "sample_name": "sample_mh12demo01.jpg",
            "preferred_plate": "MH12DEMO01"
        })
        data = res.get_json() or {}
        assert_test("POST /api/process does not trust caller plate", res.status_code == 200 and data.get("detected") is False and data.get("detection_id") is None)
    finally:
        app_module.process_media_pipeline = original_pipeline

    print("\n==================================================================")
    print(f"VERIFICATION SUMMARY: {passed} PASSED, {failed} FAILED")
    print("==================================================================")
    return failed == 0

if __name__ == "__main__":
    success = run_tests()
    exit(0 if success else 1)
