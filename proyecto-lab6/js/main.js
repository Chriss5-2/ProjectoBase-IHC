// ============================================
// Constelaciones de Habilidades Sociales 3D
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
        a: 3,
        b: 0.25,
        zSeparation: 10
    },
    camera: {
        fov: 60,
        near: 0.1,
        far: 1000,
        initialPos: [0, 20, 80]
    },
    colors: {
        escenario:  0xe74c3c,   // rojo
        habilidad:  0x3498db,   // azul
        emocion:    0xf39c12,   // naranja
        estrategia: 0x2ecc71,   // verde
        default: 0xffffff,
        connection: 0x88ccff,
        background: 0x0a0e27
    }
};

// ============================================
// CLASE PRINCIPAL
// ============================================
class SocialSkillsApp {
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
        this._pendingCharacter = null;

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

    showApiKeyModal(forceOpen = false) {
        const modal = document.getElementById('api-key-modal');
        const input = document.getElementById('api-key-input');

        const savedKey = localStorage.getItem('gemini_api_key');

        // Pre-fill with existing key so user can see/confirm it
        input.value = savedKey || '';
        input.style.borderColor = '';
        modal.classList.remove('hidden');

        // Clone buttons to prevent duplicate listeners on repeated opens
        const oldSave = document.getElementById('btn-save-key');
        const oldSkip = document.getElementById('btn-skip-key');
        const saveBtn = oldSave.cloneNode(true);
        const skipBtn = oldSkip.cloneNode(true);
        oldSave.replaceWith(saveBtn);
        oldSkip.replaceWith(skipBtn);

        saveBtn.addEventListener('click', () => {
            const key = input.value.trim();
            if (!key) { input.style.borderColor = '#e74c3c'; return; }
            this.apiKey = key;
            this.llm = new LLMClient(this.apiKey);
            localStorage.setItem('gemini_api_key', key);
            modal.classList.add('hidden');
            if (this._pendingCharacter) {
                const pending = this._pendingCharacter;
                this._pendingCharacter = null;
                this.openChat(pending);
            }
        });

        skipBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
            this._pendingCharacter = null;
        });
    }

    // ============================================
    // ESCENA THREE.JS
    // ============================================
    setupScene() {
        const container = document.getElementById('canvas-container');
        const width = container.clientWidth;
        const height = container.clientHeight;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(CONFIG.colors.background);
        this.scene.fog = new THREE.FogExp2(CONFIG.colors.background, 0.008);

        this.camera = new THREE.PerspectiveCamera(
            CONFIG.camera.fov,
            width / height,
            CONFIG.camera.near,
            CONFIG.camera.far
        );
        this.camera.position.set(...CONFIG.camera.initialPos);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(CONFIG.colors.background);
        container.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 10;
        this.controls.maxDistance = 200;
        this.controls.autoRotate = true;
        this.controls.autoRotateSpeed = 0.3;

        this.setupLighting();
        this.createStarfield();
        this.createSpiralGuide();
    }

    setupLighting() {
        const ambient = new THREE.AmbientLight(0x404060, 0.4);
        this.scene.add(ambient);

        const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
        mainLight.position.set(50, 50, 50);
        this.scene.add(mainLight);

        const fillLight = new THREE.DirectionalLight(0x4444aa, 0.3);
        fillLight.position.set(-50, 20, -50);
        this.scene.add(fillLight);

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
            positions[i3]     = (Math.random() - 0.5) * 600;
            positions[i3 + 1] = (Math.random() - 0.5) * 600;
            positions[i3 + 2] = (Math.random() - 0.5) * 600;

            const starType = Math.random();
            if (starType < 0.7) {
                colors[i3] = 0.9; colors[i3+1] = 0.9; colors[i3+2] = 1.0;
            } else if (starType < 0.9) {
                colors[i3] = 1.0; colors[i3+1] = 0.9; colors[i3+2] = 0.7;
            } else {
                colors[i3] = 1.0; colors[i3+1] = 0.7; colors[i3+2] = 0.5;
            }
        }

        starsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        starsGeometry.setAttribute('color',    new THREE.BufferAttribute(colors, 3));

        const starsMaterial = new THREE.PointsMaterial({
            size: 0.5, vertexColors: true, transparent: true, opacity: 0.8, sizeAttenuation: true
        });

        this.scene.add(new THREE.Points(starsGeometry, starsMaterial));
    }

    createSpiralGuide() {
        const points = [];
        const turns = 5;
        const pointsPerTurn = 60;
        const { a, b } = CONFIG.spiral;

        for (let i = 0; i <= turns * pointsPerTurn; i++) {
            const t = i / pointsPerTurn;
            const angle = t * 2 * Math.PI;
            const r = a * Math.exp(b * t);
            points.push(new THREE.Vector3(r * Math.cos(angle), r * Math.sin(angle), 0));
        }

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: 0x333355, transparent: true, opacity: 0.3 });
        this.scene.add(new THREE.Line(geometry, material));
    }

    // ============================================
    // CONVERSIÓN DE COORDENADAS
    // El campo "año" = nivel de complejidad (0-12)
    // Se mapea a la espiral: t = año * 0.38 → 4.5 vueltas para año=12
    // ============================================
    historicalToPosition(nivel, category, importance) {
        const t = nivel * 0.38;
        const angle = t * 2 * Math.PI;
        const { a, b, zSeparation } = CONFIG.spiral;
        const r = a * Math.exp(b * t);

        const x = r * Math.cos(angle);
        const y = r * Math.sin(angle);
        const z = this.categoryIndex(category) * zSeparation - 15;

        return new THREE.Vector3(x, y, z);
    }

    categoryIndex(category) {
        const categories = ['emocion', 'estrategia', 'habilidad', 'escenario'];
        return Math.max(0, categories.indexOf(category));
    }

    getCategoryColor(category) {
        return CONFIG.colors[category] || CONFIG.colors.default;
    }

    // ============================================
    // CARGA DE DATOS Y CREACIÓN DE NODOS
    // ============================================
    loadData() {
        historicalData.events.forEach(event => this.createNode(event));
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
        mesh.userData = { ...eventData, originalScale: 1, baseRadius, originalColor: color };

        this.scene.add(mesh);
        this.nodes.push(mesh);

        this.createGlow(mesh, color, baseRadius);
        this.createRing(mesh, color, baseRadius);
        this.createLabel(mesh, eventData.nombre, eventData.categoria);

        return mesh;
    }

    createGlow(parentMesh, color, baseRadius) {
        const glow = new THREE.Mesh(
            new THREE.SphereGeometry(baseRadius * 2, 32, 32),
            new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.1 })
        );
        glow.name = 'glow';
        parentMesh.add(glow);
    }

    createRing(parentMesh, color, baseRadius) {
        const ring = new THREE.Mesh(
            new THREE.RingGeometry(baseRadius * 1.3, baseRadius * 1.5, 32),
            new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.2, side: THREE.DoubleSide })
        );
        ring.name = 'ring';
        ring.rotation.x = Math.PI / 2;
        parentMesh.add(ring);
    }

    createLabel(parentMesh, name, categoria) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 64;

        context.fillStyle = 'rgba(0, 0, 0, 0.6)';
        context.roundRect(0, 0, 256, 64, 8);
        context.fill();

        context.font = 'bold 16px Arial';
        context.fillStyle = '#ffffff';
        context.textAlign = 'center';
        context.fillText(name, 128, 26);

        context.font = '12px Arial';
        context.fillStyle = '#aaccff';
        context.fillText(categoria.charAt(0).toUpperCase() + categoria.slice(1), 128, 48);

        const texture = new THREE.CanvasTexture(canvas);
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.85 }));
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
        const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        mid.z += 6;

        const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
        const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(60));
        const material = new THREE.LineBasicMaterial({
            color: CONFIG.colors.connection, transparent: true, opacity: 0.0
        });

        const line = new THREE.Line(geometry, material);
        line.name = 'connection';
        this.scene.add(line);
        this.connections.push({ source: nodeA, target: nodeB, mesh: line, curve });
    }

    updateConnectionsVisibility() {
        this.connections.forEach(conn => {
            if (this.showAllConnections) {
                conn.mesh.material.opacity = 0.4;
                return;
            }
            const minDist = Math.min(
                this.camera.position.distanceTo(conn.source.position),
                this.camera.position.distanceTo(conn.target.position)
            );
            conn.mesh.material.opacity = minDist < 30 ? Math.min(0.6, (30 - minDist) / 20) : 0;
        });
    }

    // ============================================
    // INTERACCIÓN
    // ============================================
    setupInteraction() {
        const canvas = this.renderer.domElement;
        canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        canvas.addEventListener('click',     (e) => this.onClick(e));
        canvas.addEventListener('mousedown', () => { this.controls.autoRotate = false; });
    }

    onMouseMove(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x =  ((event.clientX - rect.left) / rect.width)  * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top)  / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.nodes);
        const tooltip = document.getElementById('tooltip');

        if (intersects.length > 0) {
            const node = intersects[0].object;
            const data = node.userData;

            if (this.hoveredNode !== node) {
                this.unhoverNode();
                this.hoverNode(node);
                this.hoveredNode = node;
            }

            tooltip.classList.remove('hidden');
            tooltip.innerHTML = `
                <div class="tooltip-name">${data.nombre}</div>
                <div class="tooltip-year">${data.categoria.charAt(0).toUpperCase() + data.categoria.slice(1)} · Complejidad ${data.importancia}/10</div>
                <div class="tooltip-summary">${data.resumen.substring(0, 100)}...</div>
            `;
            tooltip.style.left = (event.clientX + 15) + 'px';
            tooltip.style.top  = (event.clientY + 15) + 'px';
            this.renderer.domElement.style.cursor = 'pointer';
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
        if (ring) { ring.material.opacity = 0.5; ring.rotation.x = this.animationTime * 2; }
    }

    unhoverNode() {
        if (!this.hoveredNode) return;
        this.hoveredNode.scale.setScalar(1);
        this.hoveredNode.material.emissiveIntensity = 0.5;
        const glow = this.hoveredNode.getObjectByName('glow');
        if (glow) glow.material.opacity = 0.1;
        const ring = this.hoveredNode.getObjectByName('ring');
        if (ring) { ring.material.opacity = 0.2; ring.rotation.x = Math.PI / 2; }
    }

    onClick(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width)  * 2 - 1,
            -((event.clientY - rect.top)  / rect.height) * 2 + 1
        );
        this.raycaster.setFromCamera(mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.nodes);
        if (intersects.length > 0) this.selectNode(intersects[0].object);
        else this.deselectNode();
    }

    selectNode(node) {
        this.selectedNode = node;
        const data = node.userData;

        const infoPanel = document.getElementById('info-panel');
        infoPanel.classList.remove('hidden');

        document.getElementById('info-title').textContent   = data.nombre;
        document.getElementById('info-year').textContent    = `Nivel de complejidad: ${data.importancia}/10`;
        document.getElementById('info-summary').textContent = data.resumen;

        const catEl = document.getElementById('info-category');
        const catColor = this.getCategoryColor(data.categoria);
        const hex = catColor.toString(16).padStart(6, '0');
        catEl.textContent    = data.categoria.toUpperCase();
        catEl.style.background = `#${hex}33`;
        catEl.style.color      = `#${hex}`;

        const chatBtn = document.getElementById('btn-chat');
        if (data.prompt_personaje) {
            chatBtn.style.display = 'block';
            chatBtn.onclick = () => this.openChat(data);
        } else {
            chatBtn.style.display = 'none';
        }

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

        const startPos    = this.camera.position.clone();
        const startTarget = this.controls.target.clone();
        let progress = 0;

        const animateCamera = () => {
            progress += 0.03;
            if (progress >= 1) { this.controls.target.copy(node.position); return; }
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
        // Add API Key button to header
        const apiKeyBtn = document.createElement('button');
        apiKeyBtn.className = 'control-btn';
        apiKeyBtn.textContent = 'API Key';
        apiKeyBtn.title = 'Cambiar clave de API de Gemini';
        apiKeyBtn.addEventListener('click', () => this.showApiKeyModal(true));
        document.getElementById('controls').prepend(apiKeyBtn);

        document.getElementById('btn-connections').addEventListener('click', (e) => {
            this.showAllConnections = !this.showAllConnections;
            e.target.classList.toggle('active');
            e.target.textContent = this.showAllConnections ? 'Ocultar Conexiones' : 'Ver Conexiones';
        });

        document.getElementById('btn-reset').addEventListener('click', () => {
            this.camera.position.set(...CONFIG.camera.initialPos);
            this.controls.target.set(0, 0, 0);
            this.controls.autoRotate = true;
            this.deselectNode();
        });

        document.getElementById('filter-category').addEventListener('change', (e) => {
            this.filterByCategory(e.target.value);
        });

        document.getElementById('search-node').addEventListener('input', (e) => {
            this.searchNodes(e.target.value);
        });

        document.getElementById('info-close').addEventListener('click', () => this.deselectNode());

        document.getElementById('chat-close').addEventListener('click', () => {
            document.getElementById('chat-panel').classList.add('hidden');
            this.currentCharacter = null;
        });

        document.getElementById('chat-send').addEventListener('click',   () => this.sendChatMessage());
        document.getElementById('chat-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendChatMessage();
        });
    }

    filterByCategory(category) {
        this.nodes.forEach(node => {
            const visible = category === 'all' || node.userData.categoria === category;
            node.visible = visible;
            ['glow', 'ring', 'label'].forEach(name => {
                const child = node.getObjectByName(name);
                if (child) child.visible = visible;
            });
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
                          data.categoria.toLowerCase().includes(lowerQuery) ||
                          data.resumen.toLowerCase().includes(lowerQuery);
            node.visible = match;
            ['glow', 'ring', 'label'].forEach(name => {
                const child = node.getObjectByName(name);
                if (child) child.visible = match;
            });
        });
    }

    // ============================================
    // CHAT CON PERSONAJES
    // ============================================
    openChat(characterData) {
        if (!this.apiKey || !this.llm) {
            this._pendingCharacter = characterData;
            this.showApiKeyModal(true);
            return;
        }

        this.currentCharacter = characterData;
        this.llm.clearHistory();

        const chatPanel  = document.getElementById('chat-panel');
        const name       = document.getElementById('chat-name');
        const messages   = document.getElementById('chat-messages');

        document.getElementById('chat-avatar').src = '';
        document.getElementById('chat-avatar').alt = characterData.nombre;
        name.textContent = characterData.nombre;

        // Cerrar panel de info para que el chat sea visible
        document.getElementById('info-panel').classList.add('hidden');

        messages.innerHTML = '';
        this.addMessage('system', `Estás practicando con: <strong>${characterData.nombre}</strong>. ${characterData.resumen}`);
        chatPanel.classList.remove('hidden');
        chatPanel.style.outline = '2px solid #667eea';
        setTimeout(() => { chatPanel.style.outline = ''; }, 1500);

        this.addMessage('loading', 'El personaje está preparándose...');
        this.llm.chatOneShot(
            'Preséntate en una sola oración y comienza la situación de conflicto o entrenamiento directamente.',
            characterData.prompt_personaje,
            0.7
        ).then(response => {
            const loading = messages.querySelector('.loading');
            if (loading) loading.remove();
            this.addMessage('character', response);
        }).catch(err => {
            const loading = messages.querySelector('.loading');
            if (loading) loading.remove();
            this.addMessage('error', `Error: ${err.message}`);
        });
    }

    async sendChatMessage() {
        const input = document.getElementById('chat-input');
        const text  = input.value.trim();
        if (!text || !this.currentCharacter) return;

        this.addMessage('user', text);
        input.value = '';
        this.addMessage('loading', 'Escribiendo...');

        try {
            const response = await this.llm.chat(text, this.currentCharacter.prompt_personaje);
            const loading  = document.querySelector('#chat-messages .loading');
            if (loading) loading.remove();
            this.addMessage('character', response);
        } catch (error) {
            const loading = document.querySelector('#chat-messages .loading');
            if (loading) loading.remove();
            this.addMessage('error', `Error: ${error.message}. Verifique su conexión y API key.`);
        }
    }

    addMessage(type, text) {
        const container = document.getElementById('chat-messages');
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${type}`;
        if (type === 'system') msgDiv.innerHTML = text;
        else msgDiv.textContent = text;
        container.appendChild(msgDiv);
        container.scrollTop = container.scrollHeight;
    }

    // ============================================
    // ANIMACIÓN Y RENDER
    // ============================================
    animate() {
        requestAnimationFrame(() => this.animate());
        this.animationTime = performance.now() * 0.001;
        this.updateConnectionsVisibility();

        this.nodes.forEach((node, i) => {
            const ring = node.getObjectByName('ring');
            if (ring) {
                ring.scale.setScalar(Math.sin(this.animationTime * 2 + i * 0.5) * 0.05 + 1);
                ring.rotation.z += 0.005;
            }
            const glow = node.getObjectByName('glow');
            if (glow) glow.scale.setScalar(Math.sin(this.animationTime * 1.5 + i * 0.3) * 0.02 + 1);
        });

        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    onResize() {
        const container = document.getElementById('canvas-container');
        this.camera.aspect = container.clientWidth / container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(container.clientWidth, container.clientHeight);
    }
}

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    new SocialSkillsApp();
});
