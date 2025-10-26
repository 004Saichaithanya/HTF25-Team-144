from flask import Flask, Response, jsonify, send_from_directory, request
from flask_socketio import SocketIO
from detect import start_detection, set_crowd_threshold, set_surge_limit
from db_setup import Session, DetectionLog, AlertLog, init_db
import threading
import cv2
import numpy as np
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})
socketio = SocketIO(app, 
                   cors_allowed_origins='*',
                   async_mode='threading',
                   logger=True,
                   engineio_logger=True)

video_frame = None
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@socketio.on('connect')
def handle_connect():
    print(f'Client connected! SID: {request.sid}')

@socketio.on('disconnect')
def handle_disconnect():
    print(f'Client disconnected! SID: {request.sid}')

@socketio.on_error()
def handle_error(e):
    print(f'SocketIO Error: {str(e)}')

detection_active = False

def run_detection():
    def frame_callback(frame):
        global video_frame
        video_frame = frame
    # Don't start detection automatically
    pass  # We'll only start detection when a video is uploaded

@app.route('/video_feed')
def video_feed():
    def generate():
        while True:
            if video_frame is not None:
                ret, buffer = cv2.imencode('.jpg', video_frame)
                if not ret:
                    continue
                frame_bytes = buffer.tobytes()
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
            else:
                # Return a placeholder frame when no video is active
                placeholder = cv2.imread('placeholder.jpg') if os.path.exists('placeholder.jpg') else \
                    np.zeros((480, 640, 3), dtype=np.uint8)
                ret, buffer = cv2.imencode('.jpg', placeholder)
                frame_bytes = buffer.tobytes()
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
    return Response(generate(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.post("/upload_media")
def upload_media():
    global video_frame
    file = request.files.get('file')
    if not file:
        return jsonify({"error": "No file provided"}), 400
        
    # Clear previous state
    video_frame = None
    clear_db()
    
    filename = file.filename
    path = os.path.join(UPLOAD_DIR, filename)
    file.save(path)
    
    # Start new detection with frame callback
    def frame_callback(frame):
        global video_frame
        video_frame = frame
    
    # Start detection and show an OpenCV window for local debugging
    threading.Thread(target=start_detection, args=(socketio, frame_callback, path, True), daemon=True).start()
    return jsonify({"message": "Video uploaded and detection started.", "filename": filename})

@app.route('/uploads/<path:filename>')
def serve_uploaded_file(filename):
    return send_from_directory(UPLOAD_DIR, filename)

@app.route('/api/recent_counts')
def recent_counts():
    if not video_frame:  # If no video is active
        return jsonify([])
    
    session = Session()
    logs = session.query(DetectionLog).order_by(DetectionLog.id.desc()).limit(20).all()
    data = [{'count': log.count, 'timestamp': log.timestamp.strftime('%H:%M:%S')} for log in reversed(logs)]
    print(f"Recent counts: {data}")
    session.close()
    return jsonify(data)

@app.route('/api/recent_alerts')
def recent_alerts():
    try:
        print("Fetching recent alerts...")
        session = Session()
        # Get alerts from the last 5 minutes
        from datetime import datetime, timedelta
        five_minutes_ago = datetime.now() - timedelta(minutes=5)

        try:
            results = session.query(AlertLog)\
                .filter(AlertLog.timestamp >= five_minutes_ago)\
                .order_by(AlertLog.timestamp.desc())\
                .limit(5)\
                .all()
        except Exception as qerr:
            print(f"Query error in recent_alerts: {qerr}")
            results = []

        data = [
            {
                'timestamp': r.timestamp.isoformat() if r.timestamp else None,
                'type': r.type,
                'count': r.count
            }
            for r in results
        ]
        print(f"Recent alerts: {data}")
        session.close()
        return jsonify(data)
    except Exception as e:
        print(f"Error in recent_alerts: {e}")
        return jsonify([])


@app.post('/api/set_threshold')
def api_set_threshold():
    """Endpoint to set the crowd threshold at runtime (JSON: { "threshold": 25 })."""
    try:
        body = request.get_json(force=True)
        if not body or 'threshold' not in body:
            return jsonify({'error': 'threshold field required'}), 400
        t = int(body['threshold'])
        set_crowd_threshold(t)
        # Optionally accept surge_limit
        if 'surge_limit' in body:
            try:
                s = int(body['surge_limit'])
                set_surge_limit(s)
            except Exception:
                pass
        return jsonify({'message': 'threshold updated', 'threshold': t})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def clear_db():
    """Clear all detection and alert logs"""
    session = Session()
    session.query(DetectionLog).delete()
    session.query(AlertLog).delete()
    session.commit()
    session.close()

if __name__ == '__main__':
    print("Starting CSIS backend server...")
    # Ensure database tables exist
    try:
        init_db()
        print("Database initialized")
    except Exception as e:
        print(f"init_db failed: {e}")
    # Clear any old data
    clear_db()
    print("Database cleared")
    print("Starting SocketIO server on port 5000...")
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, use_reloader=False)
