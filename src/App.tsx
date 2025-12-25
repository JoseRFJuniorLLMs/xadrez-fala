

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useRef, useEffect } from 'react';
import Chessboard from './components/Chessboard';
import SettingsModal from './components/SettingsModal';
import TermsModal from './components/TermsModal';
import { useSettings } from './contexts/SettingsContext';
import { useChessGame } from './hooks/useChessGame';
import { usePieceCustomization } from './hooks/usePieceCustomization';
import { useAppInteractions } from './hooks/useAppInteractions';
import { useGameData } from './hooks/useGameData';
import { PieceInstance } from './types';

// ==========================================
// FEATURE FLAG: DEVELOPER CONTROLS
// Set this to true to see Settings and Strategy Debug buttons
const SHOW_DEV_CONTROLS = false;
// ==========================================

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const settings = useSettings();
  const boardRef = useRef<HTMLDivElement>(null);

  // Custom hook for managing piece personalities, names, and images
  const customization = usePieceCustomization();

  // Custom hook for managing the core chess game state and logic
  const chessGame = useChessGame({
    setImagePromptTemplate: customization.setImagePromptTemplate,
    setPieceImageUrls: customization.setPieceImageUrls,
  });

  // Custom hook for managing user interactions, chat, and selections
  const interactions = useAppInteractions({
    game: chessGame.game,
    pieceInstances: chessGame.pieceInstances,
    conversationHistories: chessGame.conversationHistories,
    executeMove: chessGame.executeMove,
    setConversationHistories: chessGame.setConversationHistories,
    generatePieceImage: customization.generatePieceImage,
    pieceImageUrls: customization.pieceImageUrls,
    boardRef: boardRef,
    setDebugSystemPrompt: () => { },
    setDebugLatestTurnContext: () => { },
    setDebugStrategy: () => { },
    setDebugLastImage: () => { },
  });

  // Custom hook for managing saving and loading game data
  const { saveGameData, loadGameData } = useGameData({
    ...chessGame,
    ...customization,
    ...settings,
    setChattingWith: interactions.setChattingWith,
  });

  return (
    <div className="App">
      {interactions.error && <p className="error-message">{interactions.error}</p>}
      <main className="game-container">
        <Chessboard
          ref={boardRef}
          game={chessGame.game}
          pieceInstances={chessGame.pieceInstances}
          selectedSquare={interactions.selectedSquare}
          onSquareClick={interactions.handleSquareClick}
          onSquareHover={interactions.setHoveredSquare}
          chattingWith={interactions.chattingWith}
          isRecording={interactions.isRecording}
          talkingVolume={interactions.talkingVolume}
          userVolume={interactions.userVolume}
          orbPosition={interactions.orbPosition}
        />
      </main>
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaveGameData={saveGameData}
        onLoadGameData={loadGameData}
        imagePromptTemplate={customization.imagePromptTemplate}
        onImagePromptTemplateChange={customization.setImagePromptTemplate}
      />
      <TermsModal
        isOpen={isTermsOpen}
        onClose={() => setIsTermsOpen(false)}
      />
    </div>
  );
}

export default App;
