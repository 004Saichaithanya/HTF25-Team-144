# import cv2 as cv
# import numpy as np
# from ultralytics import YOLO
# from db_setup import Session, init_db, DetectionLog, AlertLog


# def apply_clahe(img):
#     lab = cv.cvtColor(img, cv.COLOR_BGR2LAB)
#     l, a, b = cv.split(lab)
#     clahe = cv.createCLAHE(clipLimit=3.0, tileGridSize=(8,8))
#     l = clahe.apply(l)
#     lab = cv.merge((l, a, b))
#     return cv.cvtColor(lab, cv.COLOR_LAB2BGR)

# def start_detection(socketio, frame_callback=None):
#     cap = cv.VideoCapture('data/crowd_vid.mp4')
#     model = YOLO('best_drone.pt')

#     heatmap = None

#     init_db()
#     session = Session()

#     # Define thresholds
#     crowd_threshold = 15
#     surge_limit = 8

#     frame_count = 0
#     skip_rate = 3   # process every 3rd frame (adjust as needed)

#     while True:
#         ret, frame = cap.read()
#         if not ret:
#             break

#         frame_count += 1
#         if frame_count % skip_rate != 0:
#             continue

#         # Preprocess
#         frame_resized = apply_clahe(frame.copy())
#         height, width = frame_resized.shape[:2]

#         if heatmap is None:
#             heatmap = np.zeros((height, width), dtype=np.float32)

#         results = model(frame_resized, conf=0.4, iou=0.45)
#         display = frame_resized.copy()
#         person_count = 0

#         for result in results:
#             boxes = result.boxes.xyxy.cpu().numpy()
#             classes = result.boxes.cls.cpu().numpy()

#             for i, c in enumerate(classes):
#                 if int(c) == 0:  # person
#                     person_count += 1
#                     x1, y1, x2, y2 = boxes[i]

#                     # Use small circle at centroid instead of rectangle
#                     cx = int((x1 + x2) / 2)
#                     cy = int((y1 + y2) / 2)
#                     cv.circle(display, (cx, cy), 6, (0, 255, 0), -1)  # green dot
#                     cv.circle(heatmap, (cx, cy), 20, 255, -1)

#         # Create heatmap and overlay
#         heatmap_blur = cv.GaussianBlur(heatmap, (25, 25), 0)
#         heatmap_img = cv.applyColorMap(cv.convertScaleAbs(heatmap_blur, alpha=0.4), cv.COLORMAP_JET)
#         overlayed = cv.addWeighted(display, 0.7, heatmap_img, 0.3, 0)

#         # Draw person count on frame
#         cv.putText(overlayed, f'Detected People: {person_count}', (20, 50),
#                    cv.FONT_HERSHEY_COMPLEX, 1.5, (0, 0, 255), 3)

#         # Log to DB
#         log = DetectionLog(count=person_count)
#         session.add(log)
#         session.commit()

#         # Surge detection
#         recent_counts = session.query(DetectionLog).order_by(DetectionLog.id.desc()).limit(5).all()
#         if len(recent_counts) >= 2:
#             latest = recent_counts[0].count
#             previous = recent_counts[1].count
#             delta = abs(latest - previous)
#             if delta >= surge_limit:
#                 socketio.emit('alert_event',
#                               {'type': 'crowd_surge', 'count': latest, 'delta': delta})
#                 alert = AlertLog(type='crowd_surge', count=latest)
#                 session.add(alert)
#                 session.commit()

#         # Threshold alert
#         if person_count > crowd_threshold:
#             socketio.emit('alert_event',
#                           {'type': 'crowd_threshold_exceeded', 'count': person_count})
#             alert = AlertLog(type='crowd_threshold_exceeded', count=person_count)
#             session.add(alert)
#             session.commit()

#         # Resize for display
#         display_frame = cv.resize(overlayed, (800, 600))
#         cv.imshow('Crowd Heatmap Video', display_frame)

#         # Emit people count to frontend
#         socketio.emit('crowd_update', {'count': person_count})

#         if frame_callback:
#             frame_callback(display_frame)

#         if cv.waitKey(1) & 0xFF == ord('q'):
#             break

#     cap.release()
#     cv.destroyAllWindows()


import cv2 as cv
import numpy as np
from ultralytics import YOLO
from db_setup import Session, init_db, DetectionLog, AlertLog

def apply_clahe(img):
    lab = cv.cvtColor(img, cv.COLOR_BGR2LAB)
    l, a, b = cv.split(lab)
    clahe = cv.createCLAHE(clipLimit=3.0, tileGridSize=(8,8))
    l = clahe.apply(l)
    lab = cv.merge((l, a, b))
    return cv.cvtColor(lab, cv.COLOR_LAB2BGR)

def start_detection(socketio, frame_callback=None, video_path=None,crowd_threshold=15):
    # Use uploaded video if provided, else fallback to default
    if video_path:
        cap = cv.VideoCapture(video_path)
    else:
        cap = cv.VideoCapture('data/crowd_vid.mp4')

    model = YOLO('best_drone.pt')

    heatmap = None

    init_db()
    session = Session()

    # Define thresholds
    # crowd_threshold = 15
    surge_limit = 8

    frame_count = 0
    skip_rate = 3   # process every 3rd frame (adjust as needed)

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

        for result in results:
            boxes = result.boxes.xyxy.cpu().numpy()
            classes = result.boxes.cls.cpu().numpy()

            for i, c in enumerate(classes):
                if int(c) == 0:  # person
                    person_count += 1
                    x1, y1, x2, y2 = boxes[i]

                    # Use small circle at centroid instead of rectangle
                    cx = int((x1 + x2) / 2)
                    cy = int((y1 + y2) / 2)
                    cv.circle(display, (cx, cy), 6, (0, 255, 0), -1)  # green dot
                    cv.circle(heatmap, (cx, cy), 20, 255, -1)

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

        # Surge detection
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

        # Threshold alert
        if person_count > crowd_threshold:
            socketio.emit('alert_event',
                          {'type': 'crowd_threshold_exceeded', 'count': person_count})
            alert = AlertLog(type='crowd_threshold_exceeded', count=person_count)
            session.add(alert)
            session.commit()

        # Resize for display
        display_frame = cv.resize(overlayed, (800, 600))
        cv.imshow('Crowd Heatmap Video', display_frame)

        # Emit people count to frontend
        socketio.emit('crowd_update', {'count': person_count})

        if frame_callback:
            frame_callback(display_frame)

        if cv.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv.destroyAllWindows()
