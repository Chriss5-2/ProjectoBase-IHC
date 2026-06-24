# Social Coach - Entrenador de Habilidades Sociales

## Integrantes
- Luna Jaramillo, Christian Giovanni
- Osorio Tello, Diego Jesus
- Serrano Arostegui, Edy Saul

## Sobre el Proyecto
Social Coach es una aplicación web interactiva que funciona como un simulador avanzado para el entrenamiento de habilidades sociales y regulación emocional. Mediante el uso de inteligencia artificial (API de Google Gemini), reconocimiento facial de emociones (DeepFace/OpenCV) y síntesis/reconocimiento de voz, los usuarios pueden practicar interacciones difíciles en diversos escenarios (Público, Académico, Laboral y Personal). El objetivo es ayudar a los usuarios a mejorar su empatía, asertividad y capacidad de manejar el estrés en tiempo real.

## Características
- **Simulación de Interacciones con IA**: Conversaciones en tiempo real con NPCs impulsados por Google Gemini, cada uno con personalidad y actitudes únicas (agresivo, pasivo, evasivo, etc.).
- **Análisis de Emociones en Tiempo Real**: Uso de la cámara web para detectar las emociones del usuario mediante inteligencia artificial (DeepFace y OpenCV).
- **Mascota Virtual e IA Emocional**: Un compañero virtual ("Perrito") y un modelo que reaccionan a las emociones detectadas en las conversaciones y la cámara.
- **Interacción por Voz**: Soporte para comandos de voz, Speech-to-Text (reconocimiento de voz) para hablarle a los personajes y Text-to-Speech (síntesis de voz) para escuchar sus respuestas.
- **Medidor de Estrés y Biometría**: Seguimiento del nivel de tensión y de las métricas del usuario durante la simulación.
- **Pausa Activa**: Una función para forzar un "momento de calma" con ejercicios guiados de respiración.
- **Foro Comunitario**: Un espacio para compartir experiencias, posts y comentar simulaciones con otros usuarios.
- **Seguimiento de Progreso**: Historial detallado de las emociones y el estrés a lo largo de las diferentes sesiones, almacenado localmente.
- **Tema Oscuro y Accesibilidad**: Ajustes de interfaz, de tamaño de texto y reconocimiento automático de voz.

## Herramientas
- **Editor de Código**: Visual Studio Code (o similar)
- **Control de Versiones**: Git / GitHub
- **Navegador Web**: Google Chrome, Microsoft Edge o Mozilla Firefox
- **Entorno de Ejecución**: Python, Node.js (opcional para herramientas de frontend)

## Tecnologías
- **Backend**: Python, Flask
- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3, FontAwesome
- **Inteligencia Artificial (LLM)**: Google Gemini API (`gemini-3-flash-preview`)
- **Visión Computacional**: OpenCV, DeepFace
- **Procesamiento de Audio**: SpeechRecognition, gTTS (Google Text-to-Speech), ffmpeg (mediante imageio-ffmpeg)
- **Almacenamiento de Datos**: Archivos locales CSV (`users.csv`, `progress.csv`, `forum_posts.csv`, `forum_comments.csv`, etc.)

## 📂 Estructura del Proyecto

```text
social_coach_v7_gemini/
│
├── app.py                  # Servidor backend en Flask, procesamiento de video y audio
├── index.html              # Estructura principal y UI de la aplicación web
├── styles.css              # Estilos visuales de la aplicación
├── main.js                 # Lógica de la interfaz, manejo de estado y UI
├── llm-client.js           # Cliente para la API de Google Gemini
├── data.js                 # Base de datos local de situaciones y prompts de personajes
├── dog_emotions_logic.md   # Documentación sobre la lógica de emociones de la mascota
│
├── static/                 # Archivos estáticos generados dinámicamente (audios TTS)
│
└── *.csv                   # Bases de datos ligeras (usuarios, progreso, foro, etc.)
```

## ⚙️ Configuración

### 1. Requisitos Previos
Necesitarás tener instalado en tu máquina:
- Python 3.8 o superior.
- Una cámara web funcional.
- Micrófono.

### 2. Obtener API Key de Gemini
1. Visita [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Genera una clave de API gratuita.
3. Al iniciar la aplicación web, ve a la sección de **Ajustes (API Key)** en el menú lateral e ingresa tu clave.

### 3. Crear Entorno Virtual e Instalar Dependencias
Abre una terminal en la carpeta del proyecto (`social_coach_v7_gemini`) y crea un entorno virtual (recomendado):

**En Windows:**
```bash
python -m venv venv
venv\Scripts\activate
pip install flask opencv-python deepface speechrecognition gtts imageio-ffmpeg
```

**En macOS/Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
pip install flask opencv-python deepface speechrecognition gtts imageio-ffmpeg
```

### 4. Ejecutar la Aplicación
Inicia el servidor backend desde la carpeta del proyecto:

```bash
python app.py
```
Luego, abre tu navegador web y visita: `http://localhost:5000`

## Interacción
El sistema integra interacción programática con Inteligencia Artificial de múltiples formas:

1. **System Instructions (Gemini)**: Cada NPC tiene un `prompt` detallado que define su actitud, reglas, contexto y objetivo. Además, se envían instrucciones obligatorias para que el modelo identifique la emoción del usuario en cada mensaje usando un tag interno (ej. `[USER_EMOTION:angry]`).
2. **Historial de Chat**: El cliente `LLMClient` mantiene un arreglo de historial de la conversación, proporcionando memoria contextual al modelo.
3. **Conversión de Voz a Texto (STT)**: 
   - El usuario graba su voz; el audio se guarda temporalmente, se procesa en el backend (Flask) utilizando `ffmpeg` para adaptar formatos de navegadores web y se transcribe con `speech_recognition`.
4. **Conversión de Texto a Voz (TTS)**:
   - Las respuestas generadas por los personajes o los avisos del coach se pueden escuchar al utilizar la librería `gTTS`, creando archivos de audio estáticos en tiempo real.

## Extensión del Proyecto
Ideas propuestas para extender y mejorar la aplicación:
1. **Modelos de IA Locales**: Integrar modelos LLM que se ejecuten localmente (como Llama 3) para mejorar la privacidad sin depender de APIs de terceros.
2. **Análisis de Tono de Voz**: Usar modelos acústicos para detectar la emoción basándose en la entonación del habla, en lugar de solo en las expresiones faciales y el texto.
3. **Modo Multijugador / Co-op**: Sesiones donde dos humanos interactúen en un escenario, con la IA actuando como observador y mediador en la evaluación.
4. **Soporte VR/AR**: Adaptar los escenarios para entornos de Realidad Virtual para aumentar el grado de inmersión en la simulación.
5. **Almacenamiento en la Nube**: Migrar las bases de datos (que actualmente son CSV locales) hacia un BaaS como Firebase o Supabase para persistencia web y sincronización multidispositivo.

## 📄 Licencia
Proyecto educativo y académico. Se ha tomado como base de referencia la aplicación "Constelaciones Históricas 3D" (Curso CC451 - Inteligencia Artificial / IHC), adaptándolo y escalándolo al entrenamiento moderno en habilidades sociales.
