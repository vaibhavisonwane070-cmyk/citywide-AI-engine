"""
CITYVISION AI — OCR & License Plate Extraction Service
========================================================
Normalizes plates:
'MH 12 AB 1234' -> 'MH12AB1234'
'mh-12-ab-1234' -> 'MH12AB1234'
Performs basic format validation (non-legal/advisory).
"""

import re
import cv2

_reader = None


def normalize_plate(raw_text):
    """
    Cleans and standardizes raw OCR characters into canonical plate representation.
    Example: 'MH 12 AB 1234' -> 'MH12AB1234'
    """
    if not raw_text:
        return ""
    # Strip spaces, hyphens, dots, and special punctuation, uppercase everything
    cleaned = re.sub(r'[^A-Za-z0-9]', '', raw_text).upper()
    return cleaned

def validate_plate_format(plate_text):
    """
    Basic structural format validation for Indian standard registration plates:
    Pattern: [STATE 2 letters] [DISTRICT 1-2 digits] [SERIES 0-3 letters] [4 digits]
    Example: MH12AB1234 or MH12DEMO01
    Returns (is_valid: bool, advisory_note: str)
    """
    if not plate_text or len(plate_text) < 6 or len(plate_text) > 12:
        return False, "Plate length outside standard 6-12 character standard"

    standard_pattern = r'^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$'
    if re.match(standard_pattern, plate_text):
        return True, "Standard Regional Transport Format"
    return False, "Text does not match a supported registration format"


def extract_plate_from_crop(plate_crop):
    """
    Reads text from an image crop using EasyOCR. No text is invented when OCR
    cannot read the crop.
    """
    global _reader
    if plate_crop is None or plate_crop.size == 0:
        raw_text, confidence = "", 0.0
    else:
        if _reader is None:
            import easyocr
            _reader = easyocr.Reader(["en"], gpu=False, verbose=False)
        gray = cv2.cvtColor(plate_crop, cv2.COLOR_BGR2GRAY) if len(plate_crop.shape) == 3 else plate_crop
        enlarged = cv2.resize(gray, None, fx=3, fy=3, interpolation=cv2.INTER_CUBIC)
        results = _reader.readtext(
            enlarged,
            detail=1,
            paragraph=False,
            allowlist="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
        )
        raw_text, confidence = max(
            ((text, float(score)) for _, text, score in results),
            key=lambda result: result[1],
            default=("", 0.0),
        )

    plate = normalize_plate(raw_text)
    is_valid, note = validate_plate_format(plate)
    return {
        "plate_number": plate if is_valid else "",
        "ocr_confidence": round(confidence, 4),
        "is_valid_format": is_valid,
        "format_note": note,
    }
