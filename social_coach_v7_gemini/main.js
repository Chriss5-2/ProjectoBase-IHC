// =========================================================================
  // LOGICA PRINCIPAL DE LA APLICACIí“N Y CONEXIí“N CON EL LLM
  // =========================================================================

  let currentSituation = null;
  let currentCharacter = null;
  let currentStress = 50; // Puntos de estrés de 0 a 100
  let isStressHidden = false; // Estado de la visibilidad de estrés
  
  // Instanciar el cliente LLM global
  const llmClient = new LLMClient('');
  let lastCoachFeedback = ""; // Almacena el feedback texto-plano para TTS
  let lastChatEmotionDetected = 'neutral';
  let lastCamEmotionDetected = 'neutral';
  
  function updateGlobalScore() { fetch('/get_progress').then(res => res.json()).then(data => { let scoreLabel = document.getElementById('global-score'); if (!scoreLabel) return; if (!data || data.length === 0) { scoreLabel.innerText = '50 Pts'; return; } let total = 0; data.forEach(row => { total += parseInt(row.Stress) || 50; }); let avg = Math.round(total / data.length); scoreLabel.innerText = avg + ' Pts'; }).catch(e=>console.log(e)); }

  // Al cargar la página, verificar sesión y recuperar la API key si existe
  document.addEventListener("DOMContentLoaded", () => {
      currentUser = localStorage.getItem('currentUser');
      
      if (!currentUser) {
          // No hay usuario, mostrar login
          document.getElementById('sidebar-nav').style.display = 'none';
          document.getElementById('main-header').style.display = 'none';
          showAuthView('view-login');
          return;
      }
      
      // Hay usuario, continuar con inicialización normal
      document.getElementById('sidebar-nav').style.display = 'flex';
      document.getElementById('main-header').style.display = 'flex';
      
      const savedKey = localStorage.getItem('gemini_api_key');
      if (savedKey) {
          document.getElementById('api-key-input').value = savedKey;
          llmClient.apiKey = savedKey;
      }
      const savedVoiceMode = localStorage.getItem('voice_mode_enabled');
      if (savedVoiceMode !== null) {
          voiceModeEnabled = savedVoiceMode === 'true';
      }
      updateVoiceBtnUI();
      
      updateUserDisplay(); // Mostrar saludo con el nombre del usuario
      renderSituations();
      updateGlobalScore(); // <--- Llamar al promedio del puntaje global al iniciar
      showView('view-home');
  });

  // Guardar API Key desde Ajustes
  function saveApiKey() {
      const key = document.getElementById('api-key-input').value.trim();
      if(key) {
          localStorage.setItem('gemini_api_key', key);
          llmClient.apiKey = key;
          const statusEl = document.getElementById('api-key-status');
          statusEl.innerText = "¡Clave guardada exitosamente!";
          statusEl.style.color = "var(--green-dark)";
          setTimeout(() => statusEl.innerText = "", 3000);
      }
  }

  // Renderizar Situaciones
  function renderSituations() {
      const container = document.getElementById('situations-container');
      container.innerHTML = ''; 
      appData.situaciones.forEach(sit => {
          container.innerHTML += `
            <div class="card destination-card hoverable" onclick="selectSituation('${sit.id}')" style="border-left: 6px solid ${sit.color};">
              <div style="display: flex; gap: 20px; align-items: center; margin-bottom: 20px;">
                  <div class="card-icon" style="background-color: ${sit.color}20; color: ${sit.color}; width: 80px; height: 80px; font-size: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <i class="fas ${sit.icono}"></i>
                  </div>
                  <div>
                      <h2 style="font-size: 22px; color: #1f2937; margin-bottom: 8px;">${sit.titulo}</h2>
                      <p class="card-desc" style="margin:0; font-size: 14px; line-height: 1.5; color: #64748b;">${sit.resumen}</p>
                  </div>
              </div>
              <button class="btn" style="width: 100%; background: #f1f5f9; color: var(--primary); font-weight: bold; border: 1px solid #cbd5e1;">Ver Escenarios <i class="fas fa-chevron-right" style="margin-left: 8px;"></i></button>
            </div>
          `;
      });
  }

  // Seleccionar Situación
  function selectSituation(sitId) {
      currentSituation = appData.situaciones.find(s => s.id === sitId);
      document.getElementById('sit-title-display').innerText = currentSituation.titulo;
      
      const container = document.getElementById('characters-container');
      container.innerHTML = '';

      currentSituation.personajes.forEach(char => {
          let diffColor = '#cbd5e1'; let diffText = '#333';
          if(char.dificultad === 'Intermedio') { diffColor = '#fef08a'; diffText = '#854d0e'; }
          if(char.dificultad === 'Avanzado') { diffColor = '#fecaca'; diffText = '#991b1b'; }

          container.innerHTML += `
            <div class="card hoverable" onclick="selectCharacter('${char.id}')" style="display: flex; flex-direction: column; height: 100%;">
                <div style="margin-bottom: 16px;"><span style="background: ${diffColor}; color: ${diffText}; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold;">${char.dificultad}</span></div>
                <div style="text-align: center; margin-bottom: 16px;">
                    <div style="width: 64px; height: 64px; background: var(--primary); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 28px; margin: 0 auto 12px;">
                        <i class="fas ${char.icono}"></i>
                    </div>
                      <h3 class="char-name" style="font-size: 18px; color: #1e293b; margin-bottom: 4px;">${char.nombre}</h3>
                    <p style="font-size: 13px; color: #b91c1c; font-style: italic;">"${char.actitud}"</p>
                </div>
                <div style="margin-top: auto;"><button class="btn btn-primary" style="width: 100%; font-size: 14px;">Seleccionar</button></div>
            </div>
          `;
      });
      showView('view-characters');
  }

  // Seleccionar Personaje
  function selectCharacter(charId) {
      currentCharacter = currentSituation.personajes.find(c => c.id === charId);
      document.getElementById('prep-title').innerText = currentCharacter.nombre;
      document.getElementById('prep-dificultad').innerText = "Dificultad: " + currentCharacter.dificultad;
      document.getElementById('prep-actitud').innerText = "Actitud: " + currentCharacter.actitud;
      document.getElementById('prep-icon-dynamic').className = "fas " + currentCharacter.icono;

      const match = currentCharacter.prompt.match(/OBJETIVO:(.*)/);
      document.getElementById('prep-objective').innerText = match ? match[1].trim() : "Manejar la situación asertivamente.";
      showView('view-prep');
  }

  // =========================================================================
  // LOGICA DE CHAT CON GEMINI
  // =========================================================================
  
  function startSimulation() {
      if(!currentCharacter) return;

      // Verificar API Key antes de entrar
      if(!llmClient.apiKey) {
          alert("¡Alto! Para interactuar con los personajes necesitas configurar tu API Key de Gemini en los Ajustes.");
          showView('view-settings');
          return;
      }

      document.getElementById('sim-title-bar').innerText = currentCharacter.nombre;
      document.getElementById('sim-npc-name').innerText = currentCharacter.nombre;
      document.getElementById('sim-npc-attitude').innerText = "Actitud: " + currentCharacter.actitud;
      document.getElementById('sim-icon-dynamic').className = "fas " + currentCharacter.icono;
      
      // Limpiar historial previo del LLM y de la UI
      llmClient.clearHistory();
      document.getElementById('chat-history').innerHTML = '';
      document.getElementById('chat-input-text').value = '';
      
      // Reset Biometrí­a (Estrés) y UI de la Mascota
      currentStress = 50;
      lastChatEmotionDetected = 'neutral';
      lastCamEmotionDetected = 'neutral';
      updateStressUI();
      document.getElementById('dog').setAttribute('data-emotion', 'neutral');
      document.getElementById('dog-statusText').innerText = 'neutral';

      showView('view-sim');

      // Generar primera frase pidiéndole a Gemini que inicie la conversación
      appendMessage('system', "Iniciando conexión neural con el NPC...");
      
      // Mandamos un trigger oculto al LLM para que tire la primera lí­nea respetando su prompt
      llmClient.chat("El usuario acaba de llegar. Tira tu lí­nea de diálogo inicial para empezar el conflicto según tus reglas. No saludes si eres agresivo.", currentCharacter.prompt)
        .then(reply => {
            document.getElementById('chat-history').innerHTML = ''; // Limpiar mensaje de sistema
            
            // Si mandó el token de emoción por accidente en la primera interacción, filtrarlo
            const emotionMatch = reply.match(/\[USER_EMOTION:\s*([a-zA-Z]+)\]/i);
            if (emotionMatch) {
                reply = reply.replace(/\[USER_EMOTION:.*?\]/gi, '').trim();
            }

            appendMessage('npc', reply);
            playNPCVoice(reply); // Hablar inicial
        })
        .catch(err => {
            document.getElementById('chat-history').innerHTML = '';
            appendMessage('system', "Error de conexión: " + err.message);
        });
  }

  // Enviar mensaje del usuario a Gemini
  async function sendChatMessage() {
      if (isSending) return;
      const inputEl = document.getElementById('chat-input-text');
      const text = inputEl.value.trim();
      if(!text) return;

      isSending = true;

      // Añadir al UI
      appendMessage('user', text);
      inputEl.value = '';

      // Indicador de escribiendo
      const typingInd = document.getElementById('typing-indicator');
      typingInd.style.display = 'block';

      try {
          let reply = await llmClient.chat(text, currentCharacter.prompt);
          
          // Extraer la emoción detectada por el LLM
          const emotionMatch = reply.match(/\[USER_EMOTION:\s*([a-zA-Z]+)\]/i);
          if (emotionMatch) {
              const detectedEmotion = emotionMatch[1].toLowerCase();
              const validEmotions = ['neutral', 'happy', 'sad', 'angry', 'fear', 'surprise', 'disgust'];
              if(validEmotions.includes(detectedEmotion)) {
                  lastChatEmotionDetected = detectedEmotion;
                  let pointsChange = 0;
                  let dogEmotion = 'neutral';
                  
                  // Lógica de mapeo de Emoción a Estrés y Dog Emotion
                  switch(detectedEmotion) {
                      case 'angry': pointsChange = 20; dogEmotion = 'fear'; break;
                      case 'happy': pointsChange = -15; dogEmotion = 'happy'; break;
                      case 'sad': pointsChange = 5; dogEmotion = 'sad'; break;
                      case 'fear': pointsChange = 10; dogEmotion = 'surprise'; break;
                      case 'disgust': pointsChange = 10; dogEmotion = 'sad'; break;
                      case 'neutral': pointsChange = -5; dogEmotion = 'neutral'; break;
                      case 'surprise': pointsChange = 0; dogEmotion = 'surprise'; break;
                  }
                  
                  // Actualizar puntos
                  currentStress += pointsChange;
                  if (currentStress > 100) currentStress = 100;
                  if (currentStress < 0) currentStress = 0;
                  
                  // Si el estrés es muy alto, domina el estado de la mascota a asustado/llorando
                  if (currentStress >= 80) {
                      dogEmotion = 'sad'; // Llorando de miedo/estrés
                  }
                  
                  document.getElementById('dog').setAttribute('data-emotion', dogEmotion);
                  document.getElementById('dog-statusText').innerText = dogEmotion;
                  
                  updateStressUI();
                  
                  if (currentStress >= 100) {
                      setTimeout(() => showView('view-pause'), 2000);
                  }
              }
              // Limpiar la respuesta para que el usuario no vea el tag
              reply = reply.replace(/\[USER_EMOTION:.*?\]/gi, '').trim();
          }

          typingInd.style.display = 'none';
          appendMessage('npc', reply);
          playNPCVoice(reply); // Hacer que hable también al escribir en el chat
      } catch (err) {
          typingInd.style.display = 'none';
          appendMessage('system', "Error: " + err.message);
      } finally {
          isSending = false;
      }
  }

  // Añadir globos de chat al HTML
  function appendMessage(sender, text) {
      const chatHistory = document.getElementById('chat-history');
      const div = document.createElement('div');
      
      if(sender === 'user') {
          div.className = 'user-message';
          div.style.alignSelf = 'flex-end';
          div.style.background = 'var(--primary)';
          div.style.color = 'white';
          div.style.padding = '14px 18px';
          div.style.borderRadius = '16px';
          div.style.borderTopRightRadius = '4px';
          div.style.maxWidth = '85%';
          div.innerHTML = `<p style="font-size: 16px; margin:0;">${text}</p>`;
      } else if(sender === 'npc') {
          div.className = 'bot-message';
          div.style.alignSelf = 'flex-start';
          div.style.background = '#f1f5f9';
          div.style.color = '#1e293b';
          div.style.padding = '14px 18px';
          div.style.borderRadius = '16px';
          div.style.borderTopLeftRadius = '4px';
          div.style.maxWidth = '85%';
          div.innerHTML = `<p style="font-size: 18px; font-weight: 500; line-height: 1.5; margin:0;">"${text}"</p>`;
      } else {
          // System error/loading message
          div.style.alignSelf = 'center';
          div.style.background = 'transparent';
          div.style.color = '#64748b';
          div.style.fontStyle = 'italic';
          div.style.fontSize = '12px';
          div.innerHTML = text;
      }
      
      chatHistory.appendChild(div);
      // Auto-scroll al fondo
      chatHistory.scrollTop = chatHistory.scrollHeight;
  }

  // =========================================================================
  // BOTONES DE CONTROL (Stress y Resultados)
  // =========================================================================
  
  // =========================================================================
  // STT / TTS - INTERFAZ DE VOZ
  // =========================================================================
  let mediaRecorder;
  let audioChunks = [];
  let isSending = false;

  let voiceModeEnabled = true;

  function toggleVoiceMode() {
      voiceModeEnabled = !voiceModeEnabled;
      localStorage.setItem('voice_mode_enabled', voiceModeEnabled);
      updateVoiceBtnUI();
      if (!voiceModeEnabled && menuAudioContext) {
          menuAudioContext.pause();
          menuAudioContext = null;
      }
  }

  function updateVoiceBtnUI() {
      const btn = document.getElementById('toggle-voice-btn');
      if (!btn) return;
      if (voiceModeEnabled) {
          btn.innerHTML = '<i class="fas fa-volume-up"></i> Activado';
          btn.style.background = 'var(--primary)';
          btn.style.color = 'white';
      } else {
          btn.innerHTML = '<i class="fas fa-volume-mute"></i> Silenciado';
          btn.style.background = '#e2e8f0';
          btn.style.color = '#333';
      }
  }

  // 0. Helper para reproducir voz del NPC filtrando texto de rol
  function playNPCVoice(text) {
      if (!voiceModeEnabled) return;

      if (currentTTSAbortController) currentTTSAbortController.abort();
      if (currentNPCAudio) { currentNPCAudio.pause(); currentNPCAudio = null; }

      const cleanText = text.replace(/\*([^\*]+)\*/g, '').trim();
      if (!cleanText) return;

      currentTTSAbortController = new AbortController();

      fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: cleanText }),
          signal: currentTTSAbortController.signal
      })
      .then(res => res.json())
      .then(ttsData => {
          if(ttsData.audio_url) {
              currentNPCAudio = new Audio(ttsData.audio_url + '?t=' + new Date().getTime());
              currentNPCAudio.play();
          }
      })
      .catch(err => {
          if (err.name !== 'AbortError') console.error("Error TTS:", err);
      });
  }

  // 1. Iniciar grabación al presionar el micrófono
  async function startRecording() {
      if (!voiceModeEnabled) return;
      if (mediaRecorder && mediaRecorder.state === 'recording') return;
      // Mostrar indicador de grabación
      document.getElementById('recording-indicator').style.display = 'block';
      document.getElementById('record-btn').style.transform = 'scale(1.1)';
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorder.ondataavailable = event => {
          audioChunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
          // Ocultar indicador
          document.getElementById('recording-indicator').style.display = 'none';
          document.getElementById('record-btn').style.transform = 'scale(1)';

          // Cuando el usuario suelta el botón, creamos el archivo de audio
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' }); // Modificado a type audio/webm que es lo que graba el navegador por defecto
          audioChunks = [];
          
          // Enviar a Python para STT
          processVoiceInput(audioBlob);
          
          // Aseguramos soltar la camara/micro del mediarecord si ya grabó
          stream.getTracks().forEach(track => track.stop());
      };

      audioChunks = [];
      mediaRecorder.start();
  }

  function stopRecording() {
      if(mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  }

  // =========================================================================
  // NAVEGACIÓN Y MENÚS POR VOZ (HUB Y PERSONAJES)
  // =========================================================================
  
  let menuAudioContext = null;
  let currentNPCAudio = null;
  let currentTTSAbortController = null;
  let menuCurrentMode = null;
  let forumVoiceStep = null; // null | 'waiting_title' | 'waiting_content' | 'waiting_confirm'

  async function startMenuRecording(mode) {
      if (!voiceModeEnabled) return;
      menuCurrentMode = mode;
      let btnPrefix = 'menu-sit';
      if (mode === 'characters') btnPrefix = 'menu-char';
      else if (mode === 'prep') btnPrefix = 'menu-prep';
      else if (mode === 'sim') btnPrefix = 'menu-sim';
      else if (mode === 'pause') btnPrefix = 'menu-pause';
      else if (mode === 'settings') btnPrefix = 'menu-settings';
      else if (mode === 'meter') btnPrefix = 'menu-meter';
      else if (mode === 'forum') btnPrefix = 'menu-forum';
      
      document.getElementById(`${btnPrefix}-indicator`).style.display = 'block';
      document.getElementById(`${btnPrefix}-record-btn`).style.transform = 'scale(1.1)';
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorder.ondataavailable = event => {
          audioChunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
          document.getElementById(`${btnPrefix}-indicator`).style.display = 'none';
          document.getElementById(`${btnPrefix}-record-btn`).style.transform = 'scale(1)';

          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          audioChunks = [];
          
          processMenuVoiceInput(audioBlob, mode);
          stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
  }

  function stopMenuRecording() {
      if(mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  }

  async function processMenuVoiceInput(audioBlob, mode) {
      if (menuAudioContext) {
          menuAudioContext.pause();
          menuAudioContext = null;
      }

      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.webm');
      
      try {
          const sttResponse = await fetch('/api/stt', { method: 'POST', body: formData });
          const sttData = await sttResponse.json();
          
          if(sttData.text) {
              const text = sttData.text.toLowerCase();
              let replyToSpeak = "";
              let shouldNavigateTo = null;

              const normalize = str => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
              const normText = normalize(text);

              const isListAction = normText.includes("opciones") || normText.includes("listar") || normText.includes("cuales son") || normText.includes("entornos") || normText.includes("personajes") || normText.includes("usuarios");
              const isRepeatAction = normText.includes("repetir") || normText.includes("repite") || normText.includes("que dijiste");
              const isBackAction = normText.includes("regresar") || normText.includes("volver") || normText.includes("atras");
              const isYesAction = normText.includes("si ") || normText.includes(" sí") || normText === "si" || normText.includes("claro") || normText.includes("listo") || normText.includes("preparado") || normText.includes("comenzar");
              const isNoAction = normText.includes(" no") || normText.includes("no ") || normText === "no" || normText.includes("todavia") || normText.includes("espera");
              
              let matchedOption = null;

              if (isBackAction) {
                  if (mode === 'situations') {
                      replyToSpeak = "Ya te encuentras en el menú principal.";
                  } else if (mode === 'characters') {
                      replyToSpeak = "Regresando al menú principal de entornos.";
                      shouldNavigateTo = 'back_to_home';
                  } else if (mode === 'prep') {
                      replyToSpeak = "Regresando a la selección de participantes.";
                      shouldNavigateTo = 'back_to_characters';
                  } else if (mode === 'settings' || mode === 'meter') {
                      replyToSpeak = "Volviendo al menú principal.";
                      shouldNavigateTo = 'back_to_home';
                  } else if (mode === 'forum') {
                      forumVoiceStep = null;
                      document.getElementById('forum-form').style.display = 'none';
                      replyToSpeak = "Volviendo al menú principal.";
                      shouldNavigateTo = 'back_to_home';
                  } else if (mode === 'pause') {
                      replyToSpeak = "Saliendo de la simulación hacia el menú principal. Progreso no guardado.";
                      shouldNavigateTo = 'back_to_home';
                  }
              }
              else if (mode === 'situations') {
                  const sitKeywords = {
                     'sit-publico': ['publico', 'calle', 'espacio'],
                     'sit-academico': ['academico', 'universidad', 'profesor', 'escuela'],
                     'sit-laboral': ['laboral', 'trabajo', 'oficina', 'gerente'],
                     'sit-personal': ['personal', 'familiar', 'familia', 'pareja', 'amigo']
                  };
                  for (const sit of appData.situaciones) {
                      const titleWords = normalize(sit.titulo).split(" ").filter(w => w.length > 3);
                      const keyWs = sitKeywords[sit.id] || [];
                      const allKeys = [...titleWords, ...keyWs];
                      if (allKeys.some(kw => normText.includes(kw))) {
                          matchedOption = sit; break;
                      }
                  }
                  
                  if (matchedOption) {
                      replyToSpeak = "Entrando a " + matchedOption.titulo;
                      shouldNavigateTo = matchedOption.id;
                  } else if (isListAction) {
                      const titles = appData.situaciones.map(s => s.titulo).join(", ");
                      replyToSpeak = "Las situaciones disponibles son: " + titles + " ... Di el nombre de una para entrar.";
                  } else if (normText.includes("progreso")) {
                      replyToSpeak = "Entrando a Mi Progreso.";
                      shouldNavigateTo = 'go_to_meter';
                  } else if (normText.includes("configura") || normText.includes("ajustes")) {
                      replyToSpeak = "Entrando a Configuración.";
                      shouldNavigateTo = 'go_to_settings';
                  } else if (isRepeatAction) {
                      replyToSpeak = "Elige una situación para practicar. Cada entorno presenta diferentes retos emocionales. Puedes decir ver mi progreso, o también ir a configuración.";
                  } else {
                      replyToSpeak = "Comando no reconocido. Puedes decir: repetir, listar opciones, o directamente el nombre del entorno.";
                  }
              } else if (mode === 'characters' && currentSituation) {
                  for (const char of currentSituation.personajes) {
                      const nameWords = normalize(char.nombre).split(" ").filter(w => w.length > 3);
                      if (nameWords.some(kw => normText.includes(kw))) {
                          matchedOption = char; break;
                      }
                  }
                  
                  if (matchedOption) {
                      replyToSpeak = "Entrando a la preparación con " + matchedOption.nombre;
                      shouldNavigateTo = matchedOption.id;
                  } else if (isListAction) {
                      const names = currentSituation.personajes.map(c => c.nombre + ", dificultad " + c.dificultad).join("... ");
                      replyToSpeak = "Los participantes son: " + names + " ... Puedes elegir a uno diciendo su nombre.";
                  } else if (isRepeatAction) {
                      replyToSpeak = "Selecciona con qué personaje interactuar en " + currentSituation.titulo;
                  } else {
                      replyToSpeak = "Comando no disponible. Puedes decir repetir, elegir a alguien de la lista, o volver.";
                  }
              } else if (mode === 'prep') {
                  if (isYesAction) {
                      replyToSpeak = "Iniciando simulación.";
                      shouldNavigateTo = 'start_sim';
                  } else if (isNoAction) {
                      replyToSpeak = "De acuerdo, tómate tu tiempo. Estaré esperando a que digas que estás listo.";
                  } else if (isRepeatAction) {
                      const objText = document.getElementById('prep-objective').innerText;
                      replyToSpeak = "El objetivo aquí es: " + objText + " ¿Estás listo para iniciar la simulación?";
                  } else {
                      replyToSpeak = "Comando no reconocido. Dime si estás listo para iniciar, o di volver para elegir otro entorno.";
                  }
              } else if (mode === 'sim') {
                  if (normText.includes("finalizar") || normText.includes("terminar") || normText.includes("salir")) {
                      replyToSpeak = "Finalizando sesión, calculando tu puntuación.";
                      shouldNavigateTo = 'sim_stop';
                  } else if (normText.includes("pausa") || normText.includes("calma")) {
                      replyToSpeak = "Entrando a pausa forzada.";
                      shouldNavigateTo = 'sim_pause';
                  } else {
                      replyToSpeak = "Comandos: finalizar, pausa.";
                  }
              } else if (mode === 'pause') {
                  if (isYesAction || normText.includes("reanudar")) {
                      replyToSpeak = "Bien, volvemos a la simulación. Respira profundo.";
                      shouldNavigateTo = 'sim_resume';
                  } else if (normText.includes("salir") || normText.includes("finalizar")) {
                      replyToSpeak = "De acuerdo, saliendo al menú principal.";
                      shouldNavigateTo = 'back_to_home';
                  } else {
                      replyToSpeak = "¿Te sientes preparado para volver a la simulación? Di sí para continuar, o salir para volver al inicio.";
                  }
              } else if (mode === 'results') {
                  if (normText.includes("dime el feedback") || normText.includes("leer feedback") || normText.includes("leer el feedback") || normText.includes("feedback")) {
                      if (lastCoachFeedback) {
                          replyToSpeak = "Aquí tienes el feedback del coach: " + lastCoachFeedback;
                      } else {
                          replyToSpeak = "El feedback aún se está generando, o no hubo conversación suficiente.";
                      }
                  } else if (isListAction || isRepeatAction) {
                      replyToSpeak = "Estás en Resultados. Puedes decir: dime el feedback, o volver.";
                  } else {
                      replyToSpeak = "Comandos disponibles: dime el feedback, o volver.";
                  }
              } else if (mode === 'settings') {
                  if (normText.includes("noche") || normText.includes("nocturno") || normText.includes("oscuro") || normText.includes("claro")) {
                      replyToSpeak = "Cambiando tema visual.";
                      shouldNavigateTo = 'toggle_dark';
                  } else if (normText.includes("grande") || normText.includes("aumentar")) {
                      replyToSpeak = "Cambiando tamaño a grande.";
                      shouldNavigateTo = 'size_large';
                  } else if (normText.includes("normal")) {
                      replyToSpeak = "Cambiando tamaño a normal.";
                      shouldNavigateTo = 'size_normal';
                  } else if (normText.includes("pequeño")) {
                      replyToSpeak = "Cambiando tamaño a pequeño.";
                      shouldNavigateTo = 'size_small';
                  } else if (isListAction || isRepeatAction) {
                      replyToSpeak = "Opciones disponibles: cambiar modo noche, poner tamaño grande, normal, pequeño, o volver.";
                  } else {
                      replyToSpeak = "Comando no reconocido. Puedes decir cambiar modo noche, cambiar tamaño o volver.";
                  }
              } else if (mode === 'meter') {
                  if (normText.includes("promedio") || normText.includes("general") || normText.includes("leer") || normText.includes("progreso")) {
                      const scoreLabel = document.getElementById('global-score') ? document.getElementById('global-score').innerText : "50 Pts";
                      replyToSpeak = "Tu puntuación promedio de estrés es " + scoreLabel;
                  } else if (isListAction || isRepeatAction) {
                      replyToSpeak = "Estás en Mi Progreso. Puedes decir: leer promedio, o volver.";
                  } else {
                      replyToSpeak = "Puedes decir leer promedio, o volver.";
                  }
              } else if (mode === 'forum') {
                  if (forumVoiceStep === 'waiting_title') {
                      if (normText.includes("cancelar")) {
                          forumVoiceStep = null;
                          document.getElementById('forum-form').style.display = 'none';
                          document.getElementById('forum-titulo').value = '';
                          replyToSpeak = "Post cancelado.";
                      } else {
                          document.getElementById('forum-titulo').value = sttData.text;
                          forumVoiceStep = 'waiting_content';
                          replyToSpeak = "Título guardado: " + sttData.text + ". Ahora dime el contenido de tu post.";
                      }
                  } else if (forumVoiceStep === 'waiting_content') {
                      if (normText.includes("cancelar")) {
                          forumVoiceStep = null;
                          document.getElementById('forum-form').style.display = 'none';
                          document.getElementById('forum-titulo').value = '';
                          document.getElementById('forum-contenido').value = '';
                          replyToSpeak = "Post cancelado.";
                      } else {
                          document.getElementById('forum-contenido').value = sttData.text;
                          forumVoiceStep = 'waiting_confirm';
                          replyToSpeak = "Contenido guardado. ¿Deseas publicar el post? Di sí para confirmar, o cancelar para salir.";
                      }
                  } else if (forumVoiceStep === 'waiting_confirm') {
                      if (isYesAction || normText.includes("publicar") || normText.includes("confirmar")) {
                          forumVoiceStep = null;
                          const titulo = document.getElementById('forum-titulo').value.trim();
                          const contenido = document.getElementById('forum-contenido').value.trim();
                          const username = localStorage.getItem('currentUser') || 'Anónimo';
                          try {
                              const res = await fetch('/api/forum', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ username, titulo, contenido })
                              });
                              const postData = await res.json();
                              if (postData.status === 'success') {
                                  document.getElementById('forum-titulo').value = '';
                                  document.getElementById('forum-contenido').value = '';
                                  document.getElementById('forum-form').style.display = 'none';
                                  loadForum();
                                  replyToSpeak = "Post publicado exitosamente en el foro.";
                              } else {
                                  replyToSpeak = "No se pudo publicar el post. Inténtalo nuevamente.";
                              }
                          } catch (e) {
                              replyToSpeak = "Error de conexión al publicar.";
                          }
                      } else if (isNoAction || normText.includes("cancelar")) {
                          forumVoiceStep = null;
                          document.getElementById('forum-form').style.display = 'none';
                          document.getElementById('forum-titulo').value = '';
                          document.getElementById('forum-contenido').value = '';
                          replyToSpeak = "Post cancelado.";
                      } else {
                          replyToSpeak = "Di sí para publicar, o cancelar para salir.";
                      }
                  } else {
                      if (normText.includes("nuevo") || normText.includes("crear") || normText.includes("escribir") || normText.includes("post") || normText.includes("publicar")) {
                          forumVoiceStep = 'waiting_title';
                          document.getElementById('forum-form').style.display = 'block';
                          document.getElementById('forum-titulo').value = '';
                          document.getElementById('forum-contenido').value = '';
                          document.getElementById('forum-titulo').focus();
                          replyToSpeak = "Perfecto. Dime el título de tu post.";
                      } else if (normText.includes("actualizar") || normText.includes("recargar") || normText.includes("refrescar")) {
                          loadForum();
                          replyToSpeak = "Foro actualizado.";
                      } else if (isListAction || isRepeatAction) {
                          replyToSpeak = "Estás en el Foro Comunitario. Puedes decir: nuevo post, actualizar, o volver.";
                      } else {
                          replyToSpeak = "Comandos disponibles: nuevo post, actualizar, o volver.";
                      }
                  }
              }

              // 3. TTS: Hacemos que Python hable la respuesta decidida
              if (voiceModeEnabled) {
                  const ttsResponse = await fetch('/api/tts', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ text: replyToSpeak })
                  });
                  const ttsData = await ttsResponse.json();
                  
                  if(ttsData.audio_url) {
                      menuAudioContext = new Audio(ttsData.audio_url + '?t=' + new Date().getTime());
                      
                      if (shouldNavigateTo) {
                          menuAudioContext.onended = () => {
                              if (shouldNavigateTo === 'back_to_home') { showView('view-home'); if (currentCharacter) endSimulation(true); }
                              else if (shouldNavigateTo === 'back_to_characters') showView('view-characters');
                              else if (shouldNavigateTo === 'go_to_meter') showView('view-meter');
                              else if (shouldNavigateTo === 'go_to_settings') showView('view-settings');
                              else if (shouldNavigateTo === 'start_sim') startSimulation();
                              else if (shouldNavigateTo === 'sim_stop') triggerSimAction('stop', document.querySelector('.btn-stop'));
                              else if (shouldNavigateTo === 'sim_pause') showView('view-pause');
                              else if (shouldNavigateTo === 'sim_resume') showView('view-sim');
                              else if (shouldNavigateTo === 'toggle_dark') toggleDarkMode();
                              else if (shouldNavigateTo === 'size_large') { document.getElementById('ui-size-select').value='large'; changeUiSize('large'); }
                              else if (shouldNavigateTo === 'size_normal') { document.getElementById('ui-size-select').value='normal'; changeUiSize('normal'); }
                              else if (shouldNavigateTo === 'size_small') { document.getElementById('ui-size-select').value='small'; changeUiSize('small'); }
                              
                              else if (mode === 'situations') selectSituation(shouldNavigateTo);
                              else if (mode === 'characters') selectCharacter(shouldNavigateTo);
                          };
                      }
                      
                      menuAudioContext.play();
                  }
              } else {
                  // Muta el modo si esta apagado el TTS pero deja funcionar la navegacion
                  if (shouldNavigateTo) {
                      if (shouldNavigateTo === 'back_to_home') { showView('view-home'); if (currentCharacter) endSimulation(true); }
                      else if (shouldNavigateTo === 'back_to_characters') showView('view-characters');
                      else if (shouldNavigateTo === 'go_to_meter') showView('view-meter');
                      else if (shouldNavigateTo === 'go_to_settings') showView('view-settings');
                      else if (shouldNavigateTo === 'start_sim') startSimulation();
                      else if (shouldNavigateTo === 'sim_stop') triggerSimAction('stop', document.querySelector('.btn-stop'));
                      else if (shouldNavigateTo === 'sim_pause') showView('view-pause');
                      else if (shouldNavigateTo === 'sim_resume') showView('view-sim');
                      else if (shouldNavigateTo === 'toggle_dark') toggleDarkMode();
                      else if (shouldNavigateTo === 'size_large') { document.getElementById('ui-size-select').value='large'; changeUiSize('large'); }
                      else if (shouldNavigateTo === 'size_normal') { document.getElementById('ui-size-select').value='normal'; changeUiSize('normal'); }
                      else if (shouldNavigateTo === 'size_small') { document.getElementById('ui-size-select').value='small'; changeUiSize('small'); }
                      
                      else if (mode === 'situations') selectSituation(shouldNavigateTo);
                      else if (mode === 'characters') selectCharacter(shouldNavigateTo);
                  }
              }
          } else if (sttData.error) {
              console.error("STT Error:", sttData.error);
              playNPCVoice("No pude escuchar bien, ¿puedes repetirlo?");
          }
      } catch (err) {
          console.error("Error en el asistente de menú local:", err);
          playNPCVoice("Hubo un error al procesar los comandos de voz.");
      }
  }

  function announceMenuContext(view) {
      if (!voiceModeEnabled) return;
      if(view === 'view-home') {
          playNPCVoice("Elige una situación para practicar. Cada entorno presenta diferentes retos emocionales y sociales.");
      } else if(view === 'view-characters' && currentSituation) {
          playNPCVoice("Selecciona con qué personaje interactuar en " + currentSituation.titulo);
      } else if(view === 'view-prep' && currentCharacter) {
          const contextoContextual = currentCharacter.prompt.split("REGLAS")[0].trim();
          playNPCVoice("Contexto: " + contextoContextual + " ... El objetivo es: " + document.getElementById('prep-objective').innerText + " ... ¿Estás listo para iniciar la simulación? Di sí para comenzar, o volver para elegir otro personaje.");
      } else if (view === 'view-pause') {
          playNPCVoice("Modo de pausa activa. Respira conmigo. ¿Te sientes preparado para volver? Di sí para continuar, o salir para abandonar.");
      } else if (view === 'view-settings') {
          playNPCVoice("Panel de Configuración. Comandos de voz: modo noche, tamaño grande, normal o pequeño.");
      } else if (view === 'view-meter') {
          playNPCVoice("Historial de progreso. Puedes decir leer promedio.");
      } else if (view === 'view-forum') {
          forumVoiceStep = null;
          playNPCVoice("Foro comunitario. Mantén presionado el micrófono y di nuevo post para crear una publicación, actualizar para recargar, o volver para salir.");
      } else if (view === 'view-results') {
          playNPCVoice("Resultados de la simulación. Puedes decir dime el feedback para escuchar las sugerencias del coach, o volver para salir.");
      }
  }

  // Finalizar manual o abandonar (reinicia vars y apaga camara)
  function endSimulation(skipSave = false) {
      currentCharacter = null;
      stopCamera();
  }

  // 2. El flujo maestro: STT -> Gemini -> TTS
  async function processVoiceInput(audioBlob) {
      // Indicador de que está pensando reconociendo voz...
      const typingInd = document.getElementById('typing-indicator');
      typingInd.innerText = "Reconociendo voz...";
      typingInd.style.display = 'block';
      
      const formData = new FormData();
      // Para que FLASK detecte el archivo, pasamos el blob como 'audio' y un nombre ficticio 'audio.webm'
      formData.append('audio', audioBlob, 'audio.webm');
      
      try {
          // A. Enviar Audio a Python (Speech-to-Text)
          const sttResponse = await fetch('/api/stt', { method: 'POST', body: formData });
          const sttData = await sttResponse.json();
          
          if(sttData.text) {
              typingInd.innerText = "Pensando respuesta...";
              // Mostrar texto del usuario en el chat
              appendMessage('user', sttData.text);
              const inputEl = document.getElementById('chat-input-text');
              inputEl.value = '';
              
              // B. Enviar a Gemini usando tu LLMClient actual
              let reply = await llmClient.chat(sttData.text, currentCharacter.prompt);
              
              // Aquí aplicaríamos la misma lógica de "USER_EMOTION" que tienes en sendChatMessage():
              const emotionMatch = reply.match(/\[USER_EMOTION:\s*([a-zA-Z]+)\]/i);
              if (emotionMatch) {
                  const detectedEmotion = emotionMatch[1].toLowerCase();
                  const validEmotions = ['neutral', 'happy', 'sad', 'angry', 'fear', 'surprise', 'disgust'];
                  if(validEmotions.includes(detectedEmotion)) {
                      lastChatEmotionDetected = detectedEmotion;
                      let pointsChange = 0; let dogEmotion = 'neutral';
                      switch(detectedEmotion) {
                          case 'angry': pointsChange = 20; dogEmotion = 'fear'; break;
                          case 'happy': pointsChange = -15; dogEmotion = 'happy'; break;
                          case 'sad': pointsChange = 5; dogEmotion = 'sad'; break;
                          case 'fear': pointsChange = 10; dogEmotion = 'surprise'; break;
                          case 'disgust': pointsChange = 10; dogEmotion = 'sad'; break;
                          case 'neutral': pointsChange = -5; dogEmotion = 'neutral'; break;
                          case 'surprise': pointsChange = 0; dogEmotion = 'surprise'; break;
                      }
                      currentStress += pointsChange;
                      if (currentStress > 100) currentStress = 100;
                      if (currentStress < 0) currentStress = 0;
                      if (currentStress >= 80) dogEmotion = 'sad';
                      document.getElementById('dog').setAttribute('data-emotion', dogEmotion);
                      document.getElementById('dog-statusText').innerText = dogEmotion;
                      updateStressUI();
                      if (currentStress >= 100) setTimeout(() => showView('view-pause'), 2000);
                  }
                  reply = reply.replace(/\[USER_EMOTION:.*?\]/gi, '').trim();
              }
              
              typingInd.style.display = 'none';
              appendMessage('npc', reply); // Mostrar texto del NPC
              
              // C. Enviar texto del NPC a Python para hacerlo hablar (Text-to-Speech)
              playNPCVoice(reply);
          } else if (sttData.error) {
             typingInd.style.display = 'none';
             appendMessage('system', "Error de dictado: " + sttData.error);
          }
      } catch (err) {
          typingInd.style.display = 'none';
          appendMessage('system', "Error en el procesamiento de voz: " + err.message);
      }
  }

  function updateStressUI() {
      const statusEl = document.getElementById('biometrics-status');
      const progressEl = document.getElementById('biometrics-progress');
      
      statusEl.innerText = `${currentStress} / 100`;
      progressEl.style.width = `${currentStress}%`;
      
      let color = "var(--green-dark)"; // 0-40
      if (currentStress > 40 && currentStress <= 70) color = "#d97706"; // warning
      if (currentStress > 70) color = "#b91c1c"; // danger
      
      statusEl.style.color = color;
      progressEl.style.backgroundColor = color;
  }

  function toggleStressVisibility() {
      isStressHidden = !isStressHidden;
      const content = document.getElementById('stress-content');
      const btn = document.getElementById('btn-toggle-stress');
      if (isStressHidden) {
          content.style.display = 'none';
          btn.innerHTML = '<i class="fas fa-eye"></i>';
      } else {
          content.style.display = 'block';
          btn.innerHTML = '<i class="fas fa-eye-slash"></i>';
      }
  }

  function triggerSimAction(action, buttonEl) {
      buttonEl.classList.add('pressed-active');
      setTimeout(() => { buttonEl.classList.remove('pressed-active'); }, 600);

      const toast = document.getElementById('sim-feedback-toast');
      toast.style.display = 'block';
      toast.className = "sim-toast";

      if(action === 'stop') {
          toast.classList.add('toast-warning');
          toast.innerHTML = `<i class="fas fa-sign-out-alt"></i> <strong>Cerrando Sesión...</strong> Procesando puntuación final.`;
          setTimeout(() => { 
              toast.style.display = 'none'; 
              showSimulationResults();
          }, 1500);
      }
  }

  async function showSimulationResults() {
      // Detener cámara si estaba prendida
      stopCamera();
      
      // Actualizar vista de resultados
      document.getElementById('result-stress-score').innerText = `${currentStress}/100`;
      
      let msg = "";
      if (currentStress <= 30) msg = "¡Excelente! Manejaste el conflicto con mucha calma.";
      else if (currentStress <= 70) msg = "Estuviste regular. Sentiste un poco de tensión, pero manejable.";
      else msg = "El estrés dominóla conversación. Recuerda, prioriza tomar descansos.";
      
      document.getElementById('result-stress-message').innerText = msg;
      
      // Transferir la última emoción del perro
      const finalDogEmotion = document.getElementById('dog').getAttribute('data-emotion');
      document.getElementById('result-dog').setAttribute('data-emotion', finalDogEmotion);
      
      // Guardar nombres antes de borrar la referencia
      const situacionName = currentSituation ? currentSituation.titulo : "Situación Desconocida";
      const personajeName = currentCharacter ? currentCharacter.nombre : "Personaje Desconocido";
      const lastChatEmotion = lastChatEmotionDetected;
      const finalCameraEmotion = lastCamEmotionDetected;
      
      // Mostrar la vista y generar feedback
      showView('view-results'); 
      await generateCoachFeedback();
      
      // Guardar progreso en el backend con el feedback incluido
      fetch('/save_progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              chat_emotion: lastChatEmotion,
              camera_emotion: finalCameraEmotion,
              pet_emotion: finalDogEmotion,
              stress: currentStress,
              situacion: situacionName,
              personaje: personajeName,
              feedback: lastCoachFeedback
          })
      }).then(() => {
          updateGlobalScore(); // Actualizar el promedio
      }).catch(err => console.error("Error al guardar progreso:", err));

      currentCharacter = null; 
  }

  async function generateCoachFeedback() {
      const feedbackContainer = document.getElementById('coach-feedback-content');
      const btnRead = document.getElementById('btn-read-feedback');
      
      feedbackContainer.innerHTML = `
          <div style="text-align: center; color: #92400e;">
              <i class="fas fa-circle-notch fa-spin" style="font-size: 24px; margin-bottom: 8px;"></i>
              <p>Analizando la conversación para darte feedback...</p>
          </div>
      `;
      btnRead.style.display = 'none';
      lastCoachFeedback = "";

      if (llmClient.conversationHistory.length === 0) {
          feedbackContainer.innerHTML = "<p>No hubo interacción suficiente para generar feedback.</p>";
          return;
      }

      try {
          const coachClient = new LLMClient(llmClient.apiKey);
          const formattedHistory = llmClient.conversationHistory.map(h => `${h.role === 'user' ? 'Usuario' : 'Personaje'}: ${h.parts[0].text}`).join("\\n");
          const coachPrompt = "Eres un coach experto en habilidades sociales. Analiza la siguiente conversación y proporciona 2 sugerencias breves, amables y constructivas sobre cómo el usuario podría mejorar su comunicación, empatía o asertividad. Formatea tu respuesta en HTML usando <ul> y <li>.";
          const message = `Conversación:\\n${formattedHistory}`;
          
          let feedback = await coachClient.chat(message, coachPrompt, 0.7);
          
          // Limpiar tags de emoción por si el modelo los devuelve
          feedback = feedback.replace(/\\[USER_EMOTION:.*?\\]/gi, '').trim();
          
          lastCoachFeedback = feedback.replace(/<[^>]+>/g, ''); // Limpiar tags HTML para TTS
          feedbackContainer.innerHTML = feedback;
          
          if (voiceModeEnabled) {
              btnRead.style.display = 'block';
          }
      } catch (err) {
          feedbackContainer.innerHTML = `<p style="color: red;">Error al generar feedback: ${err.message}</p>`;
      }
  }

  // =========================================================================
  // CONTROL DE VISTAS
  // =========================================================================
  function showView(targetId) {
    stopAllAudio();
    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
    document.getElementById(targetId).classList.add('active');

    document.querySelectorAll('.nav-item').forEach(nav => {
      nav.classList.remove('active');
      if(targetId.includes('home') || targetId.includes('characters') || targetId.includes('prep') || targetId.includes('sim')){
          if(nav.getAttribute('data-target') === 'view-home') nav.classList.add('active');
      } else {
          if(nav.getAttribute('data-target') === targetId) nav.classList.add('active');
      }
    });

    const header = document.getElementById('main-header');
    if(targetId === 'view-pause' || targetId === 'view-sim') header.style.display = 'none';
    else header.style.display = 'flex';
    
    // Anunciar por voz si está configurado
    if (llmClient.apiKey) {
        announceMenuContext(targetId);
    }
  }

  // =========================================================================
  // LOGICA DEL PANDA Y LA CAMARA
  // =========================================================================
  let pollingInterval = null;

  function setEmotion(emotion) {
      document.getElementById('panda').setAttribute('data-emotion', emotion);
  }

  let isVideoHidden = false;
  function toggleVideo() {
      isVideoHidden = !isVideoHidden;
      const videoStream = document.getElementById('videoStream');
      const placeholder = document.getElementById('cameraPlaceholder');
      const btn = document.getElementById('toggleVidBtn');
      
      if (isVideoHidden) {
          videoStream.style.opacity = '0';
          placeholder.style.display = 'block';
          placeholder.innerText = 'Cámara oculta (activo)';
          btn.innerText = 'Mostrar Video';
      } else {
          videoStream.style.opacity = '1';
          placeholder.style.display = 'none';
          btn.innerText = 'Ocultar Video';
      }
  }

  function startCamera() {
      const videoStream = document.getElementById('videoStream');
      const placeholder = document.getElementById('cameraPlaceholder');
      
      videoStream.src = '/video_feed';
      videoStream.style.display = 'block';
      isVideoHidden = false;
      videoStream.style.opacity = '1';
      placeholder.style.display = 'none';
      
      const btn = document.getElementById('startBtn');
      btn.style.display = "none";

      const stopBtn = document.getElementById('stopBtn');
      stopBtn.style.display = "inline-block";
      
      const toggleBtn = document.getElementById('toggleVidBtn');
      toggleBtn.style.display = "inline-block";
      toggleBtn.innerText = 'Ocultar Video';

      if (!pollingInterval) {
          pollingInterval = setInterval(fetchEmotion, 100);
      }
  }

  async function stopCamera() {
      if (pollingInterval) {
          clearInterval(pollingInterval);
          pollingInterval = null;
      }
      
      try {
          await fetch('/stop_camera');
      } catch (err) {
          console.error(err);
      }
      
      const videoStream = document.getElementById('videoStream');
      videoStream.src = "";
      videoStream.style.display = 'none';
      
      const placeholder = document.getElementById('cameraPlaceholder');
      placeholder.style.display = 'block';
      placeholder.innerText = 'Cámara apagada';
      
      document.getElementById('startBtn').style.display = "inline-block";
      document.getElementById('stopBtn').style.display = "none";
      document.getElementById('toggleVidBtn').style.display = "none";
      document.getElementById('statusText').innerText = "apagada";
      
      setEmotion('neutral');
      const panda = document.getElementById('panda');
      panda.style.setProperty('--rot-y', `0deg`);
      panda.style.setProperty('--rot-x', `0deg`);
  }

  async function fetchEmotion() {
      try {
          const response = await fetch('/get_state');
          const data = await response.json();
          
          document.getElementById('statusText').innerText = data.emotion;
          
          const validEmotions = ['neutral', 'happy', 'sad', 'angry', 'fear', 'surprise', 'disgust'];
          if(validEmotions.includes(data.emotion)) {
              lastCamEmotionDetected = data.emotion;
              setEmotion(data.emotion);
          }

          const rotY = (data.coords.x - 50) * 1.5; 
          const rotX = -(data.coords.y - 50) * 1.2; 

          const panda = document.getElementById('panda');
          panda.style.setProperty('--rot-y', `${rotY}deg`);
          panda.style.setProperty('--rot-x', `${rotX}deg`);

      } catch (err) {
          console.error("Error consultando estado: ", err);
      }
  }

  // =========================================================================
  // CONFIGURACIÓN Y PROGRESO
  // =========================================================================
  function toggleDarkMode() {
      document.body.classList.toggle('dark-theme');
  }

  function changeUiSize(size) {
      document.body.classList.remove('ui-large', 'ui-small', 'ui-normal');
      document.body.classList.add(`ui-${size}`);
  }

  function loadProgress() {
      const container = document.getElementById('progress-container');
      container.innerHTML = '<div style="padding: 20px; text-align: center;">Cargando historial...</div>';
      
      fetch('/get_progress')
        .then(res => res.json())
        .then(data => {
            if (!data || data.length === 0) {
                container.innerHTML = '<div style="padding: 20px; text-align: center;">Aún no hay historial de progreso. ¡Empieza una simulación!</div>';
                return;
            }
            
            // Agrupar por situación
            const grouped = {};
            data.forEach(row => {
                const sit = row.Situacion || "Situación Desconocida";
                if (!grouped[sit]) grouped[sit] = [];
                grouped[sit].push(row);
            });
            
            container.innerHTML = '';
            
            for (const sit in grouped) {
                const records = grouped[sit];
                let totalStress = 0;
                records.forEach(r => { totalStress += parseInt(r.Stress) || 50; });
                const avgStress = Math.round(totalStress / records.length);
                const performance = 100 - avgStress;
                
                let perfIcon = "fa-smile-beam";
                let perfColor = "#16a34a"; // Green
                if (performance < 40) { perfIcon = "fa-frown"; perfColor = "#dc2626"; } // Red
                else if (performance < 70) { perfIcon = "fa-meh"; perfColor = "#d97706"; } // Yellow
                
                // Generar HTML del acordeón
                const accId = 'acc-' + Math.random().toString(36).substr(2, 9);
                
                let recordsHtml = '';
                // Mostrar del más reciente al más antiguo
                records.slice().reverse().forEach(row => {
                    const personaje = row.Personaje || "Desconocido";
                    let feedbackHtml = '';
                    if (row.Feedback && row.Feedback.trim() !== '') {
                        feedbackHtml = `
                            <div style="margin-top: 12px; padding: 12px; background: #fffbeb; border-left: 3px solid #fcd34d; font-size: 14px; border-radius: 0 6px 6px 0;">
                                <strong><i class="fas fa-chalkboard-teacher"></i> Feedback recibido:</strong>
                                <div style="margin-top: 8px;">${row.Feedback}</div>
                            </div>
                        `;
                    }
                    
                    recordsHtml += `
                        <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 12px; background: white;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 8px; flex-wrap: wrap; gap: 10px;">
                                <div style="font-weight: bold; color: var(--primary);"><i class="fas fa-user-circle"></i> ${personaje}</div>
                                <div style="font-size: 12px; color: #64748b;"><i class="fas fa-calendar-alt"></i> ${row.Fecha_Hora}</div>
                            </div>
                            <div style="display: flex; gap: 15px; font-size: 13px; color: #475569; flex-wrap: wrap;">
                                <span><strong>Estrés:</strong> ${row.Stress}/100</span>
                                <span><strong>Cámara:</strong> ${row.Emocion_Camara}</span>
                                <span><strong>Chat:</strong> ${row.Emocion_Chat}</span>
                                <span><strong>Mascota:</strong> ${row.Emocion_Mascota}</span>
                            </div>
                            ${feedbackHtml}
                        </div>
                    `;
                });
                
                const section = document.createElement('div');
                section.style.marginBottom = "16px";
                section.innerHTML = `
                    <div onclick="const el = document.getElementById('${accId}'); el.style.display = el.style.display === 'none' ? 'block' : 'none'" 
                         style="background: var(--bg-card); padding: 16px 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); cursor: pointer; display: flex; justify-content: space-between; align-items: center; border-left: 5px solid ${perfColor}; transition: transform 0.2s;">
                        <div>
                            <h3 style="margin: 0; font-size: 18px; color: var(--text-color);">${sit}</h3>
                            <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">${records.length} interacción(es) registrada(s)</p>
                        </div>
                        <div style="text-align: right; color: ${perfColor};">
                            <div style="font-size: 22px; font-weight: bold;"><i class="fas ${perfIcon}"></i> ${performance}%</div>
                            <div style="font-size: 11px; text-transform: uppercase;">Rendimiento</div>
                        </div>
                    </div>
                    <div id="${accId}" style="display: none; padding: 16px 0 0 16px; border-left: 2px dashed #cbd5e1; margin-left: 10px;">
                        ${recordsHtml}
                    </div>
                `;
                container.appendChild(section);
            }
        })
        .catch(err => {
            console.error(err);
            container.innerHTML = `<div style="padding: 20px; text-align: center; color: red;">Error al cargar progreso.</div>`;
        });
  }

  // Cargar progreso al entrar a la vista 'view-meter'
  const originalShowView = showView;
  showView = function(targetId) {
      originalShowView(targetId);
      if (targetId === 'view-meter') {
          loadProgress();
      }
  };

  // =========================================================================
  // SISTEMA DE AUTENTICACIÓN
  // =========================================================================
  let currentUser = null;

  // Mostrar/cambiar entre login y register
  function stopAllAudio() {
      if (currentTTSAbortController) { currentTTSAbortController.abort(); currentTTSAbortController = null; }
      if (currentNPCAudio) { currentNPCAudio.pause(); currentNPCAudio.src = ''; currentNPCAudio = null; }
      if (menuAudioContext) { menuAudioContext.pause(); menuAudioContext.src = ''; menuAudioContext = null; }
  }

  function showAuthView(targetId) {
      stopAllAudio();
      document.querySelectorAll('.view').forEach(view => {
          view.classList.remove('active');
      });
      document.getElementById(targetId).classList.add('active');
  }

  // Manejar Login
  async function handleLogin() {
      const username = document.getElementById('login-username').value.trim();
      const password = document.getElementById('login-password').value.trim();
      const errorMsg = document.getElementById('login-error-msg');

      // Validar campos vacíos
      if (!username || !password) {
          errorMsg.style.display = 'block';
          errorMsg.innerText = '⚠️ Usuario y contraseña son requeridos.';
          return;
      }

      try {
          const response = await fetch('/api/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username, password })
          });

          const data = await response.json();

          if (response.ok && data.status === 'success') {
              // Login exitoso
              localStorage.setItem('currentUser', username);
              currentUser = username;
              errorMsg.style.display = 'none';
              
              // Limpiar campos
              document.getElementById('login-username').value = '';
              document.getElementById('login-password').value = '';

              // Mostrar app
              document.getElementById('sidebar-nav').style.display = 'flex';
              document.getElementById('main-header').style.display = 'flex';
              updateUserDisplay();
              
              // Mostrar vista de home
              renderSituations();
              updateGlobalScore();
              showView('view-home');
          } else {
              // Error en login
              errorMsg.style.display = 'block';
              errorMsg.innerText = '❌ ' + (data.message || 'Error al iniciar sesión');
          }
      } catch (error) {
          console.error('Error:', error);
          errorMsg.style.display = 'block';
          errorMsg.innerText = '❌ Error de conexión. Intenta nuevamente.';
      }
  }

  // Manejar Registro
  async function handleRegister() {
      const username = document.getElementById('register-username').value.trim();
      const password = document.getElementById('register-password').value.trim();
      const errorMsg = document.getElementById('register-error-msg');
      const successMsg = document.getElementById('register-success-msg');

      // Limpiar mensajes previos
      errorMsg.style.display = 'none';
      successMsg.style.display = 'none';

      // Validar campos vacíos
      if (!username || !password) {
          errorMsg.style.display = 'block';
          errorMsg.innerText = '⚠️ Usuario y contraseña son requeridos.';
          return;
      }

      // Validar longitud mínima
      if (username.length < 3) {
          errorMsg.style.display = 'block';
          errorMsg.innerText = '⚠️ El usuario debe tener al menos 3 caracteres.';
          return;
      }

      if (password.length < 4) {
          errorMsg.style.display = 'block';
          errorMsg.innerText = '⚠️ La contraseña debe tener al menos 4 caracteres.';
          return;
      }

      try {
          const response = await fetch('/api/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username, password })
          });

          const data = await response.json();

          if (response.ok && data.status === 'success') {
              // Registro exitoso
              successMsg.style.display = 'block';
              successMsg.innerText = '✅ ' + data.message;
              
              // Limpiar campos
              document.getElementById('register-username').value = '';
              document.getElementById('register-password').value = '';

              // Redirigir a login después de 2 segundos
              setTimeout(() => {
                  showAuthView('view-login');
                  document.getElementById('login-username').focus();
              }, 2000);
          } else {
              // Error en registro
              errorMsg.style.display = 'block';
              errorMsg.innerText = '❌ ' + (data.message || 'Error al registrarse');
          }
      } catch (error) {
          console.error('Error:', error);
          errorMsg.style.display = 'block';
          errorMsg.innerText = '❌ Error de conexión. Intenta nuevamente.';
      }
  }

  // Actualizar display del usuario en el header
  function updateUserDisplay() {
      const greetingEl = document.getElementById('user-greeting');
      if (greetingEl && currentUser) {
          greetingEl.innerText = `Hola, ${currentUser}`;
      }
  }

  // Logout - Cerrar sesión
  function logout() {
      if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
          localStorage.removeItem('currentUser');
          currentUser = null;
          
          // Limpiar datos de sesión
          document.getElementById('login-username').value = '';
          document.getElementById('login-password').value = '';
          document.getElementById('register-username').value = '';
          document.getElementById('register-password').value = '';
          document.getElementById('login-error-msg').style.display = 'none';
          document.getElementById('register-error-msg').style.display = 'none';
          document.getElementById('register-success-msg').style.display = 'none';
          document.getElementById('user-greeting').innerText = '';

          // Ocultar app
          document.getElementById('sidebar-nav').style.display = 'none';
          document.getElementById('main-header').style.display = 'none';
          
          // Mostrar login
          showAuthView('view-login');
      }
  }

  // Eliminar Cuenta
  async function handleDeleteAccount() {
      const confirmDelete = confirm('⚠️ ADVERTENCIA: Estás a punto de eliminar tu cuenta.\n\n¿Realmente deseas continuar? Esta acción NO se puede deshacer.');
      
      if (!confirmDelete) {
          return;
      }

      const confirmAgain = confirm('Esta es tu ÚLTIMA oportunidad.\n\n¿Estás completamente seguro de que deseas eliminar tu cuenta permanentemente?');
      
      if (!confirmAgain) {
          return;
      }

      try {
          const response = await fetch('/api/delete-account', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username: currentUser })
          });

          const data = await response.json();

          if (response.ok && data.status === 'success') {
              alert('✓ Tu cuenta ha sido eliminada exitosamente.');
              
              // Limpiar sesión
              localStorage.removeItem('currentUser');
              currentUser = null;
              
              // Limpiar formularios
              document.getElementById('login-username').value = '';
              document.getElementById('login-password').value = '';
              document.getElementById('register-username').value = '';
              document.getElementById('register-password').value = '';
              document.getElementById('user-greeting').innerText = '';

              // Ocultar app y volver a login
              document.getElementById('sidebar-nav').style.display = 'none';
              document.getElementById('main-header').style.display = 'none';
              showAuthView('view-login');
          } else {
              alert('❌ ' + (data.message || 'Error al eliminar la cuenta'));
          }
      } catch (error) {
          console.error('Error:', error);
          alert('❌ Error de conexión. Intenta nuevamente.');
      }
}

// ============================================================
// MÓDULO FORO
// ============================================================

function toggleForumForm() {
    const form = document.getElementById('forum-form');
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
    if (form.style.display === 'block') {
        document.getElementById('forum-titulo').focus();
    }
}

async function loadForum() {
    const list = document.getElementById('forum-list');
    list.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Cargando posts...</p>';
    try {
        const res = await fetch('/api/forum');
        const posts = await res.json();
        if (posts.length === 0) {
            list.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Aún no hay posts. ¡Sé el primero en publicar!</p>';
            return;
        }
        list.innerHTML = posts.map(p => `
            <div class="card forum-post">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                    <strong style="font-size: 16px;">${escapeHtml(p.titulo)}</strong>
                    <span style="font-size: 12px; color: var(--text-muted); white-space: nowrap; margin-left: 12px;">${p.fecha}</span>
                </div>
                <p style="margin: 0 0 12px 0; color: var(--text-main); line-height: 1.6;">${escapeHtml(p.contenido)}</p>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 13px; color: var(--text-muted);">👤 ${escapeHtml(p.username)}</span>
                    <button class="btn" style="font-size: 13px; padding: 6px 14px; background: var(--bg-color); border: 1px solid var(--border-color);"
                        onclick="toggleComments('${p.id}')">
                        💬 ${p.comentarios} comentario${p.comentarios !== 1 ? 's' : ''}
                    </button>
                </div>
                <div id="comments-${p.id}" class="forum-comments-section" style="display: none; margin-top: 16px; border-top: 1px solid var(--border-color); padding-top: 16px;">
                    <div id="comments-list-${p.id}"></div>
                    <div style="display: flex; gap: 8px; margin-top: 12px;">
                        <input id="comment-input-${p.id}" type="text" placeholder="Escribe un comentario..."
                            style="flex: 1; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); font-size: 13px; background: var(--bg-color); color: var(--text-main);"
                            onkeydown="if(event.key==='Enter') submitComment('${p.id}')">
                        <button class="btn btn-primary" style="padding: 8px 16px; font-size: 13px;" onclick="submitComment('${p.id}')">Enviar</button>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (e) {
        list.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Error al cargar el foro.</p>';
    }
}

async function submitPost() {
    const titulo = document.getElementById('forum-titulo').value.trim();
    const contenido = document.getElementById('forum-contenido').value.trim();
    const username = localStorage.getItem('currentUser') || 'Anónimo';

    if (!titulo || !contenido) {
        alert('Por favor completa el título y el mensaje.');
        return;
    }

    try {
        const res = await fetch('/api/forum', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, titulo, contenido })
        });
        const data = await res.json();
        if (data.status === 'success') {
            document.getElementById('forum-titulo').value = '';
            document.getElementById('forum-contenido').value = '';
            toggleForumForm();
            loadForum();
        } else {
            alert('Error: ' + data.message);
        }
    } catch (e) {
        alert('Error de conexión.');
    }
}

async function toggleComments(postId) {
    const section = document.getElementById(`comments-${postId}`);
    const isVisible = section.style.display !== 'none';
    section.style.display = isVisible ? 'none' : 'block';
    if (!isVisible) {
        await loadComments(postId);
    }
}

async function loadComments(postId) {
    const listEl = document.getElementById(`comments-list-${postId}`);
    listEl.innerHTML = '<p style="font-size: 13px; color: var(--text-muted);">Cargando...</p>';
    try {
        const res = await fetch(`/api/forum/${postId}/comments`);
        const comments = await res.json();
        if (comments.length === 0) {
            listEl.innerHTML = '<p style="font-size: 13px; color: var(--text-muted);">Sin comentarios aún.</p>';
            return;
        }
        listEl.innerHTML = comments.map(c => `
            <div class="forum-comment">
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <strong style="font-size: 13px;">👤 ${escapeHtml(c.username)}</strong>
                    <span style="font-size: 11px; color: var(--text-muted);">${c.fecha}</span>
                </div>
                <p style="margin: 0; font-size: 14px; color: var(--text-main);">${escapeHtml(c.comentario)}</p>
            </div>
        `).join('');
    } catch (e) {
        listEl.innerHTML = '<p style="font-size: 13px; color: var(--text-muted);">Error al cargar comentarios.</p>';
    }
}

async function submitComment(postId) {
    const input = document.getElementById(`comment-input-${postId}`);
    const comentario = input.value.trim();
    const username = localStorage.getItem('currentUser') || 'Anónimo';

    if (!comentario) return;

    try {
        const res = await fetch(`/api/forum/${postId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, comentario })
        });
        const data = await res.json();
        if (data.status === 'success') {
            input.value = '';
            await loadComments(postId);
        }
    } catch (e) {
        alert('Error de conexión.');
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(String(text)));
    return div.innerHTML;
}