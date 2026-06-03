from flask import Flask, send_from_directory, Response, jsonify, request
import cv2
from deepface import DeepFace
import threading
import time
import csv
import os
from datetime import datetime
#----
import speech_recognition as sr
from gtts import gTTS
import uuid

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

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('.', path)

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

PROGRESS_FILE = 'progress.csv'

@app.route('/save_progress', methods=['POST'])
def save_progress():
    data = request.json
    file_exists = os.path.isfile(PROGRESS_FILE)
    
    with open(PROGRESS_FILE, mode='a', newline='', encoding='utf-8-sig') as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow(['Fecha_Hora', 'Emocion_Chat', 'Emocion_Camara', 'Emocion_Mascota', 'Stress'])
        writer.writerow([
            datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            data.get('chat_emotion', 'neutral'),
            data.get('camera_emotion', 'neutral'),
            data.get('pet_emotion', 'neutral'),
            data.get('stress', '50')
        ])
    return jsonify({"status": "success"})

@app.route('/get_progress')
def get_progress():
    if not os.path.isfile(PROGRESS_FILE):
        return jsonify([])
    results = []
    with open(PROGRESS_FILE, mode='r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            results.append(row)
    return jsonify(results)

# Rutas para TTS y STT usando gTTS y SpeechRecognition
@app.route('/api/stt', methods=['POST'])
def speech_to_text():
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    audio_file = request.files['audio']
    recognizer = sr.Recognizer()
    
    # Manejo de WebM (navegadores) hacia WAV usando imageio-ffmpeg
    try:
        import imageio_ffmpeg
        import subprocess
        import tempfile
        
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        
        # Guardar archivo temporal webm
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as temp_webm:
            audio_file.save(temp_webm.name)
            webm_path = temp_webm.name
            
        # Archivo temporal wav de salida
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_wav:
            wav_path = temp_wav.name

        # Ejecutar ffmpeg para convertir webm a wav
        # -y para sobreescribir si es necesario, -i archivo de entrada, y luego el archivo de salida
        subprocess.run([ffmpeg_exe, '-y', '-i', webm_path, wav_path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        # Leer el WAV generado con SpeechRecognition
        import io
        with open(wav_path, "rb") as f:
            wav_data = f.read()
            
        source_audio = io.BytesIO(wav_data)
        
        # Limpiar temporales
        try:
            os.remove(webm_path)
            os.remove(wav_path)
        except:
            pass

    except Exception as e:
        print(f"Error procesando audio: {e}")
        # Intentar en crudo si falló lo anterior
        source_audio = audio_file
        source_audio.seek(0)

    try:
        with sr.AudioFile(source_audio) as source:
            audio_data = recognizer.record(source)
            text = recognizer.recognize_google(audio_data, language='es-ES')
            return jsonify({"text": text})
    except ValueError as ve:
        return jsonify({"error": "Formato de audio no soportado. Instala pydub y ffmpeg para procesar WebM/Opus."}), 400
    except sr.UnknownValueError:
        return jsonify({"error": "No se pudo entender el audio"}), 400
    except sr.RequestError as e:
        return jsonify({"error": f"No se pudieron obtener los resultados; {e}"}), 500
        
@app.route('/api/tts', methods=['POST'])
def text_to_speech():
    data = request.json
    text = data.get('text', '')
    
    # Asegúrate de tener una carpeta /static
    os.makedirs("static", exist_ok=True)
    
    # Borrar archivos TTS anteriores antes de crear uno nuevo
    for f in os.listdir("static"):
        if f.startswith("response_") and f.endswith(".mp3"):
            try:
                os.remove(os.path.join("static", f))
            except:
                pass

    # Generar un nombre de archivo único
    filename = f"response_{uuid.uuid4().hex}.mp3"
    filepath = os.path.join("static", filename) 
    
    # Convertir texto a voz con gTTS
    tts = gTTS(text=text, lang='es', tld='com.mx') # Español de México (puedes cambiarlo)
    tts.save(filepath)
    
    # Devolver la URL del audio al frontend
    return jsonify({"audio_url": f"/static/{filename}"})

if __name__ == '__main__':
    app.run(debug=True, port=5000, threaded=True)
