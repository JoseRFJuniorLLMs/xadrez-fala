
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
import './DebugImageModal.css';
import { AnalysisState } from '../types';

interface DebugImageModalProps {
  isOpen: boolean;
  systemPrompt: string | null;
  latestTurnContext: string | null;
  strategy: string | null;
  strategyState: AnalysisState;
  lastImage: string | null;
  onClose: () => void;
}

const DebugImageModal: React.FC<DebugImageModalProps> = ({
  isOpen, systemPrompt, latestTurnContext, strategy, strategyState, lastImage, onClose
}) => {
  const [activeTab, setActiveTab] = useState<'context' | 'image' | 'strategy'>('context');

  if (!isOpen) return null;

  const statusMap: Record<AnalysisState, string> = {
    idle: "Ocioso. Aguardando a vez das Brancas.",
    waiting_opponent: "Aguardando oponente mover...",
    pending: 'Análise em progresso...',
    ready: 'O briefing foi entregue à peça ativa.',
    error: 'Falha ao recuperar análise.'
  };

  return (
    <div className="debug-modal-overlay" onClick={onClose}>
      <div className="debug-modal-content" onClick={e => e.stopPropagation()}>
        <div className="debug-modal-header">
          <h3>Contexto da Conversa</h3>
          <button onClick={onClose} className="close-button" aria-label="Fechar">&times;</button>
        </div>

        <div className="debug-modal-tabs">
          <button
            className={`tab-btn ${activeTab === 'context' ? 'active' : ''}`}
            onClick={() => setActiveTab('context')}>
            Contexto de Texto
          </button>
          <button
            className={`tab-btn ${activeTab === 'strategy' ? 'active' : ''}`}
            onClick={() => setActiveTab('strategy')}>
            Estratégia
          </button>
          <button
            className={`tab-btn ${activeTab === 'image' ? 'active' : ''}`}
            onClick={() => setActiveTab('image')}
            disabled={!lastImage}>
            Última Imagem Enviada
          </button>
        </div>

        <div className="debug-modal-body">
          {activeTab === 'context' && (
            <>
              <div className="prompt-section">
                <h4>Prompt de Sistema</h4>
                <pre>{systemPrompt || 'Nenhum prompt de sistema disponível.'}</pre>
              </div>
              <div className="prompt-section">
                <h4>Contexto da Última Jogada</h4>
                <pre>{latestTurnContext || 'Nenhum contexto disponível. Inicie uma conversa com uma peça primeiro.'}</pre>
              </div>
            </>
          )}
          {activeTab === 'strategy' && (
            <div className="prompt-section">
              <h4>Briefing do Consultor Estratégico</h4>
              <p className={`status-text ${strategyState}`}>
                <strong>Status:</strong> {statusMap[strategyState]}
              </p>
              <pre>{strategy || 'Nenhuma análise disponível.'}</pre>
            </div>
          )}
          {activeTab === 'image' && (
            <div className="image-section">
              {lastImage ? (
                <img src={lastImage} alt="Último estado do tabuleiro enviado ao modelo" />
              ) : (
                <p>Nenhuma imagem foi enviada ainda.</p>
              )}
            </div>
          )}
        </div>
        <div className="debug-modal-footer">
          <button className="ok-btn" onClick={onClose}>OK</button>
        </div>
      </div>
    </div>
  );
};

export default DebugImageModal;
