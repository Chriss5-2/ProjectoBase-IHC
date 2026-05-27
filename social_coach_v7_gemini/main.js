// =========================================================================
  // LOGICA PRINCIPAL DE LA APLICACIÃ“N Y CONEXIÃ“N CON EL LLM
  // =========================================================================

  let currentSituation = null;
  let currentCharacter = null;
  let currentStress = 50; // Puntos de estrÃ©s de 0 a 100
  let isStressHidden = false; // Estado de la visibilidad de estrÃ©s
  
  // Instanciar el cliente LLM global
  const llmClient = new LLMClient('');

  function updateGlobalScore() { fetch('/get_progress').then(res => res.json()).then(data => { let scoreLabel = document.getElementById('global-score'); if (!scoreLabel) return; if (!data || data.length === 0) { scoreLabel.innerText = '50 Pts'; return; } let total = 0; data.forEach(row => { total += parseInt(row.Stress) || 50; }); let avg = Math.round(total / data.length); scoreLabel.innerText = avg + ' Pts'; }).catch(e=>console.log(e)); }

  // Al cargar la pÃ¡gina, recuperar la API key si existe
  document.addEventListener("DOMContentLoaded", () => {
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
          statusEl.innerText = "Â¡Clave guardada exitosamente!";
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

  // Seleccionar SituaciÃ³n
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
      document.getElementById('prep-objective').innerText = match ? match[1].trim() : "Manejar la situaciÃ³n asertivamente.";
      showView('view-prep');
  }

  // =========================================================================
  // LOGICA DE CHAT CON GEMINI
  // =========================================================================
  
  function startSimulation() {
      if(!currentCharacter) return;

      // Verificar API Key antes de entrar
      if(!llmClient.apiKey) {
          alert("Â¡Alto! Para interactuar con los personajes necesitas configurar tu API Key de Gemini en los Ajustes.");
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
      
      // Reset BiometrÃ­a (EstrÃ©s) y UI de la Mascota
      currentStress = 50;
      updateStressUI();
      document.getElementById('dog').setAttribute('data-emotion', 'neutral');
      document.getElementById('dog-statusText').innerText = 'neutral';

      showView('view-sim');

      // Generar primera frase pidiÃ©ndole a Gemini que inicie la conversaciÃ³n
      appendMessage('system', "Iniciando conexiÃ³n neural con el NPC...");
      
      // Mandamos un trigger oculto al LLM para que tire la primera lÃ­nea respetando su prompt
      llmClient.chat("El usuario acaba de llegar. Tira tu lÃ­nea de diÃ¡logo inicial para empezar el conflicto segÃºn tus reglas. No saludes si eres agresivo.", currentCharacter.prompt)
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
            appendMessage('system', "Error de conexiÃ³n: " + err.message);
        });
  }

  // Enviar mensaje del usuario a Gemini
  async function sendChatMessage() {
      const inputEl = document.getElementById('chat-input-text');
      const text = inputEl.value.trim();
      if(!text) return;

      // AÃ±adir al UI
      appendMessage('user', text);
      inputEl.value = '';

      // Indicador de escribiendo
      const typingInd = document.getElementById('typing-indicator');
      typingInd.style.display = 'block';

      try {
          let reply = await llmClient.chat(text, currentCharacter.prompt);
          
          // Extraer la emociÃ³n detectada por el LLM
          const emotionMatch = reply.match(/\[USER_EMOTION:\s*([a-zA-Z]+)\]/i);
          if (emotionMatch) {
              const detectedEmotion = emotionMatch[1].toLowerCase();
              const validEmotions = ['neutral', 'happy', 'sad', 'angry', 'fear', 'surprise', 'disgust'];
              if(validEmotions.includes(detectedEmotion)) {
                  let pointsChange = 0;
                  let dogEmotion = 'neutral';
                  
                  // LÃ³gica de mapeo de EmociÃ³n a EstrÃ©s y Dog Emotion
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
                  
                  // Si el estrÃ©s es muy alto, domina el estado de la mascota a asustado/llorando
                  if (currentStress >= 80) {
                      dogEmotion = 'sad'; // Llorando de miedo/estrÃ©s
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
      }
  }

  // AÃ±adir globos de chat al HTML
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
      
      // Eliminar las acciones de rol entre asteriscos para no leerlas (ej: *suspiro*, *mirando mal*, etc)
      const cleanText = text.replace(/\*([^\*]+)\*/g, '').trim();
      
      // Si todo el texto eran acciones y quedó vacío, no hace nada
      if (!cleanText) return;
      
      fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: cleanText })
      })
      .then(res => res.json())
      .then(ttsData => {
          if(ttsData.audio_url) {
              const audio = new Audio(ttsData.audio_url + '?t=' + new Date().getTime());
              audio.play();
          }
      })
      .catch(err => console.error("Error TTS:", err));
  }

  // 1. Iniciar grabación al presionar el micrófono
  async function startRecording() {
      if (!voiceModeEnabled) return;
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

      mediaRecorder.start();
  }

  function stopRecording() {
      if(mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  }

  // =========================================================================
  // NAVEGACIÓN Y MENÚS POR VOZ (HUB Y PERSONAJES)
  // =========================================================================
  
  let menuAudioContext = null;
  let menuCurrentMode = null;

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
      }
  }

  // Finalizar manual o abandonar (reinicia vars y apaga camara)
  function endSimulation(skipSave = false) {
      currentCharacter = null;
      if (!skipSave) stopCamera();
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
          toast.innerHTML = `<i class="fas fa-sign-out-alt"></i> <strong>Cerrando SesiÃ³n...</strong> Procesando puntuaciÃ³n final.`;
          setTimeout(() => { 
              toast.style.display = 'none'; 
              showSimulationResults();
          }, 1500);
      }
  }

  function showSimulationResults() {
      // Detener cÃ¡mara si estaba prendida
      stopCamera();
      
      // Actualizar vista de resultados
      document.getElementById('result-stress-score').innerText = `${currentStress}/100`;
      
      let msg = "";
      if (currentStress <= 30) msg = "Â¡Excelente! Manejaste el conflicto con mucha calma.";
      else if (currentStress <= 70) msg = "Estuviste regular. Sentiste un poco de tensiÃ³n, pero manejable.";
      else msg = "El estrÃ©s dominÃ³ la conversaciÃ³n. Recuerda, prioriza tomar descansos.";
      
      document.getElementById('result-stress-message').innerText = msg;
      
      // Transferir la Ãºltima emociÃ³n del perro
      const finalDogEmotion = document.getElementById('dog').getAttribute('data-emotion');
      document.getElementById('result-dog').setAttribute('data-emotion', finalDogEmotion);
      
      // Guardar progreso en el backend
      const lastChatEmotion = currentCharacter ? currentCharacter.emotion : 'neutral'; // AproximaciÃ³n
      const finalCameraEmotion = document.getElementById('sim-cam-emotion') ? document.getElementById('sim-cam-emotion').innerText : 'neutral';
      
      fetch('/save_progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              chat_emotion: lastChatEmotion,
              camera_emotion: finalCameraEmotion,
              pet_emotion: finalDogEmotion,
              stress: currentStress
          })
      }).then(() => {
          updateGlobalScore(); // <--- Actualizar el promedio si se guarda una nueva simulaciÃ³n
      }).catch(err => console.error("Error al guardar progreso:", err));

      currentCharacter = null; 
      showView('view-results'); 
  }

  // =========================================================================
  // CONTROL DE VISTAS
  // =========================================================================
  function showView(targetId) {
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
          placeholder.innerText = 'CÃ¡mara oculta (activo)';
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
      placeholder.innerText = 'CÃ¡mara apagada';
      
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
  // CONFIGURACIÃ“N Y PROGRESO
  // =========================================================================
  function toggleDarkMode() {
      document.body.classList.toggle('dark-theme');
  }

  function changeUiSize(size) {
      document.body.classList.remove('ui-large', 'ui-small', 'ui-normal');
      document.body.classList.add(`ui-${size}`);
  }

  function loadProgress() {
      const tbody = document.getElementById('progress-table-body');
      tbody.innerHTML = '<tr><td colspan="5" style="padding: 20px; text-align: center;">Cargando...</td></tr>';
      
      fetch('/get_progress')
        .then(res => res.json())
        .then(data => {
            if (!data || data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="padding: 20px; text-align: center;">AÃºn no hay historial de progreso. Â¡Empieza una simulaciÃ³n!</td></tr>';
                return;
            }
            tbody.innerHTML = '';
            data.forEach(row => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = "1px solid var(--border-color)";
                tr.innerHTML = `
                    <td style="padding: 12px;">${row.Fecha_Hora}</td>
                    <td style="padding: 12px; text-transform: capitalize;">${row.Emocion_Chat}</td>
                    <td style="padding: 12px; text-transform: capitalize;">${row.Emocion_Camara}</td>
                    <td style="padding: 12px; text-transform: capitalize;">${row.Emocion_Mascota}</td>
                    <td style="padding: 12px;"><strong>${row.Stress}/100</strong></td>
                `;
                tbody.appendChild(tr);
            });
        })
        .catch(err => {
            console.error(err);
            tbody.innerHTML = `<tr><td colspan="5" style="padding: 20px; text-align: center; color: red;">Error al cargar progreso.</td></tr>`;
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