// ============================================
// LLM Client - Comunicación con Gemini API
// Nota: Se quitó el "export" para permitir uso directo en el navegador
// ============================================

class LLMClient {
    constructor(apiKey, modelName = 'gemini-3-flash-preview') {
        this.apiKey = apiKey;
        this.modelName = modelName;
        this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
        this.conversationHistory = [];
        this.temperature = 0.7;
    }

    /**
     * Envía un mensaje al LLM con system instructions dinámicas.
     * @param {string} message - Mensaje del usuario
     * @param {string} systemPrompt - Instrucciones de sistema (personalidad del personaje)
     * @param {number} temperature - Nivel de creatividad (0-2)
     * @returns {Promise<string>} Respuesta del modelo
     */
    async chat(message, systemPrompt, temperature = null) {
        if (!this.apiKey) {
            throw new Error('API key no configurada. Configure su API key de Gemini primero.');
        }

        const url = `${this.baseUrl}/${this.modelName}:generateContent?key=${this.apiKey}`;
        const temp = temperature !== null ? temperature : this.temperature;

        const enhancedSystemPrompt = systemPrompt + "\n\nINSTRUCCIÃ“N OBLIGATORIA: Analiza el Ãºltimo mensaje del usuario para detectar su emociÃ³n. Al final exacto de tu respuesta (en tu Ãºltima lÃnea y separado por un salto de lÃnea), DEBES incluir el tag [USER_EMOTION:emocion_en_ingles] eligiendo SOLO UNA de este listado: happy, sad, angry, fear, surprise, disgust (Evita escoger 'neutral', intenta siempre asignarle una de las otras actitudes basado en si su comportamiento es positivo, negativo o cuestionable).";

        // Construir el cuerpo de la solicitud
        const requestBody = {
            systemInstruction: {
                parts: [{ text: enhancedSystemPrompt }]
            },
            contents: [
                ...this.conversationHistory,
                {
                    role: 'user',
                    parts: [{ text: message }]
                }
            ],
            generationConfig: {
                temperature: temp,
                maxOutputTokens: 1024,
                topP: 0.9,
                topK: 40
            }
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(
                    `Error API (${response.status}): ${errorData.error?.message || response.statusText}`
                );
            }

            const data = await response.json();

            // Validar estructura de respuesta
            if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
                throw new Error('Respuesta inesperada de la API');
            }

            const reply = data.candidates[0].content.parts[0].text;

            // Guardar en el historial para mantener contexto
            this.conversationHistory.push(
                { role: 'user', parts: [{ text: message }] },
                { role: 'model', parts: [{ text: reply }] }
            );

            // Limitar historial a últimos 20 mensajes (10 pares) para no exceder tokens
            if (this.conversationHistory.length > 20) {
                this.conversationHistory = this.conversationHistory.slice(-20);
            }

            return reply;

        } catch (error) {
            console.error('Error en LLMClient.chat:', error);
            
            // Manejo de errores específicos
            if (error.message.includes('API_KEY_INVALID') || error.message.includes('API key not valid')) {
                throw new Error('API key inválida. Verifique su clave de Gemini en Ajustes.');
            } else if (error.message.includes('429')) {
                throw new Error('Límite de peticiones excedido. Espere un momento.');
            } else if (error.message.includes('fetch')) {
                throw new Error('Error de conexión. Verifique su conexión a internet.');
            }
            
            throw error;
        }
    }

    /**
     * Limpia el historial de conversación.
     * Útil al cambiar de personaje.
     */
    clearHistory() {
        this.conversationHistory = [];
    }

    /**
     * Configura el nivel de creatividad de las respuestas.
     * @param {number} value - 0 a 2, donde 0 es determinista y 2 es muy creativo
     */
    setTemperature(value) {
        this.temperature = Math.max(0, Math.min(2, value));
    }
}
