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

USERS_FILE = 'users.csv'

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()
    
    if not username or not password:
        return jsonify({"status": "error", "message": "Usuario y contraseña son requeridos."}), 400
        
    file_exists = os.path.isfile(USERS_FILE)
    
    # Check if user exists
    if file_exists:
        with open(USERS_FILE, mode='r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get('username') == username:
                    return jsonify({"status": "error", "message": "El usuario ya existe."}), 400
                    
    # Save the new user
    with open(USERS_FILE, mode='a', newline='', encoding='utf-8-sig') as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow(['username', 'password'])
        writer.writerow([username, password])
        
    return jsonify({"status": "success", "message": "Usuario registrado exitosamente."})

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()
    
    if not username or not password:
        return jsonify({"status": "error", "message": "Usuario y contraseña son requeridos."}), 400
        
    if not os.path.isfile(USERS_FILE):
        return jsonify({"status": "error", "message": "Usuario no encontrado."}), 404
        
    with open(USERS_FILE, mode='r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get('username') == username:
                if row.get('password') == password:
                    return jsonify({"status": "success", "message": "Ingreso exitoso."})
                else:
                    return jsonify({"status": "error", "message": "Contraseña incorrecta."}), 401
                    
    return jsonify({"status": "error", "message": "Usuario no encontrado."}), 404

DELETED_ACCOUNTS_FILE = 'cuentas_eliminadas.csv'

@app.route('/api/delete-account', methods=['POST'])
def delete_account():
    data = request.json
    username = data.get('username', '').strip()
    
    if not username:
        return jsonify({"status": "error", "message": "Usuario requerido."}), 400
    
    if not os.path.isfile(USERS_FILE):
        return jsonify({"status": "error", "message": "Usuario no encontrado."}), 404
    
    # Buscar la contraseña del usuario a eliminar
    user_password = None
    users_data = []
    
    with open(USERS_FILE, mode='r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get('username') == username:
                user_password = row.get('password')
            else:
                users_data.append(row)
    
    if user_password is None:
        return jsonify({"status": "error", "message": "Usuario no encontrado."}), 404
    
    # Guardar en cuentas_eliminadas.csv
    file_exists = os.path.isfile(DELETED_ACCOUNTS_FILE)
    with open(DELETED_ACCOUNTS_FILE, mode='a', newline='', encoding='utf-8-sig') as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow(['username', 'password', 'fecha_eliminacion'])
        writer.writerow([username, user_password, datetime.now().strftime("%Y-%m-%d %H:%M:%S")])
    
    # Reescribir users.csv sin el usuario eliminado
    with open(USERS_FILE, mode='w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=['username', 'password'])
        writer.writeheader()
        for row in users_data:
            writer.writerow(row)
    
    return jsonify({"status": "success", "message": "Cuenta eliminada exitosamente."})

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

FORUM_POSTS_FILE = 'forum_posts.csv'
FORUM_COMMENTS_FILE = 'forum_comments.csv'

@app.route('/api/forum', methods=['GET'])
def get_forum_posts():
    comment_counts = {}
    if os.path.isfile(FORUM_COMMENTS_FILE):
        with open(FORUM_COMMENTS_FILE, mode='r', encoding='utf-8-sig') as f:
            for row in csv.DictReader(f):
                pid = row.get('post_id', '')
                comment_counts[pid] = comment_counts.get(pid, 0) + 1

    if not os.path.isfile(FORUM_POSTS_FILE):
        return jsonify([])

    posts = []
    with open(FORUM_POSTS_FILE, mode='r', encoding='utf-8-sig') as f:
        for row in csv.DictReader(f):
            row['comentarios'] = comment_counts.get(row.get('id', ''), 0)
            posts.append(row)

    return jsonify(list(reversed(posts)))

@app.route('/api/forum', methods=['POST'])
def create_forum_post():
    data = request.json
    username = data.get('username', '').strip()
    titulo = data.get('titulo', '').strip()
    contenido = data.get('contenido', '').strip()

    if not username or not titulo or not contenido:
        return jsonify({"status": "error", "message": "Todos los campos son requeridos."}), 400

    post_id = str(uuid.uuid4())[:8]
    fecha = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    file_exists = os.path.isfile(FORUM_POSTS_FILE)
    with open(FORUM_POSTS_FILE, mode='a', newline='', encoding='utf-8-sig') as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow(['id', 'username', 'titulo', 'contenido', 'fecha'])
        writer.writerow([post_id, username, titulo, contenido, fecha])

    return jsonify({"status": "success", "id": post_id})

@app.route('/api/forum/<post_id>/comments', methods=['GET'])
def get_comments(post_id):
    if not os.path.isfile(FORUM_COMMENTS_FILE):
        return jsonify([])

    comments = []
    with open(FORUM_COMMENTS_FILE, mode='r', encoding='utf-8-sig') as f:
        for row in csv.DictReader(f):
            if row.get('post_id') == post_id:
                comments.append(row)

    return jsonify(comments)

@app.route('/api/forum/<post_id>/comments', methods=['POST'])
def add_comment(post_id):
    data = request.json
    username = data.get('username', '').strip()
    comentario = data.get('comentario', '').strip()

    if not username or not comentario:
        return jsonify({"status": "error", "message": "Todos los campos son requeridos."}), 400

    comment_id = str(uuid.uuid4())[:8]
    fecha = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    file_exists = os.path.isfile(FORUM_COMMENTS_FILE)
    with open(FORUM_COMMENTS_FILE, mode='a', newline='', encoding='utf-8-sig') as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow(['id', 'post_id', 'username', 'comentario', 'fecha'])
        writer.writerow([comment_id, post_id, username, comentario, fecha])

    return jsonify({"status": "success", "id": comment_id})

if __name__ == '__main__':
    app.run(debug=True, port=5000, threaded=True)
