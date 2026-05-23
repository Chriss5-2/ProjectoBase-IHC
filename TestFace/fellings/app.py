from flask import Flask, send_from_directory, Response, jsonify
import cv2
from deepface import DeepFace
import threading
import time

app = Flask(__name__, static_folder='.')

camera = None
current_emotion = "neutral"
current_face_coords = {"x": 50, "y": 50}  # Centro de la pantalla por defecto (en porcentaje)
latest_frame = None
camera_active = False

def emotion_worker():
    """Hilo en segundo plano para analizar la emoción sin pausar el video."""
    global current_emotion, latest_frame, camera_active
    while True:
        if camera_active and latest_frame is not None:
            try:
                frame_to_analyze = latest_frame.copy()
                result = DeepFace.analyze(frame_to_analyze, actions=['emotion'], enforce_detection=False)
                current_emotion = result[0]['dominant_emotion']
            except Exception as e:
                pass
        time.sleep(0.5) # Procesamos emoción 2 veces por segundo

# Iniciamos el hilo de análisis
threading.Thread(target=emotion_worker, daemon=True).start()

def gen_frames():
    """Generador de frames de video para la cámara."""
    global latest_frame, camera, camera_active, current_emotion, current_face_coords
    
    if camera is None:
        camera = cv2.VideoCapture(0)
    
    camera_active = True
    
    # Cargamos el detector de caras ultrarrápido de OpenCV
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    
    while True:
        if not camera_active:
            break
            
        success, frame = camera.read()
        if not success:
            break
        else:
            frame = cv2.flip(frame, 1) # Modo espejo
            latest_frame = frame
            
            # --- SEGUIMIENTO DE CABEZA SÚPER RÁPIDO ---
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            faces = face_cascade.detectMultiScale(gray, 1.1, 4)
            
            height, width, _ = frame.shape
            
            if len(faces) > 0:
                # Tomamos la cara más grande (la de primer plano)
                faces = sorted(faces, key=lambda f: f[2]*f[3], reverse=True)
                (x, y, w, h) = faces[0]
                
                # Centro de esa cara
                face_center_x = x + (w // 2)
                face_center_y = y + (h // 2)
                
                # Convertimos a porcentajes (0 a 100)
                percent_x = (face_center_x / width) * 100
                percent_y = (face_center_y / height) * 100
                
                current_face_coords = {"x": percent_x, "y": percent_y}
                
                # Dibujamos un mini rectángulo para que veas dónde te detecta
                cv2.rectangle(frame, (x, y), (x+w, y+h), (0, 255, 0), 2)
            
            # Escribir la emoción actual en la pantalla del video
            display_frame = frame.copy()
            cv2.putText(display_frame, f"Emotion: {current_emotion.upper()}", (30, 50), 
                        cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 255), 2, cv2.LINE_AA)
            
            ret, buffer = cv2.imencode('.jpg', display_frame)
            frame_bytes = buffer.tobytes()
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
                   
    # Al salir del bucle (cámara desactivada), liberamos el recurso
    if camera is not None:
        camera.release()
        camera = None

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/styles.css')
def styles():
    return send_from_directory('.', 'styles.css')

@app.route('/video_feed')
def video_feed():
    return Response(gen_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/get_state')
def api_state():
    # Devolvemos ambas: la emoción y la posición de tu cabeza
    return jsonify({
        "emotion": current_emotion,
        "coords": current_face_coords
    })

@app.route('/stop_camera')
def stop_camera():
    global camera_active
    camera_active = False # Esto rompe el bucle en gen_frames y apaga la luz de la cámara
    return jsonify({"status": "stopped"})

if __name__ == '__main__':
    app.run(debug=True, port=5000, threaded=True)
