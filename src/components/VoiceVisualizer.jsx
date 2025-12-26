import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { vs as sphereVS } from './sphere-shader';

// Função auxiliar pra calcular intensidade média do áudio (0-1)
// Mantemos para compatibilidade, mas o loop principal usará os arrays diretos
const getAnalyserIntensity = (analyser) => {
    if (!analyser) return 0;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
    }
    return sum / dataArray.length / 255;
};

const VoiceVisualizer = ({ inputAnalyser, outputAnalyser, isActive }) => {
    const mountRef = useRef(null);
    const rendererRef = useRef(null);
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const sphereRef = useRef(null);
    const frameRef = useRef(null);

    // Refs for animation state
    const prevTimeRef = useRef(performance.now());
    const rotationRef = useRef(new THREE.Vector3(0, 0, 0));

    // Refs para os anéis
    const ring1Ref = useRef(null);
    const ring2Ref = useRef(null);
    const ring3Ref = useRef(null);

    useEffect(() => {
        if (!mountRef.current || !isActive) return;

        // --- Scene Setup ---
        const scene = new THREE.Scene();
        scene.background = null;
        sceneRef.current = scene;

        const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
        camera.position.set(0, 0, 1.8); // Zoomed in to fill 300px canvas
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
        renderer.setSize(300, 300);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.toneMapping = THREE.ReinhardToneMapping;

        // Força explicitamente o estilo do canvas
        renderer.domElement.style.background = 'transparent';
        renderer.domElement.style.borderRadius = '50%';

        rendererRef.current = renderer;
        mountRef.current.appendChild(renderer.domElement);

        // --- Environment ---
        const pmremGenerator = new THREE.PMREMGenerator(renderer);
        pmremGenerator.compileEquirectangularShader();
        const roomEnvironment = new RoomEnvironment();
        scene.environment = pmremGenerator.fromScene(roomEnvironment).texture;
        roomEnvironment.dispose();

        // --- Geometry & Material (GDM Exact Config) ---
        const geometry = new THREE.IcosahedronGeometry(1, 10);

        const sphereMaterial = new THREE.MeshStandardMaterial({
            color: 0xff1493, // ROSA (DeepPink)
            metalness: 0.5,
            roughness: 0.1,
            emissive: 0xff69b4, // ROSA CLARO (HotPink) para emissão
            emissiveIntensity: 1.5,
        });

        sphereMaterial.onBeforeCompile = (shader) => {
            shader.uniforms.time = { value: 0 };
            shader.uniforms.inputData = { value: new THREE.Vector4() };
            shader.uniforms.outputData = { value: new THREE.Vector4() };

            sphereMaterial.userData.shader = shader;
            shader.vertexShader = sphereVS;
        };

        const sphere = new THREE.Mesh(geometry, sphereMaterial);
        scene.add(sphere);
        sphereRef.current = sphere;

        // --- Anéis de Saturno (3 anéis rosa bem finos e brilhosos) ---
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0xff1493, // ROSA (DeepPink) - mesma cor da esfera
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.9, // Opacidade alta para mais brilho
            emissive: 0xff69b4, // ROSA CLARO (HotPink) para emissão
            emissiveIntensity: 2.0, // Intensidade do brilho
        });

        // Anel 1: Horizontal
        const ringGeometry1 = new THREE.RingGeometry(1.5, 1.52, 64);
        const ring1 = new THREE.Mesh(ringGeometry1, ringMaterial.clone());
        ring1.rotation.x = Math.PI / 2; // Horizontal
        scene.add(ring1);
        ring1Ref.current = ring1;

        // Anel 2: Vertical/Diagonal
        const ringGeometry2 = new THREE.RingGeometry(1.5, 1.52, 64);
        const ring2 = new THREE.Mesh(ringGeometry2, ringMaterial.clone());
        ring2.rotation.x = Math.PI / 3; // 60 graus
        ring2.rotation.y = Math.PI / 4; // 45 graus diagonal
        scene.add(ring2);
        ring2Ref.current = ring2;

        // Anel 3: Outra diagonal
        const ringGeometry3 = new THREE.RingGeometry(1.5, 1.52, 64);
        const ring3 = new THREE.Mesh(ringGeometry3, ringMaterial.clone());
        ring3.rotation.x = -Math.PI / 4; // -45 graus
        ring3.rotation.y = -Math.PI / 3; // -60 graus
        scene.add(ring3);
        ring3Ref.current = ring3;

        // --- Animation Loop ---
        const inputDataArray = new Uint8Array(inputAnalyser ? inputAnalyser.frequencyBinCount : 0);
        const outputDataArray = new Uint8Array(outputAnalyser ? outputAnalyser.frequencyBinCount : 0);

        const animate = () => {
            frameRef.current = requestAnimationFrame(animate);

            const t = performance.now();
            const dt = (t - prevTimeRef.current) / (1000 / 60);
            prevTimeRef.current = t;

            // Update Audio Data
            if (inputAnalyser) inputAnalyser.getByteFrequencyData(inputDataArray);
            if (outputAnalyser) outputAnalyser.getByteFrequencyData(outputDataArray);

            const in0 = inputDataArray[0] || 0;
            const in1 = inputDataArray[1] || 0;
            const in2 = inputDataArray[2] || 0;

            const out0 = outputDataArray[0] || 0;
            const out1 = outputDataArray[1] || 0;
            const out2 = outputDataArray[2] || 0;

            if (sphereMaterial.userData.shader) {
                // Scale
                const s = 1 + (0.2 * out1) / 255;
                sphere.scale.set(s, s, s);

                // Rotation calculation
                rotationRef.current.x += (dt * 0.002 * 0.5 * out1) / 255;
                rotationRef.current.z += (dt * 0.002 * 0.5 * in1) / 255;
                rotationRef.current.y += (dt * 0.002 * 0.25 * in2) / 255;
                rotationRef.current.y += (dt * 0.002 * 0.25 * out2) / 255;

                // Camera follow logic
                const euler = new THREE.Euler(
                    rotationRef.current.x,
                    rotationRef.current.y,
                    rotationRef.current.z
                );
                const quaternion = new THREE.Quaternion().setFromEuler(euler);
                const vector = new THREE.Vector3(0, 0, 5);
                vector.applyQuaternion(quaternion);
                camera.position.copy(vector);
                camera.lookAt(sphere.position);

                // Update Uniforms
                sphereMaterial.userData.shader.uniforms.time.value += (dt * 0.1 * out0) / 255 + 0.01;

                sphereMaterial.userData.shader.uniforms.inputData.value.set(
                    (1 * in0) / 255,
                    (0.1 * in1) / 255,
                    (10 * in2) / 255,
                    0
                );
                sphereMaterial.userData.shader.uniforms.outputData.value.set(
                    (2 * out0) / 255,
                    (0.1 * out1) / 255,
                    (10 * out2) / 255,
                    0
                );
            }

            // Animar os anéis (rotação contínua em diferentes direções)
            if (ring1Ref.current) {
                ring1Ref.current.rotation.z += 0.05; // Gira no próprio plano (HORIZONTAL)
            }
            if (ring2Ref.current) {
                ring2Ref.current.rotation.x += 0.04; // Gira no eixo X
                ring2Ref.current.rotation.z += 0.03; // Gira no eixo Z também
            }
            if (ring3Ref.current) {
                ring3Ref.current.rotation.y += 0.05; // Gira no eixo Y
                ring3Ref.current.rotation.z -= 0.02; // Sentido contrário no Z
            }

            // RENDER DIRETO - SEM COMPOSER
            renderer.render(scene, camera);
        };

        animate();

        // Cleanup
        return () => {
            cancelAnimationFrame(frameRef.current);
            if (mountRef.current && renderer.domElement) {
                mountRef.current.removeChild(renderer.domElement);
            }
            geometry.dispose();
            sphereMaterial.dispose();
            ringGeometry1.dispose();
            ringGeometry2.dispose();
            ringGeometry3.dispose();
            ringMaterial.dispose();
            renderer.dispose();
            pmremGenerator.dispose();
        };
    }, [isActive, inputAnalyser, outputAnalyser]);

    return (
        <div
            ref={mountRef}
            style={{
                width: '300px',
                height: '300px',
                display: 'block',
                background: 'transparent',
                borderRadius: '50%',
                overflow: 'hidden',
                margin: '0 auto',
                position: 'relative',
                zIndex: 10
            }}
        />
    );
};

export default VoiceVisualizer;