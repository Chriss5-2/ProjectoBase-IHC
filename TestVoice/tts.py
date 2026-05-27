import speech_recognition as sr
import pyttsx3

# Initialize the recognizer and the TTS engine
recognizer = sr.Recognizer()
engine = pyttsx3.init()

def speak(text):
    print(f"Assistant: {text}")
    engine.say(text)
    engine.runAndWait()

def listen():
    with sr.Microphone() as source:
        print("Listening...")
        recognizer.adjust_for_ambient_noise(source) # Reduce background noise
        audio = recognizer.listen(source)
        
        try:
            # Using Google Web Speech API for transcription
            text = recognizer.recognize_google(audio)
            print(f"You said: {text}")
            return text
        except sr.UnknownValueError:
            return "Sorry, I didn't catch that."
        except sr.RequestError:
            return "Network error."

# Run the flow
spoken_text = listen()

speak(spoken_text)
