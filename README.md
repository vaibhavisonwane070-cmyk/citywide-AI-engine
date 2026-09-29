# CityVision AI

## Run

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python app.py
```

Open `http://127.0.0.1:5000`. The application initializes the SQLite schema on startup. Do not run `seed_data.py` against a database you want to keep; it clears and repopulates application tables.

## Detection models

- OpenCV decodes uploaded images and videos, proposes plate regions, and annotates OCR results.
- EasyOCR reads plate crops and reports its OCR confidence. Its English model is downloaded on the first OCR request, so that request needs network access unless the model is already cached.
- Ultralytics loads `yolo11n.pt` for vehicle classes by default and uses ByteTrack for video tracking. Set `VEHICLE_MODEL_PATH` to use different weights.
- For trained license-plate localization, set `PLATE_MODEL_PATH` to an Ultralytics-compatible plate-detection weights file. No plate model weights are included. Without them, OpenCV contour localization is a heuristic and its candidate score is not a calibrated probability.
- OCR results below 65% confidence or outside the supported Indian registration format are not stored as detections.
- Videos are sampled across at most 300 frames. ByteTrack IDs are produced only when the vehicle model is available.

OCR confidence is not a guarantee of the legally correct registration. Review the annotated capture before acting on a plate or watchlist match; low-quality images may return no detection.