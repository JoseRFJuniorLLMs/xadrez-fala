import React from 'react';
import { Mic, MicOff } from 'lucide-react';
import VoiceVisualizer from './VoiceVisualizer';
import { useLiveAPIContext } from '../contexts/LiveAPIProvider';

// Este componente foi reescrito para integrar com o sistema de xadrez existente
const FloatingAssistant = ({ inputAnalyser, outputAnalyser, isRecording, connected, isActive, onToggle }) => {
    // isActive agora vem via props (vincunlado ao isAssistantActive do useAppInteractions)

    return (
        <div
            className="absolute bottom-8 right-8 z-[9999] flex flex-col items-center cursor-pointer"
            onClick={onToggle}
        >
            <div className="relative flex items-center justify-center w-16 h-16">

                {isActive && (
                    <div className="absolute bottom-full mb-2 pointer-events-none transition-all duration-500">
                        <VoiceVisualizer
                            inputAnalyser={inputAnalyser}
                            outputAnalyser={outputAnalyser}
                            isActive={isActive && connected} // Só anima se estiver conectado
                        />
                    </div>
                )}

                {/* Botão Visual Representativo (Interruptor Mestre) */}
                <div
                    className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 ease-out shadow-lg ${isActive
                        ? 'animate-pulse bg-red-500 shadow-red-500/50 scale-110'
                        : 'bg-gradient-to-br from-pink-500 to-purple-600 hover:scale-110 hover:shadow-xl hover:shadow-purple-500/70'
                        } opacity-80`}
                >
                    {isActive ? <Mic className="w-8 h-8 text-white" /> : <MicOff className="w-8 h-8 text-white opacity-50" />}
                </div>
            </div>
        </div>
    );
};

export default FloatingAssistant;