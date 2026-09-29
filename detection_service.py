"""
CITYVISION AI — Vehicle Detection & Pipeline Engine
===================================================
Orchestrates:
OpenCV -> Vehicle Detection -> Plate Detection -> OCR -> Plate Normalization -> Detection Event
Operates in "AI MODE: DEMO" or "AI MODE: ACTIVE".
"""

import os
import time
import uuid
import cv2
from config import Config
from services.ocr_service import extract_plate_from_crop

MAX_VIDEO_FRAMES = 300
MIN_OCR_CONFIDENCE = 0.65


def _plate_candidates(frame, plate_model=None):
    height, width = frame.shape[:2]
    candidates = []

    if plate_model is not None:
        predictions = plate_model.predict(frame, verbose=False)
        for box in predictions[0].boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
            confidence = float(box.conf[0])
            candidates.append((x1, y1, x2, y2, confidence))
    else:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        blackhat = cv2.morphologyEx(
            gray,
            cv2.MORPH_BLACKHAT,
            cv2.getStructuringElement(cv2.MORPH_RECT, (13, 5)),
        )
        gradient = cv2.Sobel(blackhat, cv2.CV_32F, 1, 0, ksize=-1)
        gradient = cv2.convertScaleAbs(gradient)
        gradient = cv2.morphologyEx(
            gradient,
            cv2.MORPH_CLOSE,
            cv2.getStructuringElement(cv2.MORPH_RECT, (17, 5)),
        )
        _, threshold = cv2.threshold(gradient, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
        contours, _ = cv2.findContours(threshold, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        min_area = max(300, int(width * height * 0.0002))
        max_area = int(width * height * 0.12)
        for contour in contours:
            x, y, box_width, box_height = cv2.boundingRect(contour)
            area = box_width * box_height
            aspect = box_width / max(1, box_height)
            if min_area <= area <= max_area and 2.0 <= aspect <= 6.5:
                rectangularity = cv2.contourArea(contour) / max(1, area)
                shape_score = max(0.0, 1.0 - abs(aspect - 4.0) / 4.0)
                candidates.append((x, y, x + box_width, y + box_height,
                                   round(min(0.99, 0.35 + 0.35 * rectangularity + 0.25 * shape_score), 4)))

    return sorted(candidates, key=lambda candidate: candidate[4], reverse=True)[:10]


def _vehicle_detections(frame, model, track_video):
    if model is None:
        return []
    kwargs = {"verbose": False, "classes": [2, 3, 5, 7]}
    if track_video:
        kwargs.update({"persist": True, "tracker": "bytetrack.yaml"})
        results = model.track(frame, **kwargs)
    else:
        results = model.predict(frame, **kwargs)

    detections = []
    result = results[0]
    for index, box in enumerate(result.boxes):
        class_id = int(box.cls[0])
        track_id = None
        if track_video and result.boxes.id is not None:
            track_id = int(result.boxes.id[index])
        detections.append({
            "box": tuple(map(int, box.xyxy[0].tolist())),
            "confidence": float(box.conf[0]),
            "vehicle_type": result.names.get(class_id, "Vehicle"),
            "track_id": track_id,
        })
    return detections


def _associate_vehicle(plate_box, vehicles):
    x1, y1, x2, y2 = plate_box
    center_x, center_y = (x1 + x2) / 2, (y1 + y2) / 2
    matches = [
        vehicle for vehicle in vehicles
        if vehicle["box"][0] <= center_x <= vehicle["box"][2]
        and vehicle["box"][1] <= center_y <= vehicle["box"][3]
    ]
    return max(matches, key=lambda vehicle: vehicle["confidence"], default=None)

def process_media_pipeline(camera_id, file_path):
    """
    Executes the complete end-to-end ANPR pipeline on an uploaded image or video:
    1. OpenCV Frame Ingestion
    2. Vehicle Detection (Haar/Contour/YOLO or Demo engine)
    3. Plate Region Bounding Box Detection
    4. OCR Extraction & Normalization
    5. Annotated Image Output Generation
    """
    start_time = time.time()
    
    # Check file exists
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Media file not found: {file_path}")

    # Determine if video or still image
    is_video = file_path.lower().endswith(('.mp4', '.avi', '.mov', '.mkv'))
    vehicle_model = None
    plate_model = None
    tracking_available = False
    try:
        from ultralytics import YOLO
    except Exception:
        YOLO = None

    if YOLO:
        try:
            vehicle_model = YOLO(Config.VEHICLE_MODEL_PATH)
            tracking_available = is_video
        except Exception:
            vehicle_model = None
        if Config.PLATE_MODEL_PATH and os.path.isfile(Config.PLATE_MODEL_PATH):
            try:
                plate_model = YOLO(Config.PLATE_MODEL_PATH)
            except Exception:
                plate_model = None

    if is_video:
        def iter_frames():
            cap = cv2.VideoCapture(file_path)
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            stride = max(1, (total_frames + MAX_VIDEO_FRAMES - 1) // MAX_VIDEO_FRAMES)
            frame_index = 0
            sampled = 0
            try:
                while sampled < MAX_VIDEO_FRAMES:
                    ok, frame = cap.read()
                    if not ok:
                        break
                    if frame_index % stride == 0:
                        yield frame_index, frame
                        sampled += 1
                    frame_index += 1
            finally:
                cap.release()

        frames = iter_frames()
    else:
        frame = cv2.imread(file_path)
        frames = iter([(0, frame)]) if frame is not None else iter([])

    best = None
    first_frame = None
    for frame_index, frame in frames:
        if first_frame is None:
            first_frame = frame.copy()
        vehicles = _vehicle_detections(frame, vehicle_model, is_video)
        for x1, y1, x2, y2, plate_det_conf in _plate_candidates(frame, plate_model):
            crop = frame[max(0, y1):min(frame.shape[0], y2), max(0, x1):min(frame.shape[1], x2)]
            ocr_result = extract_plate_from_crop(crop)
            if (ocr_result["is_valid_format"]
                    and ocr_result["ocr_confidence"] >= MIN_OCR_CONFIDENCE):
                vehicle = _associate_vehicle((x1, y1, x2, y2), vehicles)
                candidate = {
                    **ocr_result,
                    "detection_confidence": round(plate_det_conf, 4),
                    "vehicle_type": vehicle["vehicle_type"] if vehicle else "Unknown",
                    "track_id": vehicle["track_id"] if vehicle else None,
                    "frame": frame.copy(),
                    "plate_box": (x1, y1, x2, y2),
                    "frame_index": frame_index,
                }
                if best is None or candidate["ocr_confidence"] > best["ocr_confidence"]:
                    best = candidate

    if first_frame is None:
        raise ValueError("The uploaded media could not be decoded by OpenCV.")

    annotated_frame = (best["frame"] if best else first_frame).copy()
    plate_number = best["plate_number"] if best else ""
    vehicle_type = best["vehicle_type"] if best else "Unknown"
    det_conf = best["detection_confidence"] if best else 0.0
    ocr_conf = best["ocr_confidence"] if best else 0.0
    if best:
        x1, y1, x2, y2 = best["plate_box"]
        cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), (50, 220, 50), 2)
        cv2.putText(annotated_frame, f"{plate_number} OCR {ocr_conf:.0%}",
                    (x1, max(25, y1 - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (50, 220, 50), 2)
        if best["track_id"] is not None:
            cv2.putText(annotated_frame, f"Track {best['track_id']}",
                        (x1, min(annotated_frame.shape[0] - 8, y2 + 22)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.55, (254, 242, 0), 2)
    else:
        cv2.putText(annotated_frame, "No readable registration plate detected",
                    (15, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)

    proc_time = round((time.time() - start_time) * 1000, 1)
    processed_filename = f"annotated_{uuid.uuid4().hex[:12]}.jpg"
    out_path = os.path.join(Config.UPLOAD_FOLDER, processed_filename)
    if not cv2.imwrite(out_path, annotated_frame):
        raise OSError("Could not save the annotated image.")

    return {
        "plate_number": plate_number,
        "vehicle_type": vehicle_type,
        "detection_confidence": det_conf,
        "ocr_confidence": ocr_conf,
        "is_valid_format": bool(best),
        "format_note": (best["format_note"] if best else "No readable plate matched a supported format"),
        "image_path": processed_filename,
        "processing_time_ms": proc_time,
        "ai_mode": "ACTIVE" if vehicle_model or plate_model else "OPENCV + OCR",
        "track_id": best["track_id"] if best else None,
        "tracking": "ByteTrack" if tracking_available and vehicle_model else "Not available",
        "plate_localizer": "YOLO model" if plate_model else "OpenCV contour heuristic",
        "vehicle_detector": "YOLO" if vehicle_model else "Not configured",
        "message": "Plate detected from image OCR." if best else "No readable registration plate was detected.",
    }
