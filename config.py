import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'cityvision-ai-secret-key-2026-traffic-intelligence')
    DATABASE_PATH = os.path.join(BASE_DIR, 'cityvision.db')
    UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
    SAMPLE_FOLDER = os.path.join(BASE_DIR, 'uploads', 'samples')
    MAX_CONTENT_LENGTH = 100 * 1024 * 1024  # 100 MB max file upload
    ALLOWED_EXTENSIONS = {'mp4', 'avi', 'mov', 'mkv', 'jpg', 'jpeg', 'png', 'webp'}
    VEHICLE_MODEL_PATH = os.environ.get('VEHICLE_MODEL_PATH', 'yolo11n.pt')
    PLATE_MODEL_PATH = os.environ.get('PLATE_MODEL_PATH', '')
    AI_MODE = os.environ.get('AI_MODE', 'ACTIVE')
    CITY_NAME = "Metropolitan Smart Traffic Grid"
    DEFAULT_MAP_CENTER = [18.5204, 73.8567]  # Pune city center default
    DEFAULT_MAP_ZOOM = 13
