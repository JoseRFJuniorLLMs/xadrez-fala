
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { useSettings } from '../contexts/SettingsContext';
import './SettingsModal.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveGameData: () => void;
  onLoadGameData: () => void;
  imagePromptTemplate: string;
  onImagePromptTemplateChange: (newTemplate: string) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSaveGameData,
  onLoadGameData,
  imagePromptTemplate,
  onImagePromptTemplateChange
}) => {
  if (!isOpen) return null;

  const {
    orbBaseDelay,
    setOrbBaseDelay,
    orbWordDelay,
    setOrbWordDelay,
    proactiveGreeting,
    setProactiveGreeting,
    proactiveGreetingTimeout,
    setProactiveGreetingTimeout,
    useStrategicAdvisor,
    setUseStrategicAdvisor,
    sendBoardImage,
    setSendBoardImage,
    handoffDelay,
    setHandoffDelay,
  } = useSettings();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Configurações</h2>
          <button onClick={onClose} className="close-button" aria-label="Fechar configurações">&times;</button>
        </div>
        <div className="modal-body">
          <div className="setting-item-group">
            <h3>Estratégia de IA</h3>
            <div className="setting-item">
              <label htmlFor="strategic-advisor-toggle">Habilitar Consultor Estratégico</label>
              <label className="switch">
                <input
                  id="strategic-advisor-toggle"
                  type="checkbox"
                  checked={useStrategicAdvisor}
                  onChange={(e) => setUseStrategicAdvisor(e.target.checked)}
                />
                <span className="slider round"></span>
              </label>
            </div>
            <p>Usa o Gemini 2.5 Flash em segundo plano para analisar o tabuleiro e fornecer conselhos estratégicos para suas peças. Isso pode resultar em conversas mais inteligentes e perspicazes.</p>
          </div>
          <div className="setting-item-group">
            <h3>Entrada do Modelo</h3>
            <div className="setting-item">
              <label htmlFor="send-board-image-toggle">Enviar Imagem do Tabuleiro</label>
              <label className="switch">
                <input
                  id="send-board-image-toggle"
                  type="checkbox"
                  checked={sendBoardImage}
                  onChange={(e) => setSendBoardImage(e.target.checked)}
                />
                <span className="slider round"></span>
              </label>
            </div>
            <p>Se habilitado, uma captura de tela do tabuleiro é enviada ao modelo no início de cada turno. Desabilitar isso pode melhorar a latência e reduzir o uso de tokens, confiando apenas nos dados do tabuleiro baseados em texto.</p>
          </div>
          <div className="setting-item-group">
            <h3>Fluxo de Conversa</h3>
            <div className="setting-item">
              <label htmlFor="proactive-greeting-toggle">Ativar Saudação Proativa</label>
              <label className="switch">
                <input
                  id="proactive-greeting-toggle"
                  type="checkbox"
                  checked={proactiveGreeting}
                  onChange={(e) => setProactiveGreeting(e.target.checked)}
                />
                <span className="slider round"></span>
              </label>
            </div>
            <p>Se habilitado, uma nota do sistema é enviada para fazer a peça falar primeiro. Se desabilitado, você deve falar primeiro para iniciar a conversa.</p>
            {proactiveGreeting && (
              <div className="setting-item slider-item" style={{ marginTop: '1rem' }}>
                <label htmlFor="proactive-greeting-timeout">Tempo de Espera da Saudação Proativa</label>
                <div className="slider-wrapper">
                  <input
                    id="proactive-greeting-timeout"
                    type="range"
                    min="500"
                    max="10000"
                    step="100"
                    value={proactiveGreetingTimeout}
                    onChange={(e) => setProactiveGreetingTimeout(Number(e.target.value))}
                  />
                  <span>{proactiveGreetingTimeout}ms</span>
                </div>
                <p style={{ marginTop: '0.5rem', marginBottom: 0 }}>O tempo máximo de espera pelo primeiro turno do modelo antes de habilitar o microfone.</p>
              </div>
            )}
            <div className="setting-item slider-item" style={{ marginTop: '1rem' }}>
              <label htmlFor="handoff-delay">Atraso de Buffer de Entrega</label>
              <div className="slider-wrapper">
                <input
                  id="handoff-delay"
                  type="range"
                  min="0"
                  max="2000"
                  step="100"
                  value={handoffDelay}
                  onChange={(e) => setHandoffDelay(Number(e.target.value))}
                />
                <span>{handoffDelay}ms</span>
              </div>
              <p style={{ marginTop: '0.5rem', marginBottom: 0 }}>Tempo extra para esperar após o término da fala antes de trocar de peça.</p>
            </div>
          </div>
          <div className="setting-item-group">
            <h3>Dados do Jogo</h3>
            <p>Salve imagens geradas e personalidades customizadas em um arquivo, ou carregue-as de volta para o jogo.</p>
            <div className="button-group">
              <button onClick={onSaveGameData}>Salvar Dados</button>
              <button onClick={onLoadGameData}>Carregar Dados</button>
            </div>
          </div>

          <div className="setting-item-group">
            <h3>Animação da Orb</h3>
            <div className="setting-item slider-item">
              <label htmlFor="orb-base-delay">Atraso Base de Transcrição</label>
              <div className="slider-wrapper">
                <input
                  id="orb-base-delay"
                  type="range"
                  min="0"
                  max="1000"
                  value={orbBaseDelay}
                  onChange={(e) => setOrbBaseDelay(Number(e.target.value))}
                />
                <span>{orbBaseDelay}ms</span>
              </div>
            </div>
            <div className="setting-item slider-item">
              <label htmlFor="orb-word-delay">Atraso por Palavra de Transcrição</label>
              <div className="slider-wrapper">
                <input
                  id="orb-word-delay"
                  type="range"
                  min="0"
                  max="600"
                  value={orbWordDelay}
                  onChange={(e) => setOrbWordDelay(Number(e.target.value))}
                />
                <span>{orbWordDelay}ms</span>
              </div>
            </div>
          </div>

          <div className="setting-item-group">
            <h3>Geração de Imagem</h3>
            <p>Customize o prompt para os retratos das peças. Use os marcadores: <code>{'{name}'}</code>, <code>{'{type}'}</code>, <code>{'{color}'}</code> e <code>{'{description}'}</code>.</p>
            <textarea
              className="prompt-template-textarea"
              rows={5}
              value={imagePromptTemplate}
              onChange={(e) => onImagePromptTemplateChange(e.target.value)}
              aria-label="Modelo de prompt para geração de imagem"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
