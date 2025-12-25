
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
import './StrategyConsole.css';
import { AnalysisState, StrategyInjectionStatus } from '../types';

interface StrategyConsoleProps {
  systemPrompt: string | null;
  latestTurnContext: string | null;
  strategy: string | null;
  strategyPrompt: string | null;
  strategyState: AnalysisState;
  injectionStatus: StrategyInjectionStatus;
  turnNumber: number | null;
  lastImage: string | null;
  onRetryAnalysis?: () => void;
}

const StrategyConsole: React.FC<StrategyConsoleProps> = ({
  systemPrompt, latestTurnContext, strategy, strategyPrompt, strategyState, injectionStatus, turnNumber, lastImage, onRetryAnalysis
}) => {
  const [activeTab, setActiveTab] = useState<'strategy' | 'context' | 'image'>('strategy');
  const [showPrompt, setShowPrompt] = useState(false);

  const statusMap: Record<AnalysisState, string> = {
    idle: "Ocioso.",
    waiting_opponent: "Aguardando oponente...",
    pending: 'Analisando tabuleiro...',
    ready: 'Análise pronta.',
    error: 'Falha na análise.'
  };

  const injectionStatusMap: Record<StrategyInjectionStatus, string> = {
    none: '',
    queued: 'Na fila para o PRÓXIMO turno do usuário...',
    sent: 'Enviado para a sessão ativa.'
  };

  return (
    <div className="strategy-console">
      <div className="console-header">
        <h3>Console de Estratégia</h3>
      </div>

      <div className="console-tabs">
        <button
          className={`tab-btn ${activeTab === 'strategy' ? 'active' : ''}`}
          onClick={() => setActiveTab('strategy')}>
          Estratégia
        </button>
        <button
          className={`tab-btn ${activeTab === 'context' ? 'active' : ''}`}
          onClick={() => setActiveTab('context')}>
          Contexto
        </button>
        <button
          className={`tab-btn ${activeTab === 'image' ? 'active' : ''}`}
          onClick={() => setActiveTab('image')}
          disabled={!lastImage}>
          Imagem
        </button>
      </div>

      <div className="console-body">
        {activeTab === 'strategy' && (
          <div className="console-section">
            <div className={`status-text ${strategyState}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span><strong>Status:</strong> {statusMap[strategyState]}</span>
                {turnNumber !== null && <span style={{ opacity: 0.7 }}>Turno {turnNumber}</span>}
              </div>
              {injectionStatus !== 'none' && (
                <div className={`injection-status ${injectionStatus}`}>
                  {injectionStatusMap[injectionStatus]}
                </div>
              )}
            </div>

            {strategyState === 'error' && onRetryAnalysis && (
              <button className="retry-analysis-btn" onClick={onRetryAnalysis} title="Repetir análise estratégica">
                <span className="material-symbols-outlined" style={{ fontSize: '18px', verticalAlign: 'text-bottom', marginRight: '4px' }}>refresh</span>
                Repetir Análise
              </button>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem', marginTop: '0.5rem' }}>
              <button
                style={{
                  background: 'none',
                  border: '1px solid #444',
                  color: '#888',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  cursor: 'pointer'
                }}
                onClick={() => setShowPrompt(!showPrompt)}
              >
                {showPrompt ? 'Mostrar Resultado' : 'Mostrar Prompt'}
              </button>
            </div>
            {showPrompt ? (
              <>
                <h4 style={{ marginBottom: '0.5rem' }}>Prompt de Sistema do Consultor</h4>
                <pre>{strategyPrompt || 'Nenhum prompt gerado ainda.'}</pre>
              </>
            ) : (
              <pre>{strategy || 'Aguardando análise...'}</pre>
            )}
          </div>
        )}
        {activeTab === 'context' && (
          <>
            <div className="console-section">
              <h4>Prompt de Sistema</h4>
              <pre>{systemPrompt || 'Nenhuma conversa ativa.'}</pre>
            </div>
            <div className="console-section">
              <h4>Contexto da Última Jogada</h4>
              <pre>{latestTurnContext || '...'}</pre>
            </div>
          </>
        )}
        {activeTab === 'image' && (
          <div className="image-section">
            {lastImage ? (
              <img src={lastImage} alt="Último estado do tabuleiro enviado ao modelo" />
            ) : (
              <p>Nenhuma imagem capturada ainda.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StrategyConsole;
