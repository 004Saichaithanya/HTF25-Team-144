import cv2 as cv
import numpy as np
from ultralytics import YOLO
from db_setup import Session, init_db, DetectionLog, AlertLog
import math
from collections import deque


def apply_clahe(img):
    lab = cv.cvtColor(img, cv.COLOR_BGR2LAB)
    l, a, b = cv.split(lab)
    clahe = cv.createCLAHE(clipLimit=3.0, tileGridSize=(8,8))
    l = clahe.apply(l)
    lab = cv.merge((l, a, b))
    return cv.cvtColor(lab, cv.COLOR_LAB2BGR)


# Module-level thresholds that can be changed at runtime
crowd_threshold = 15
surge_limit = 8


def set_crowd_threshold(val):
    """Set the crowd threshold (number of people) used to trigger threshold alerts."""
    global crowd_threshold
    try:
        crowd_threshold = int(val)
        print(f"Updated crowd_threshold to {crowd_threshold}")
    except Exception as e:
        print(f"Failed to set crowd_threshold: {e}")


def set_surge_limit(val):
    global surge_limit
    try:
        surge_limit = int(val)
        print(f"Updated surge_limit to {surge_limit}")
    except Exception as e:
        print(f"Failed to set surge_limit: {e}")

# === STAMPEDE MODULE START ===
class StampedeDetector:
    def __init__(self, frame_width, frame_height):
        self.width = frame_width
        self.height = frame_height
        self.prev_positions = []
        self.velocity_history = deque(maxlen=10)
        self.count_history = deque(maxlen=10)
        self.grid_size = 100
        self.high_density_threshold = 8
        self.velocity_threshold = 30
        self.panic_velocity_threshold = 60
        self.grid_rows = frame_height // self.grid_size
        self.grid_cols = frame_width // self.grid_size

    def calculate_density_grid(self, detections):
        grid = np.zeros((self.grid_rows, self.grid_cols))
        for d in detections:
            cx, cy = d['center']
            gx = min(int(cx / self.grid_size), self.grid_cols - 1)
            gy = min(int(cy / self.grid_size), self.grid_rows - 1)
            grid[gy, gx] += 1
        return grid

    def detect_high_density_zones(self, density_grid):
        zones = []
        for y in range(self.grid_rows):
            for x in range(self.grid_cols):
                density = density_grid[y, x]
                if density >= self.high_density_threshold:
                    zones.append({
                        'x': x * self.grid_size,
                        'y': y * self.grid_size,
                        'density': int(density),
                        'risk_level': 'critical' if density > 12 else 'high'
                    })
        return zones

    def calculate_crowd_velocity(self, current_positions):
        if len(self.prev_positions) == 0:
            self.prev_positions = current_positions.copy()
            return {'avg': 0, 'max': 0}
        vels = []
        for cur in current_positions:
            nearest = min((math.hypot(cur[0]-p[0], cur[1]-p[1]) for p in self.prev_positions), default=None)
            if nearest and nearest < 100:
                vels.append(nearest)
        self.prev_positions = current_positions.copy()
        if vels:
            avg = np.mean(vels)
            maxv = np.max(vels)
            self.velocity_history.append(avg)
            return {'avg': avg, 'max': maxv}
        return {'avg': 0, 'max': 0}

    def detect_patterns(self, velocity, zones, count):
        alerts = []
        self.count_history.append(count)

        if velocity['avg'] > self.panic_velocity_threshold:
            alerts.append({'type': 'panic_movement', 'severity': 'critical',
                           'message': f"⚠️ PANIC! Avg velocity {velocity['avg']:.1f}",'count': {count}})
        elif velocity['avg'] > self.velocity_threshold and len(zones) > 0:
            alerts.append({'type': 'stampede_risk', 'severity': 'high',
                           'message': f"🚨 Fast movement in {len(zones)} dense zones",'count': {count}})
        crit = [z for z in zones if z['risk_level'] == 'critical']
        if crit:
            alerts.append({'type': 'critical_density', 'severity': 'high',
                           'message': f"🔴 {len(crit)} critical crowd zones",'count': {count}})
        if len(self.count_history) >= 3:
            recent = list(self.count_history)[-3:]
            if recent[-1] - recent[0] > 10:
                alerts.append({'type': 'crowd_surge', 'severity': 'medium',
                               'message': f"📈 Sudden surge +{recent[-1]-recent[0]} people",'count': {count}})
        return alerts
# === STAMPEDE MODULE END ===


def start_detection(socketio, frame_callback=None, video_source='data/crowd_vid.mp4', show_window=False):
    cap = cv.VideoCapture(video_source)
    model = YOLO('best_drone.pt')
    heatmap = None
    init_db()
    session = Session()

    frame_count = 0
    skip_rate = 3   # process every 3rd frame (adjust as needed)

    # === STAMPEDE MODULE INIT ===
    ret, test_frame = cap.read()
    if not ret:
        print("Video not found or unreadable.")
        return
    h, w = test_frame.shape[:2]
    cap.set(cv.CAP_PROP_POS_FRAMES, 0)
    stampede_detector = StampedeDetector(w, h)
    # === END INIT ===

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame_count += 1
        if frame_count % skip_rate != 0:
            continue

        # Preprocess
        frame_resized = apply_clahe(frame.copy())
        height, width = frame_resized.shape[:2]

        if heatmap is None:
            heatmap = np.zeros((height, width), dtype=np.float32)

        results = model(frame_resized, conf=0.4, iou=0.45)
        display = frame_resized.copy()
        person_count = 0
        current_positions = []

        for result in results:
            boxes = result.boxes.xyxy.cpu().numpy()
            classes = result.boxes.cls.cpu().numpy()

            for i, c in enumerate(classes):
                if int(c) == 0:  # person
                    person_count += 1
                    x1, y1, x2, y2 = boxes[i]
                    cx = int((x1 + x2) / 2)
                    cy = int((y1 + y2) / 2)
                    current_positions.append((cx, cy))
                    cv.circle(display, (cx, cy), 6, (0, 255, 0), -1)
                    cv.circle(heatmap, (cx, cy), 20, 255, -1)

        # === STAMPEDE DETECTION START ===
        if current_positions:
            density_grid = stampede_detector.calculate_density_grid(
                [{'center': p} for p in current_positions]
            )
            zones = stampede_detector.detect_high_density_zones(density_grid)
            vel = stampede_detector.calculate_crowd_velocity(current_positions)
            alerts = stampede_detector.detect_patterns(vel, zones, person_count)

            # Draw danger zones
            for zone in zones:
                color = (0, 0, 255) if zone['risk_level'] == 'critical' else (0, 165, 255)
                cv.rectangle(display, (zone['x'], zone['y']),
                             (zone['x']+stampede_detector.grid_size, zone['y']+stampede_detector.grid_size),
                             color, 3)
                cv.putText(display, f"{zone['density']} ppl",
                           (zone['x']+5, zone['y']+25),
                           cv.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

            # Emit alerts
            for a in alerts:
                socketio.emit('stampede_alert', a)
                alert_db = AlertLog(type=a['type'], count=person_count)
                session.add(alert_db)
                session.commit()
        # === STAMPEDE DETECTION END ===

        # Create heatmap and overlay
        heatmap_blur = cv.GaussianBlur(heatmap, (25, 25), 0)
        heatmap_img = cv.applyColorMap(cv.convertScaleAbs(heatmap_blur, alpha=0.4), cv.COLORMAP_JET)
        overlayed = cv.addWeighted(display, 0.7, heatmap_img, 0.3, 0)

        # Draw person count on frame
        cv.putText(overlayed, f'Detected People: {person_count}', (20, 50),
                   cv.FONT_HERSHEY_COMPLEX, 1.5, (0, 0, 255), 3)

        # Log to DB
        log = DetectionLog(count=person_count)
        session.add(log)
        session.commit()

        # Surge detection (existing)
        recent_counts = session.query(DetectionLog).order_by(DetectionLog.id.desc()).limit(5).all()
        if len(recent_counts) >= 2:
            latest = recent_counts[0].count
            previous = recent_counts[1].count
            delta = abs(latest - previous)
            if delta >= surge_limit:
                socketio.emit('alert_event',
                              {'type': 'crowd_surge', 'count': latest, 'delta': delta})
                alert = AlertLog(type='crowd_surge', count=latest)
                session.add(alert)
                session.commit()

        # Threshold alert (existing)
        if person_count > crowd_threshold:
            socketio.emit('alert_event',
                          {'type': 'crowd_threshold_exceeded', 'count': person_count})
            alert = AlertLog(type='crowd_threshold_exceeded', count=person_count)
            session.add(alert)
            session.commit()

        # Resize for display
        display_frame = cv.resize(overlayed, (800, 600))

        # Callback
        if frame_callback:
            frame_callback(display_frame)

        # Density calc
        area = 100
        density = person_count / area
        socketio.emit('crowd_update', {
            'count': person_count,
            'density': round(density, 2)
        })

        if show_window:
            cv.imshow('Crowd Heatmap Video', display_frame)
            if cv.waitKey(1) & 0xFF == ord('q'):
                break

    cap.release()
    if show_window:
        cv.destroyAllWindows()
