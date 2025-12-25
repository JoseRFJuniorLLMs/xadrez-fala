
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import './TermsModal.css';

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TermsModal: React.FC<TermsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="terms-modal-overlay" onClick={onClose}>
      <div className="terms-modal-content" onClick={e => e.stopPropagation()}>
        <div className="terms-modal-header">
          <h3>Termos e Privacidade</h3>
          <button onClick={onClose} className="close-button" aria-label="Fechar">&times;</button>
        </div>
        <div className="terms-modal-body">
          <p>
            As gravações de suas interações com a Live API e o conteúdo que você compartilha com ela são processados de acordo com os <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noopener noreferrer">Termos Adicionais da API Gemini</a>. Respeite a privacidade de terceiros e peça permissão antes de gravá-los ou incluí-los em um chat ao vivo.
          </p>
        </div>
        <div className="terms-modal-footer">
          <button className="ok-btn" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
};

export default TermsModal;
