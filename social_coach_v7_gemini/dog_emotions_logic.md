# Dog Emotions Logic Documentation

## Integración de Mascota Virtual (IA de Texto) vs Puntos de Estrés

La mascota virtual es un "perrito" (`.dog` en CSS) que se sincroniza con el estado emocional de las repuestas de texto ingresadas por el usuario. Cuando el usuario envía un mensaje, Google Gemini evalúa el tono y devuelve un tag secreto con el formato `[USER_EMOTION:estado_emocional]`.

Los puntos de estrés inician en **50 / 100**, simulando un estado de activación normal, con **0** como relajación absoluta y **100** como el límite de tolerancia (Breakdown / frustración total). 

Acorde a la emoción inferida por el modelo LLM, se evalúa y cambia la actitud del perrito y se recalcula el estrés:

### Tabla de Disparadores LLM -> Perrito y Estrés

| Emoción Detectada (LLM) | Ajuste a 'Puntos de Estrés' (0-100) | Actitud Resultante del Perrito (UI) | Explicación |
| --- | --- | --- | --- |
| `angry` (Enojo) | Suma **`+20`** puntos | `fear` (Asustado) | El perrito percibe agresividad en el texto y siente miedo de las palabras del usuario. |
| `disgust` (Disgusto) | Suma **`+10`** puntos | `sad` (Triste) | El perro percibe asco/rechazo y se pone triste por la negatividad general. |
| `fear` (Miedo) | Suma **`+10`** puntos | `surprise` (Sorpresa) | El usuario expresa temor o inseguridad; el perro se pone en estado de alerta/sorprendido. |
| `sad` (Tristeza) | Suma **`+5`** puntos | `sad` (Triste) | El usuario habla con desánimo. Por "empatía", el perrito también se pone triste junto a su dueño. |
| `surprise` (Sorpresa)| Sin cambio (`0` pts) | `surprise` (Sorpresa) | Reacción natural e inocua a un evento inesperado. |
| `neutral` (Neutral) | Resta **`-5`** puntos | `neutral` (Normal) | Bajar el tono y regular la emoción descuenta pasivamente el estrés. El perrito está en su estado base. |
| `happy` (Felicidad) | Resta **`-15`** puntos | `happy` (Feliz) | La comunicación afirmativa / resolutiva tranquiliza rápidamente al sistema y el perrito responde moviendo la cola (animación `happyBounce`). |

### Condición de Límite Extremo (Breakdown)
Adicionalmente, hay un umbral condicional en caso de llegar a los extremos:
* **Estrés >= 80**: Alerta Alta. Aunque el LLM haya detectado solo algo ligero (ej. "surprise"), si el **nivel general de estrés acumulado supera el 80%**, el perrito automáticamente pasa a la expresión `sad` severa (llorando / abrumado) para indicar al usuario que está empujando los límites del sistema.
* **Estrés == 100**: Breakdown total. Después de notificar al UI, se invoca automáticamente `showView('view-pause')` en 2 segundos enviando al usuario forzadamente al modo de respiración estructurada.

### Ocultamiento en Interfaz
Para evitar distractores directos para los usuarios no competitivos/ansiosos, el puntaje base de **Estrés General** *(porcentaje numérico y barra)* puede ser oculatado haciendo clic en el icono del <i class="fas fa-eye-slash"></i>, dejando solo a la mascota canina como indicador subliminal de la tensión emocional.