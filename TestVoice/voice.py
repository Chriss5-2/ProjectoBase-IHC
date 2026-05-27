import speech_recognition as sr

# Initialize recognizer
recognizer = sr.Recognizer()

# Use the microphone as the source
with sr.Microphone() as source:
    print("Adjusting for ambient noise... please wait.")
    recognizer.adjust_for_ambient_noise(source, duration=1)
    print("Listening...")
    audio = recognizer.listen(source)

# Transcribe the audio
try:
    text = recognizer.recognize_google(audio)
    print(f"You said: {text}")
except sr.UnknownValueError:
    print("Could not understand the audio.")
except sr.RequestError:
    print("Could not request results; check your internet connection.")
