import React from 'react';
import './VoiceInstructions.css';

const VoiceInstructions: React.FC = () => {
    return (
        <div className="voice-instructions">
            <h3>Diga para as suas peças:</h3>
            <div className="instructions-grid">
                <div className="instruction-item">
                    <span className="command">"Vá para e4"</span>
                    <p>Para mover a peça selecionada.</p>
                </div>
                <div className="instruction-item">
                    <span className="command">"Chame a Amazona em g1"</span>
                    <p>Para trocar a conversa entre peças aliadas.</p>
                </div>
                <div className="instruction-item">
                    <span className="command">"Qual a estratégia?"</span>
                    <p>Peça conselhos sobre a melhor jogada.</p>
                </div>
                <div className="instruction-item">
                    <span className="command">"Onde estamos?"</span>
                    <p>Para confirmar a posição da peça no tabuleiro.</p>
                </div>
            </div>
        </div>
    );
};

export default VoiceInstructions;
