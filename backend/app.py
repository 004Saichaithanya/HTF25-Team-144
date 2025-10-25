from flask import Flask, Response, jsonify
from flask_socketio import SocketIO, emit
from detect import start_detection
from db_setup import Session, init_db, DetectionLog, AlertLog
import threading
import cv2
from flask_cors import CORS

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins='*')

video_frame = None

@socketio.on('connect')
def handle_connect():
    print('Client connected')

def run_detection():
    def frame_callback(frame):
        global video_frame
        video_frame = frame
    start_detection(socketio, frame_callback)

@app.route('/video_feed')
def video_feed():
    def generate():
        while True:
            if video_frame is not None:
                ret, buffer = cv2.imencode('.jpg', video_frame)
                frame_bytes = buffer.tobytes()
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
    return Response(generate(), mimetype='multipart/x-mixed-replace; boundary=frame')

# 📊 API: Get last 20 detections
@app.route('/api/recent_counts')
def recent_counts():
    session = Session()
    logs = session.query(DetectionLog).order_by(DetectionLog.id.desc()).limit(20).all()
    data = [
        {
            'count': log.count,
            'timestamp': log.timestamp.strftime('%H:%M:%S')
        }
        for log in reversed(logs)
    ]
    session.close()
    return jsonify(data)
  
# 🚨 API: Get last 10 alerts
@app.route('/api/recent_alerts')
def recent_alerts():
    session = Session()
    results = session.query(AlertLog).order_by(AlertLog.id.desc()).limit(10).all()
    data = [{'timestamp': r.timestamp.strftime('%H:%M:%S'), 'type': r.type, 'count': r.count} for r in results]
    return jsonify(data)

if __name__ == '__main__':
    threading.Thread(target=run_detection).start()
    socketio.run(app, host='0.0.0.0', port=5000)
