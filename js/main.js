// ============================================
// Constelaciones Históricas 3D - Aplicación Principal
// ============================================

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { LLMClient } from './llm-client.js';
import { historicalData } from './data.js';

// ============================================
// CONFIGURACIÓN GLOBAL
// ============================================
const CONFIG = {
    spiral: {
        a: 3,           // Radio inicial
        b: 0.25,        // Factor de crecimiento
        zSeparation: 10 // Separación entre categorías en eje Z
    },
    camera: {
        fov: 60,
        near: 0.1,
        far: 1000,
        initialPos: [0, 20, 80]
    },
    colors: {
        ciencia: 0x3498db,
        politica: 0xe74c3c,
        arte: 0xf39c12,
        filosofia: 0x9b59b6,
        tecnologia: 0x2ecc71,
        default: 0xffffff,
        connection: 0x88ccff,
        background: 0x0a0e27
    }
};

// ============================================
// CLASE PRINCIPAL
// ============================================
class HistoricalConstellationsApp {
    constructor() {
        this.apiKey = null;
        this.llm = null;
        this.currentCharacter = null;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.nodes = [];
        this.connections = [];
        this.connectionLines = [];
        this.showAllConnections = false;
        this.hoveredNode = null;
        this.selectedNode = null;
        this.animationTime = 0;

        this.init();
    }

    // ============================================
    // INICIALIZACIÓN
    // ============================================
    init() {
        this.showApiKeyModal();
        this.setupScene();
        this.loadData();
        this.setupInteraction();
        this.setupUI();
        this.animate();

        window.addEventListener('resize', () => this.onResize());
    }

    showApiKeyModal() {
        const modal = document.getElementById('api-key-modal');
        const saveBtn = document.getElementById('btn-save-key');
        const skipBtn = document.getElementById('btn-skip-key');
        const input = document.getElementById('api-key-input');

        // Verificar si ya hay una key guardada
        const savedKey = localStorage.getItem('gemini_api_key');
        if (savedKey) {
            this.apiKey = savedKey;
            this.llm = new LLMClient(this.apiKey);
            console.log('Loaded API key from localStorage');
            modal.classList.add('hidden');
            return;
        }

        console.log('No API key found in localStorage, showing modal');
        modal.classList.remove('hidden');

        saveBtn.addEventListener('click', () => {
            const key = input.value.trim();
            if (key) {
                this.apiKey = key;
                this.llm = new LLMClient(this.apiKey);
                localStorage.setItem('gemini_api_key', key);
                console.log('API key saved and LLM initialized');
                modal.classList.add('hidden');
            } else {
                console.warn('API key input is empty');
                input.style.borderColor = '#e74c3c';
            }
        });

        skipBtn.addEventListener('click', () => {
            console.log('User skipped API key configuration (chat will not work)');
            modal.classList.add('hidden');
            // Crear LLM sin API key (modo solo visualización)
            this.llm = new LLMClient('');
            // Importante: no establecer this.apiKey, así el chat mostrará un mensaje
        });
    }

    // ============================================
    // ESCENA THREE.JS
    // ============================================
    setupScene() {
        const container = document.getElementById('canvas-container');
        const width = container.clientWidth;
        const height = container.clientHeight;

        // Escena
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(CONFIG.colors.background);
        this.scene.fog = new THREE.FogExp2(CONFIG.colors.background, 0.008);

        // Cámara
        this.camera = new THREE.PerspectiveCamera(
            CONFIG.camera.fov, 
            width / height, 
            CONFIG.camera.near, 
            CONFIG.camera.far
        );
        this.camera.position.set(...CONFIG.camera.initialPos);
        this.camera.lookAt(0, 0, 0);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(CONFIG.colors.background);
        container.appendChild(this.renderer.domElement);

        // Controles orbitales
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 10;
        this.controls.maxDistance = 200;
        this.controls.autoRotate = true;
        this.controls.autoRotateSpeed = 0.3;

        // Iluminación
        this.setupLighting();

        // Fondo estelar
        this.createStarfield();

        // Espiral guía
        this.createSpiralGuide();
    }

    setupLighting() {
        // Luz ambiental suave
        const ambient = new THREE.AmbientLight(0x404060, 0.4);
        this.scene.add(ambient);

        // Luz principal
        const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
        mainLight.position.set(50, 50, 50);
        this.scene.add(mainLight);

        // Luz de relleno
        const fillLight = new THREE.DirectionalLight(0x4444aa, 0.3);
        fillLight.position.set(-50, 20, -50);
        this.scene.add(fillLight);

        // Luz puntual central
        const pointLight = new THREE.PointLight(0xffffff, 0.5, 150);
        pointLight.position.set(0, 10, 0);
        this.scene.add(pointLight);
    }

    createStarfield() {
        const starsGeometry = new THREE.BufferGeometry();
        const starsCount = 2000;
        const positions = new Float32Array(starsCount * 3);
        const colors = new Float32Array(starsCount * 3);

        for (let i = 0; i < starsCount; i++) {
            const i3 = i * 3;
            positions[i3] = (Math.random() - 0.5) * 600;
            positions[i3 + 1] = (Math.random() - 0.5) * 600;
            positions[i3 + 2] = (Math.random() - 0.5) * 600;

            // Color estelar variado
            const starType = Math.random();
            if (starType < 0.7) {
                colors[i3] = 0.9; colors[i3 + 1] = 0.9; colors[i3 + 2] = 1.0;
            } else if (starType < 0.9) {
                colors[i3] = 1.0; colors[i3 + 1] = 0.9; colors[i3 + 2] = 0.7;
            } else {
                colors[i3] = 1.0; colors[i3 + 1] = 0.7; colors[i3 + 2] = 0.5;
            }
        }

        starsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        starsGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const starsMaterial = new THREE.PointsMaterial({
            size: 0.5,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            sizeAttenuation: true
        });

        const stars = new THREE.Points(starsGeometry, starsMaterial);
        this.scene.add(stars);
    }

    createSpiralGuide() {
        // Línea guía de la espiral (sutil)
        const points = [];
        const turns = 5;
        const pointsPerTurn = 60;
        const { a, b } = CONFIG.spiral;

        for (let i = 0; i <= turns * pointsPerTurn; i++) {
            const t = i / pointsPerTurn;
            const angle = t * 2 * Math.PI;
            const r = a * Math.exp(b * t);
            const x = r * Math.cos(angle);
            const y = r * Math.sin(angle);
            const z = 0;
            points.push(new THREE.Vector3(x, y, z));
        }

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: 0x333355,
            transparent: true,
            opacity: 0.3
        });

        const spiralLine = new THREE.Line(geometry, material);
        this.scene.add(spiralLine);
    }

    // ============================================
    // CONVERSIÓN DE COORDENADAS
    // ============================================
    historicalToPosition(year, category, importance) {
        const centuriesFromOrigin = (year - 1500) / 100;
        const angle = centuriesFromOrigin * 2 * Math.PI;
        const { a, b, zSeparation } = CONFIG.spiral;
        const r = a * Math.exp(b * centuriesFromOrigin);

        const x = r * Math.cos(angle);
        const y = r * Math.sin(angle);
        const z = this.categoryIndex(category) * zSeparation - 20;

        return new THREE.Vector3(x, y, z);
    }

    categoryIndex(category) {
        const categories = ['ciencia', 'filosofia', 'arte', 'politica', 'tecnologia'];
        return Math.max(0, categories.indexOf(category));
    }

    getCategoryColor(category) {
        return CONFIG.colors[category] || CONFIG.colors.default;
    }

    // ============================================
    // CARGA DE DATOS Y CREACIÓN DE NODOS
    // ============================================
    loadData() {
        historicalData.events.forEach(event => {
            this.createNode(event);
        });

        this.createConnections();
    }

    createNode(eventData) {
        const position = this.historicalToPosition(
            eventData.año,
            eventData.categoria,
            eventData.importancia
        );

        const baseRadius = 0.4 + eventData.importancia * 0.12;
        const color = this.getCategoryColor(eventData.categoria);

        // === NODO PRINCIPAL (esfera con emisión) ===
        const geometry = new THREE.SphereGeometry(baseRadius, 32, 32);
        const material = new THREE.MeshPhongMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.5,
            transparent: true,
            opacity: 0.95,
            shininess: 100
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);
        mesh.userData = {
            ...eventData,
            originalScale: 1,
            baseRadius: baseRadius,
            originalColor: color
        };

        this.scene.add(mesh);
        this.nodes.push(mesh);

        // === HALO LUMINOSO ===
        this.createGlow(mesh, color, baseRadius);

        // === ANILLO DECORATIVO ===
        this.createRing(mesh, color, baseRadius);

        // === ETIQUETA DE TEXTO (sprite) ===
        this.createLabel(mesh, eventData.nombre, eventData.año);

        return mesh;
    }

    createGlow(parentMesh, color, baseRadius) {
        const glowGeometry = new THREE.SphereGeometry(baseRadius * 2, 32, 32);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.1
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.name = 'glow';
        parentMesh.add(glow);
    }

    createRing(parentMesh, color, baseRadius) {
        const ringGeometry = new THREE.RingGeometry(
            baseRadius * 1.3,
            baseRadius * 1.5,
            32
        );
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.2,
            side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.name = 'ring';
        ring.rotation.x = Math.PI / 2;
        parentMesh.add(ring);
    }

    createLabel(parentMesh, name, year) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 64;

        context.fillStyle = 'rgba(0, 0, 0, 0.6)';
        context.roundRect(0, 0, 256, 64, 8);
        context.fill();

        context.font = 'bold 18px Arial';
        context.fillStyle = '#ffffff';
        context.textAlign = 'center';
        context.fillText(name, 128, 28);

        context.font = '14px Arial';
        context.fillStyle = '#88ccff';
        context.fillText(year.toString(), 128, 50);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: 0.85
        });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(8, 2, 1);
        sprite.position.y = parentMesh.userData.baseRadius * 3 + 1;
        sprite.name = 'label';
        parentMesh.add(sprite);
    }

    // ============================================
    // CONEXIONES CAUSALES
    // ============================================
    createConnections() {
        this.nodes.forEach(sourceNode => {
            const sourceData = sourceNode.userData;
            if (!sourceData.conexiones || sourceData.conexiones.length === 0) return;

            sourceData.conexiones.forEach(targetId => {
                const targetNode = this.nodes.find(n => n.userData.id === targetId);
                if (!targetNode) return;

                this.createConnectionCurve(sourceNode, targetNode);
            });
        });
    }

    createConnectionCurve(nodeA, nodeB) {
        const start = nodeA.position.clone();
        const end = nodeB.position.clone();

        // Punto de control para arco elevado
        const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        mid.z += 6;

        const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
        const points = curve.getPoints(60);
        const geometry = new THREE.BufferGeometry().setFromPoints(points);

        const material = new THREE.LineBasicMaterial({
            color: CONFIG.colors.connection,
            transparent: true,
            opacity: 0.0 // Inicialmente invisible
        });

        const line = new THREE.Line(geometry, material);
        line.name = 'connection';
        this.scene.add(line);

        this.connections.push({
            source: nodeA,
            target: nodeB,
            mesh: line,
            curve: curve
        });
    }

    updateConnectionsVisibility() {
        this.connections.forEach(conn => {
            if (this.showAllConnections) {
                conn.mesh.material.opacity = 0.4;
                return;
            }

            const distToSource = this.camera.position.distanceTo(conn.source.position);
            const distToTarget = this.camera.position.distanceTo(conn.target.position);
            const minDist = Math.min(distToSource, distToTarget);

            if (minDist < 30) {
                conn.mesh.material.opacity = Math.min(0.6, (30 - minDist) / 20);
            } else {
                conn.mesh.material.opacity = 0.0;
            }
        });
    }

    // ============================================
    // INTERACCIÓN
    // ============================================
    setupInteraction() {
        const canvas = this.renderer.domElement;

        // Mouse move para hover y tooltip
        canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));

        // Click para seleccionar nodo
        canvas.addEventListener('click', (e) => this.onClick(e));

        // Detener rotación auto al interactuar
        canvas.addEventListener('mousedown', () => {
            this.controls.autoRotate = false;
        });
    }

    onMouseMove(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.nodes, true);

        const tooltip = document.getElementById('tooltip');

        if (intersects.length > 0) {
            // Buscar el nodo principal (el que está en this.nodes)
            let node = null;
            for (let intersection of intersects) {
                if (this.nodes.includes(intersection.object)) {
                    node = intersection.object;
                    break;
                }
                // Si es un child, buscar el padre que está en this.nodes
                if (intersection.object.parent && this.nodes.includes(intersection.object.parent)) {
                    node = intersection.object.parent;
                    break;
                }
            }

            if (node && node.userData) {
                const data = node.userData;

                // Validar que los datos necesarios existan
                if (!data.nombre || !data.año || !data.resumen) {
                    console.warn('Incomplete node data:', data);
                    tooltip.classList.add('hidden');
                    return;
                }

                // Hover effect
                if (this.hoveredNode !== node) {
                    this.unhoverNode();
                    this.hoverNode(node);
                    this.hoveredNode = node;
                }

                // Tooltip
                tooltip.classList.remove('hidden');
                tooltip.innerHTML = `
                    <div class="tooltip-name">${data.nombre}</div>
                    <div class="tooltip-year">${data.año}</div>
                    <div class="tooltip-summary">${data.resumen.substring(0, 100)}...</div>
                `;
                tooltip.style.left = (event.clientX + 15) + 'px';
                tooltip.style.top = (event.clientY + 15) + 'px';

                this.renderer.domElement.style.cursor = 'pointer';
            } else {
                this.unhoverNode();
                this.hoveredNode = null;
                tooltip.classList.add('hidden');
                this.renderer.domElement.style.cursor = 'default';
            }
        } else {
            this.unhoverNode();
            this.hoveredNode = null;
            tooltip.classList.add('hidden');
            this.renderer.domElement.style.cursor = 'default';
        }
    }

    hoverNode(node) {
        node.scale.setScalar(1.4);
        node.material.emissiveIntensity = 0.9;

        const glow = node.getObjectByName('glow');
        if (glow) glow.material.opacity = 0.25;

        const ring = node.getObjectByName('ring');
        if (ring) {
            ring.material.opacity = 0.5;
            ring.rotation.x = this.animationTime * 2;
        }
    }

    unhoverNode() {
        if (!this.hoveredNode) return;

        this.hoveredNode.scale.setScalar(1);
        this.hoveredNode.material.emissiveIntensity = 0.5;

        const glow = this.hoveredNode.getObjectByName('glow');
        if (glow) glow.material.opacity = 0.1;

        const ring = this.hoveredNode.getObjectByName('ring');
        if (ring) {
            ring.material.opacity = 0.2;
            ring.rotation.x = Math.PI / 2;
        }
    }

    onClick(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );

        this.raycaster.setFromCamera(mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.nodes, true);

        if (intersects.length > 0) {
            // Buscar el nodo principal (el que está en this.nodes)
            let selectedNode = null;
            for (let intersection of intersects) {
                if (this.nodes.includes(intersection.object)) {
                    selectedNode = intersection.object;
                    break;
                }
                // Si es un child, buscar el padre que está en this.nodes
                if (intersection.object.parent && this.nodes.includes(intersection.object.parent)) {
                    selectedNode = intersection.object.parent;
                    break;
                }
            }

            if (selectedNode && selectedNode.userData) {
                console.log('Selected node:', selectedNode.userData.nombre);
                this.selectNode(selectedNode);
            }
        } else {
            this.deselectNode();
        }
    }

    selectNode(node) {
        if (!node || !node.userData) {
            console.error('Invalid node:', node);
            return;
        }

        this.selectedNode = node;
        const data = node.userData;

        // Validar que los datos necesarios existan
        if (!data.nombre || !data.año || !data.categoria) {
            console.error('Incomplete node data:', data);
            return;
        }

        // Mostrar panel de info
        const infoPanel = document.getElementById('info-panel');
        infoPanel.classList.remove('hidden');

        document.getElementById('info-title').textContent = data.nombre;
        document.getElementById('info-year').textContent = `Año: ${data.año}`;
        document.getElementById('info-summary').textContent = data.resumen || 'Sin descripción';

        const catEl = document.getElementById('info-category');
        catEl.textContent = data.categoria.toUpperCase();
        catEl.style.background = '#' + this.getCategoryColor(data.categoria).toString(16).padStart(6, '0') + '33';
        catEl.style.color = '#' + this.getCategoryColor(data.categoria).toString(16).padStart(6, '0');

        // Configurar botón de chat
        const chatBtn = document.getElementById('btn-chat');
        if (data.prompt_personaje) {
            chatBtn.style.display = 'block';
            // Remover listeners anteriores
            const newChatBtn = chatBtn.cloneNode(true);
            chatBtn.parentNode.replaceChild(newChatBtn, chatBtn);
            
            // Agregar nuevo listener
            const newBtn = document.getElementById('btn-chat');
            newBtn.addEventListener('click', () => {
                console.log('Chat button clicked for:', data.nombre);
                this.openChat(data);
            });
        } else {
            chatBtn.style.display = 'none';
        }

        // Animar cámara hacia el nodo
        this.focusCameraOnNode(node);
    }

    deselectNode() {
        this.selectedNode = null;
        document.getElementById('info-panel').classList.add('hidden');
    }

    focusCameraOnNode(node) {
        const targetPos = node.position.clone();
        targetPos.z += 30;
        targetPos.y += 15;

        // Animación simple de cámara
        const startPos = this.camera.position.clone();
        const startTarget = this.controls.target.clone();
        let progress = 0;

        const animateCamera = () => {
            progress += 0.03;
            if (progress >= 1) {
                this.controls.target.copy(node.position);
                return;
            }

            const ease = 1 - Math.pow(1 - progress, 3);
            this.camera.position.lerpVectors(startPos, targetPos, ease);
            this.controls.target.lerpVectors(startTarget, node.position, ease);
            requestAnimationFrame(animateCamera);
        };

        animateCamera();
    }

    // ============================================
    // UI CONTROLES
    // ============================================
    setupUI() {
        // Botón de conexiones
        document.getElementById('btn-connections').addEventListener('click', (e) => {
            this.showAllConnections = !this.showAllConnections;
            e.target.classList.toggle('active');
            e.target.textContent = this.showAllConnections ? 'Ocultar Conexiones' : 'Ver Conexiones';
        });

        // Botón reset
        document.getElementById('btn-reset').addEventListener('click', () => {
            this.camera.position.set(...CONFIG.camera.initialPos);
            this.controls.target.set(0, 0, 0);
            this.controls.autoRotate = true;
            this.deselectNode();
        });

        // Filtro por categoría
        document.getElementById('filter-category').addEventListener('change', (e) => {
            this.filterByCategory(e.target.value);
        });

        // Búsqueda
        document.getElementById('search-node').addEventListener('input', (e) => {
            this.searchNodes(e.target.value);
        });

        // Cerrar info panel
        document.getElementById('info-close').addEventListener('click', () => {
            this.deselectNode();
        });

        // Chat panel
        document.getElementById('chat-close').addEventListener('click', () => {
            document.getElementById('chat-panel').classList.add('hidden');
            this.currentCharacter = null;
        });

        document.getElementById('chat-send').addEventListener('click', () => {
            this.sendChatMessage();
        });

        document.getElementById('chat-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendChatMessage();
        });
    }

    filterByCategory(category) {
        this.nodes.forEach(node => {
            const data = node.userData;
            if (category === 'all' || data.categoria === category) {
                node.visible = true;
                const glow = node.getObjectByName('glow');
                const ring = node.getObjectByName('ring');
                const label = node.getObjectByName('label');
                if (glow) glow.visible = true;
                if (ring) ring.visible = true;
                if (label) label.visible = true;
            } else {
                node.visible = false;
                const glow = node.getObjectByName('glow');
                const ring = node.getObjectByName('ring');
                const label = node.getObjectByName('label');
                if (glow) glow.visible = false;
                if (ring) ring.visible = false;
                if (label) label.visible = false;
            }
        });
    }

    searchNodes(query) {
        if (!query.trim()) {
            this.filterByCategory(document.getElementById('filter-category').value);
            return;
        }

        const lowerQuery = query.toLowerCase();
        this.nodes.forEach(node => {
            const data = node.userData;
            const match = data.nombre.toLowerCase().includes(lowerQuery) ||
                         data.año.toString().includes(lowerQuery);

            node.visible = match;
            const glow = node.getObjectByName('glow');
            const ring = node.getObjectByName('ring');
            const label = node.getObjectByName('label');
            if (glow) glow.visible = match;
            if (ring) ring.visible = match;
            if (label) label.visible = match;
        });
    }

    // ============================================
    // SISTEMA DE CHAT CON PERSONAJES
    // ============================================
    openChat(characterData) {
        console.log('openChat called with:', characterData?.nombre);
        console.log('API Key exists:', !!this.apiKey);
        console.log('LLM instance exists:', !!this.llm);

        if (!this.apiKey) {
            const message = 'Para usar el chat necesitas una API key de Google Gemini.\n\n' +
                          '1. Recarga la página\n' +
                          '2. Obtén una API key gratis en: https://aistudio.google.com/app/apikey\n' +
                          '3. Ingresa la key en el formulario que aparecerá';
            alert(message);
            return;
        }

        if (!this.llm) {
            alert('Error: LLM no está inicializado. Recarga la página.');
            return;
        }

        try {
            this.currentCharacter = characterData;
            this.currentCharacterPrompt = `${characterData.prompt_personaje}\n\nINSTRUCCIÓN DE LONGITUD: responde de forma breve, con 2 a 4 frases como máximo. Evita párrafos largos y listas extensas.`;
            this.llm.clearHistory();

            const chatPanel = document.getElementById('chat-panel');
            const avatar = document.getElementById('chat-avatar');
            const name = document.getElementById('chat-name');
            const messages = document.getElementById('chat-messages');

            avatar.src = characterData.avatar;
            avatar.alt = characterData.nombre;
            name.textContent = `${characterData.nombre} (${characterData.año})`;

            messages.innerHTML = '';
            this.addMessage('system', `Estás conversando con **${characterData.nombre}**. ${characterData.resumen}`);

            chatPanel.classList.remove('hidden');

            // Mensaje de bienvenida del personaje
            this.addMessage('loading', 'El personaje está preparándose...');
            this.llm.chatOneShot(
                "Preséntate brevemente (máximo 2 oraciones) a quien te visita desde el futuro.",
                this.currentCharacterPrompt,
                0.7
            ).then(response => {
                const loading = messages.querySelector('.loading');
                if (loading) loading.remove();
                this.addMessage('character', response);
            }).catch(err => {
                console.error('Error in chatOneShot:', err);
                const loading = messages.querySelector('.loading');
                if (loading) loading.remove();
                this.addMessage('error', `Error: ${err.message}`);
            });
        } catch (error) {
            console.error('Error in openChat:', error);
            alert('Error al abrir el chat: ' + error.message);
        }
    }

    async sendChatMessage() {
        const input = document.getElementById('chat-input');
        const text = input.value.trim();

        if (!text || !this.currentCharacter) {
            console.warn('sendChatMessage: missing text or currentCharacter');
            return;
        }

        // Mostrar mensaje del usuario
        this.addMessage('user', text);
        input.value = '';

        // Mostrar indicador de carga
        this.addMessage('loading', 'Escribiendo...');

        try {
            const response = await this.llm.chat(
                text,
                this.currentCharacterPrompt || this.currentCharacter.prompt_personaje
            );

            // Reemplazar indicador con respuesta
            const loading = document.querySelector('#chat-messages .loading');
            if (loading) loading.remove();

            this.addMessage('character', response);
        } catch (error) {
            console.error('Error in sendChatMessage:', error);
            const loading = document.querySelector('#chat-messages .loading');
            if (loading) loading.remove();

            this.addMessage('error', `Error: ${error.message}`);
        }
    }

    addMessage(type, text) {
        const messagesContainer = document.getElementById('chat-messages');
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${type}`;

        if (type === 'system') {
            msgDiv.innerHTML = text;
        } else {
            msgDiv.textContent = text;
        }

        messagesContainer.appendChild(msgDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // ============================================
    // ANIMACIÓN Y RENDER
    // ============================================
    animate() {
        requestAnimationFrame(() => this.animate());

        this.animationTime = performance.now() * 0.001;

        // Actualizar visibilidad de conexiones
        this.updateConnectionsVisibility();

        // Animar nodos (pulso)
        this.nodes.forEach((node, i) => {
            const pulse = Math.sin(this.animationTime * 2 + i * 0.5) * 0.05 + 1;
            const ring = node.getObjectByName('ring');
            if (ring) {
                ring.scale.setScalar(pulse);
                ring.rotation.z += 0.005;
            }

            // Animar glow
            const glow = node.getObjectByName('glow');
            if (glow) {
                const glowPulse = Math.sin(this.animationTime * 1.5 + i * 0.3) * 0.02 + 1;
                glow.scale.setScalar(glowPulse);
            }
        });

        // Actualizar controles
        this.controls.update();

        // Render
        this.renderer.render(this.scene, this.camera);
    }

    onResize() {
        const container = document.getElementById('canvas-container');
        const width = container.clientWidth;
        const height = container.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }
}

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    new HistoricalConstellationsApp();
});
