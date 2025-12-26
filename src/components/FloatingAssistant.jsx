import React from 'react';
import { Mic, MicOff } from 'lucide-react';
import VoiceVisualizer from './VoiceVisualizer';
import { useLiveAPIContext } from '../contexts/LiveAPIProvider';

// Este componente foi reescrito para integrar com o sistema de xadrez existente
const FloatingAssistant = ({ inputAnalyser, outputAnalyser, isRecording, connected }) => {
    // Usamos o contexto global já existente no projeto para controlar a conexão
    // e o estado de gravação (isRecording) passado via props do App.tsx

    const isActive = connected || isRecording;

    return (
        <div className="absolute bottom-8 right-8 z-[9999] flex flex-col items-center">
            <div className="relative flex items-center justify-center w-16 h-16">

                {isActive && (
                    <div className="absolute bottom-full mb-2 pointer-events-none transition-all duration-500">
                        <VoiceVisualizer
                            inputAnalyser={inputAnalyser}
                            outputAnalyser={outputAnalyser}
                            isActive={isActive}
                        />
                    </div>
                )}

                {/* Botão Visual Representativo (O controle real é feito clicando nas peças) */}
                <div
                    className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 ease-out shadow-lg ${isActive
                        ? 'animate-pulse bg-red-500 shadow-red-500/50'
                        : 'bg-gradient-to-br from-pink-500 to-purple-600 hover:scale-110 hover:shadow-xl hover:shadow-purple-500/70'
                        } opacity-80`}
                >
                    {isRecording ? <Mic className="w-8 h-8 text-white" /> : <MicOff className="w-8 h-8 text-white opacity-50" />}
                </div>
            </div>
        </div>
    );
};

export default FloatingAssistant;