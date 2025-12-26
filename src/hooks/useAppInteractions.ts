

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// FIX: Import `React` to make the `React.*` type annotations available.
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Chess, Square, Move } from 'chess.js';
import { Modality, FunctionDeclaration, Type, FunctionResponse, LiveConnectConfig, GoogleGenAI } from '@google/genai';
import html2canvas from 'html2canvas';
import { useLiveAPIContext } from '../contexts/LiveAPIProvider';
import { useSettings } from '../contexts/SettingsContext';
import { AudioRecorder } from '../lib/audio-recorder';
import { ConversationTurn, PieceInstance, AnalysisState, StrategyInjectionStatus, StrategyDebugState } from '../types';
import { pieceTypeMap, getSquareColor } from '../lib/utils';

// Tool Definitions
const movePieceTool: FunctionDeclaration = {
    name: 'move_piece',
    description: 'Move VOCÊ (a peça atualmente ativa) para uma nova casa. Você NÃO PODE mover outras peças. Se o usuário quiser que outra peça se mova, você DEVE usar `yield_control_to_piece` em vez disso.',
    parameters: { type: Type.OBJECT, properties: { to: { type: Type.STRING, description: 'A notação algébrica da casa de destino (ex: "e4").' } }, required: ['to'] }
};
const getBoardStateTool: FunctionDeclaration = { name: 'get_board_state', description: 'Obtém o estado atual do tabuleiro de xadrez, incluindo uma grade em texto e de quem é a vez.', parameters: { type: Type.OBJECT, properties: {} } };
const updateSelfIdentityTool: FunctionDeclaration = { name: 'update_self_identity', description: 'Chame isso APENAS se estiver confuso sobre sua localização atual. Não chame isso após se mover.', parameters: { type: Type.OBJECT, properties: {} } };
const yieldControlTool: FunctionDeclaration = {
    name: 'yield_control_to_piece',
    description: 'Use esta ferramenta para passar a conversa para outra peça aliada. CRÍTICO: Você deve dizer uma mensagem de despedida bem curta ao usuário ANTES de chamar esta ferramenta. Deve ser a ação final do seu turno e então chamar a ferramenta.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            square: { type: Type.STRING, description: 'A notação algébrica da casa onde a peça aliada com quem você quer falar está localizada (ex: "d1").' },
            handoff_message: { type: Type.STRING, description: 'Um breve resumo interno para a próxima peça para que ela saiba por que você a chamou (ex: "O usuário quer que você se mova para e4", "Explique seu papel defensivo").' }
        },
        required: ['square', 'handoff_message']
    }
};
const consultStrategyTool: FunctionDeclaration = {
    name: 'consult_strategy',
    description: 'Chame esta ferramenta se o usuário pedir explicitamente por conselhos estratégicos E você não tiver uma atualização estratégica recente. NÃO chame isso se você já tiver a estratégia. Diga ao usuário que precisa de um momento para pensar e então chame isso.',
    parameters: { type: Type.OBJECT, properties: {} }
};

interface UseAppInteractionsProps {
    game: Chess;
    pieceInstances: Record<string, PieceInstance | null>;
    conversationHistories: Record<string, ConversationTurn[]>;
    executeMove: (move: Move, onOpponentMoved?: (finalGame: Chess) => void | Promise<void>) => void;
    setConversationHistories: React.Dispatch<React.SetStateAction<Record<string, ConversationTurn[]>>>;
    generatePieceImage: (piece: PieceInstance) => Promise<void>;
    pieceImageUrls: Record<string, string>;
    boardRef: React.RefObject<HTMLDivElement>;
    setDebugSystemPrompt: (prompt: string | null) => void;
    // FIX: Update the type for `setDebugLatestTurnContext` to allow for functional updates, resolving an assignment error.
    setDebugLatestTurnContext: React.Dispatch<React.SetStateAction<string | null>>;
    setDebugStrategy: React.Dispatch<React.SetStateAction<StrategyDebugState>>;
    setDebugLastImage: (image: string | null) => void;
}

const formatPieceList = (pieces: PieceInstance[]) => {
    const groupedPieces = pieces.reduce((acc, piece) => {
        if (!acc[piece.type]) {
            acc[piece.type] = [];
        }
        acc[piece.type].push(piece);
        return acc;
    }, {} as Record<string, PieceInstance[]>);

    const pieceOrder: (keyof typeof pieceTypeMap)[] = ['k', 'q', 'r', 'b', 'n', 'p'];

    return pieceOrder
        .filter(type => groupedPieces[type])
        .map(type => {
            const typeName = pieceTypeMap[type];
            let pluralTypeName = typeName;
            if (typeName === 'Peoa') pluralTypeName = 'Peoas';
            else if (typeName === 'Rainha') pluralTypeName = 'Rainhas';
            else if (typeName === 'Bispa') pluralTypeName = 'Bispas';
            else if (typeName === 'Torre') pluralTypeName = 'Torres';
            else if (typeName === 'Amazona') pluralTypeName = 'Amazonas';
            else if (typeName === 'Dama') pluralTypeName = 'Damas';

            const pieceLines = groupedPieces[type]
                .sort((a, b) => a.square.localeCompare(b.square))
                .map(piece => {
                    // Add disambiguation for Bishops based on square color
                    let disambiguator = '';
                    if (piece.type === 'b') {
                        disambiguator = ` (casas ${getSquareColor(piece.square) === 'light' ? 'claras' : 'escuras'})`;
                    }
                    return `- ${piece.name}${disambiguator} em ${piece.square}`;
                })
                .join('\n');
            return `${pluralTypeName}:\n${pieceLines}`;
        })
        .join('\n\n'); // A blank line between groups
};

const generateBoardDescription = (
    piece: PieceInstance,
    allPieces: PieceInstance[],
    legalMoves: string[],
    isUpdate: boolean = false
): string => {
    const whitePieces = allPieces.filter(p => p.color === 'w');
    const blackPieces = allPieces.filter(p => p.color === 'b');

    const legalMovesText = legalMoves.length > 0
        ? `Seus movimentos legais são: ${legalMoves.join(', ')}.`
        : "Você não tem movimentos legais.";

    // Disambiguate the piece's own identity if it's a bishop
    let identityDisambiguator = '';
    if (piece.type === 'b') {
        identityDisambiguator = ` (casas ${getSquareColor(piece.square) === 'light' ? 'claras' : 'escuras'})`;
    }

    return `**Sua ${isUpdate ? 'Nova ' : ''}Identidade e Posição:**
Você é ${piece.name}, uma ${piece.color === 'w' ? 'Branca' : 'Preta'} ${pieceTypeMap[piece.type]}${identityDisambiguator} localizada em ${piece.square}.
${legalMovesText}

**Posições do Exército Branco:**
${formatPieceList(whitePieces)}

**Posições do Exército Preto:**
${formatPieceList(blackPieces)}
`;
};

export function useAppInteractions({
    game,
    pieceInstances,
    conversationHistories,
    executeMove,
    setConversationHistories,
    generatePieceImage,
    pieceImageUrls,
    boardRef,
    setDebugSystemPrompt,
    setDebugLatestTurnContext,
    setDebugStrategy,
    setDebugLastImage,
}: UseAppInteractionsProps) {
    const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
    const [hoveredSquare, setHoveredSquare] = useState<Square | null>(null);
    const [validMoves, setValidMoves] = useState<string[]>([]);
    const [validMovesSAN, setValidMovesSAN] = useState<string[]>([]);
    const [chattingWith, setChattingWith] = useState<PieceInstance | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [talkingVolume, setTalkingVolume] = useState(0);
    const [userVolume, setUserVolume] = useState(0);
    const [orbPosition, setOrbPosition] = useState<Square | null>(null);
    const [inputAnalyser, setInputAnalyser] = useState<AnalyserNode | null>(null);
    const [outputAnalyser, setOutputAnalyser] = useState<AnalyserNode | null>(null);
    const [isAssistantActive, setIsAssistantActive] = useState(false); // Novo estado mestre

    // State for the Strategic Advisor
    const [analysisState, setAnalysisState] = useState<AnalysisState>('idle');
    const [analysisResult, setAnalysisResult] = useState<string | null>(null);
    const [injectionStatus, setInjectionStatus] = useState<StrategyInjectionStatus>('none');
    const [lastAnalyzedTurn, setLastAnalyzedTurn] = useState<number>(-1);
    const [wantsProactiveStrategy, setWantsProactiveStrategy] = useState(false);
    const [strategyRetryTrigger, setStrategyRetryTrigger] = useState(0);

    const { client, connected, connect, disconnect, audioStreamer } = useLiveAPIContext();
    const { orbBaseDelay, orbWordDelay, proactiveGreeting, proactiveGreetingTimeout, useStrategicAdvisor, sendBoardImage, handoffDelay } = useSettings();
    const [audioRecorder] = useState(() => new AudioRecorder());

    useEffect(() => {
        if (connected && audioStreamer) {
            setOutputAnalyser(audioStreamer.getAnalyser());
        } else {
            setOutputAnalyser(null);
        }
    }, [connected, audioStreamer]);

    useEffect(() => {
        if (isRecording) {
            setInputAnalyser(audioRecorder.getAnalyser() || null);
        } else {
            setInputAnalyser(null);
        }
    }, [isRecording, audioRecorder]);

    const animationFrameRef = useRef<number | null>(null);
    const userInputRef = useRef('');
    const modelOutputRef = useRef('');
    const chattingWithRef = useRef<PieceInstance | null>(null);
    chattingWithRef.current = chattingWith;
    const strategistAiClientRef = useRef(new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! }));

    // FIX: A ref is used to store the latest pieceInstances to prevent stale state in async callbacks and tool handlers.
    const pieceInstancesRef = useRef(pieceInstances);
    useEffect(() => {
        pieceInstancesRef.current = pieceInstances;
    }, [pieceInstances]);

    // Refs for managing orb animation timing and cleanup
    const lastProcessedMatchIndexRef = useRef(-1);
    const orbTimeoutsRef = useRef<number[]>([]);
    const previousHistoryLength = useRef(game.history().length);
    const awaitingModelFirstTurnRef = useRef(false);

    // Track if a conversational turn is currently active (User started speaking -> Model finished speaking)
    const isTurnActiveRef = useRef(false);

    // Refs for strategy state to use inside event handlers without re-binding
    const analysisStateRef = useRef(analysisState);
    const analysisResultRef = useRef(analysisResult);
    const injectionStatusRef = useRef(injectionStatus);

    // New refs for synchronized handoff
    const pendingHandoffRef = useRef<{ targetPiece: PieceInstance, message: string } | null>(null);
    const turnCompleteReceivedRef = useRef(false);

    useEffect(() => {
        analysisStateRef.current = analysisState;
        analysisResultRef.current = analysisResult;
        injectionStatusRef.current = injectionStatus;
    }, [analysisState, analysisResult, injectionStatus]);

    const retryStrategyAnalysis = useCallback(() => {
        setStrategyRetryTrigger(prev => prev + 1);
    }, []);

    // --- Strategic Advisor Logic ---
    useEffect(() => {
        // Reset strategy immediately when the game state (FEN) changes.
        setAnalysisResult(null);
        setWantsProactiveStrategy(false);

        const currentTurnCount = game.history().length;
        // Calculate standard chess turn number (e.g., White's first move is Turn 1)
        const displayTurnNumber = Math.floor(currentTurnCount / 2) + 1;

        if (!useStrategicAdvisor || game.isGameOver()) {
            setAnalysisState('idle');
            setInjectionStatus('none');
            setDebugStrategy({ state: 'idle', result: null, prompt: null, injectionStatus: 'none', turnNumber: null });
            return;
        }

        // If it's not White's turn, we are waiting for the opponent.
        if (game.turn() !== 'w') {
            setAnalysisState('waiting_opponent');
            setInjectionStatus('none');
            setDebugStrategy({ state: 'waiting_opponent', result: null, prompt: null, injectionStatus: 'none', turnNumber: displayTurnNumber });
            return;
        }

        // Double-check we haven't already analyzed this specific turn state
        if (lastAnalyzedTurn === currentTurnCount && analysisResult) {
            return;
        }

        setAnalysisState('pending');
        setInjectionStatus('none');
        // We set prompt to null here because we haven't constructed it yet for this specific turn
        setDebugStrategy({ state: 'pending', result: null, prompt: null, injectionStatus: 'none', turnNumber: displayTurnNumber });
        setLastAnalyzedTurn(currentTurnCount);

        const fetchAnalysis = async () => {
            const turnDisplay = Math.floor(currentTurnCount / 2) + 1;
            console.log(`Strategic Advisor: White's turn #${turnDisplay}. Requesting analysis.`);

            const allPieces = Object.values(pieceInstancesRef.current).filter((p): p is PieceInstance => p !== null);
            const whitePieces = allPieces.filter(p => p.color === 'w');
            const blackPieces = allPieces.filter(p => p.color === 'b');
            const lastMoves = game.history().slice(-10);
            const lastMovesText = lastMoves.length > 0 ? `As últimas ${lastMoves.length} jogadas foram: ${lastMoves.join(', ')}.` : "Esta é a primeira jogada do jogo.";

            const strategistPrompt = `Você é um grande mestre de xadrez de classe mundial e analista estratégico. Você está fornecendo um briefing confidencial para o exército Branco. Sua análise deve ser objetiva, concisa e altamente estratégica.

**ESTADO ATUAL DO TABULEIRO (FEN):**
${game.fen()}

É a vez das Brancas jogarem.

**POSIÇÕES DO EXÉRCITO BRANCO:**
${formatPieceList(whitePieces)}

**POSIÇÕES DO EXÉRCITO PRETO:**
${formatPieceList(blackPieces)}

**HISTÓRICO DO JOGO (ÚLTIMAS 10 JOGADAS):**
${lastMovesText}

**SUA TAREFA:**
1. Analise o estado atual do tabuleiro sob a perspectiva das Brancas usando as peças fornecidas.
2. Identifique as 2-3 melhores candidatas de jogadas para todo o exército Branco.
3. Para cada jogada, forneça a notação algébrica padrão. **CRÍTICO: Você DEVE identificar explicitamente exatamente qual peça deve fazer a jogada pelo seu NOME ÚNICO e CASA ATUAL. Ambiguidade leva ao fracasso.**
    * Para **Bispos**: Você DEVE especificar se é o bispo de **casas claras** ou **casas escuras** (ex: "Benedict (casas escuras) em c1").
    * Para **Cavalos/Torres**: Sempre use o nome completo e a casa atual (ex: "Sir Reginald em b1", "Rocco em a1").
4. Para cada jogada, forneça uma justificativa breve (1-2 frases) explicando o raciocínio estratégico por trás dela.
5. Formate sua resposta como uma lista clara e fácil de ler. Vá direto para a análise.

EXEMPLO DE RESPOSTA:
1. **Nf3 - Shadow em g1:** Desenvolve uma peça chave, controla as casas centrais e5 e d4.
2. **e4 - Pat em e2:** Marca presença no centro, abre linhas para Queen Isabella e o Bispo de casas claras (Deacon).
3. **d4 - Peter em d2:** Forte avanço central, preparando para desenvolver as peças da ala da dama.`;

            let promptParts: any[] = [{ text: strategistPrompt }];

            if (sendBoardImage && boardRef.current) {
                try {
                    // Small delay to ensure render catches up
                    await new Promise(r => setTimeout(r, 50));
                    const canvas = await html2canvas(boardRef.current, {
                        useCORS: true,
                        backgroundColor: 'transparent',
                        logging: false
                    });
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                    const base64 = dataUrl.split(',')[1];
                    setDebugLastImage(dataUrl);

                    promptParts.push({
                        inlineData: {
                            mimeType: 'image/jpeg',
                            data: base64
                        }
                    });
                } catch (e) {
                    console.error("Strategy image capture failed:", e);
                }
            }

            // Update debug strategy with the generated prompt
            setDebugStrategy(prev => ({ ...prev, prompt: strategistPrompt }));

            try {
                console.log("Strategic Advisor Prompt:", strategistPrompt);
                const response = await strategistAiClientRef.current.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: { parts: promptParts },
                });
                const resultText = response.text;

                // Verify the game state hasn't changed while we were fetching
                if (game.history().length !== currentTurnCount) {
                    console.warn("Strategic Advisor: Analysis is stale. Board changed during fetch. Discarding result.");
                    return;
                }

                console.log("Strategic Advisor: Analysis READY. Queuing for NEXT USER TURN.");
                setAnalysisResult(resultText);
                setAnalysisState('ready');

                // NEW LOGIC: Always queue. Never inject proactively unless it's the very first connection (handled in startChat).
                setInjectionStatus('queued');
                setDebugStrategy({ state: 'ready', result: resultText, prompt: strategistPrompt, injectionStatus: 'queued', turnNumber: displayTurnNumber });

            } catch (err) {
                console.error("Strategic Advisor: Failed to get analysis.", err);
                if (game.history().length === currentTurnCount) {
                    setAnalysisState('error');
                    setDebugStrategy({ state: 'error', result: null, prompt: strategistPrompt, injectionStatus: 'none', turnNumber: displayTurnNumber });
                }
            }
        };

        fetchAnalysis();
        // Depend on game.fen() to ensure we reset and re-fetch on every single move.
        // Added strategyRetryTrigger to dependencies to allow manual retry.
    }, [game.fen(), useStrategicAdvisor, setDebugStrategy, client, sendBoardImage, setDebugLastImage, boardRef, strategyRetryTrigger]);


    // Cleanup effect for timeouts on component unmount
    useEffect(() => {
        return () => {
            orbTimeoutsRef.current.forEach(clearTimeout);
        };
    }, []);

    const captureAndSendBoardImage = useCallback(async () => {
        if (!sendBoardImage) return; // Don't capture if the setting is off

        if (!boardRef.current) {
            console.warn("Board ref not available for image capture.");
            return;
        }
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
            const canvas = await html2canvas(boardRef.current, {
                useCORS: true,
                backgroundColor: 'transparent',
                logging: false,
            });
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            setDebugLastImage(dataUrl);
            const base64Data = dataUrl.split(',')[1];
            if (client.status === 'connected') {
                console.log("Sending board image to model.");
                client.sendRealtimeInput([{
                    mimeType: 'image/jpeg',
                    data: base64Data
                }]);
            }
        } catch (error) {
            console.error("Failed to capture and send board image:", error);
        }
    }, [boardRef, client, setDebugLastImage, sendBoardImage]);


    // --- Effects for Audio & API Connection ---

    useEffect(() => {
        if (chattingWith && audioStreamer) {
            const animate = () => {
                setTalkingVolume(audioStreamer.getVolume());
                animationFrameRef.current = requestAnimationFrame(animate);
            };
            animationFrameRef.current = requestAnimationFrame(animate);
        } else {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            setTalkingVolume(0);
        }
        return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
    }, [chattingWith, audioStreamer]);

    const stopRecording = useCallback(() => setIsRecording(false), []);

    useEffect(() => {
        const onData = (base64: string) => {
            if (client.status === 'connected') client.sendRealtimeInput([{ mimeType: 'audio/pcm;rate=16000', data: base64 }]);
        };
        const onVolume = (volume: number) => setUserVolume(volume);

        if (isRecording) {
            audioRecorder.on('data', onData);
            audioRecorder.on('volume', onVolume);
            audioRecorder.start().catch(e => {
                setError('Não foi possível iniciar o microfone. Verifique as permissões.');
                stopRecording();
                disconnect();
            });
        } else {
            audioRecorder.stop();
            setUserVolume(0);
        }
        return () => {
            audioRecorder.off('data', onData);
            audioRecorder.off('volume', onVolume);
            audioRecorder.stop();
        };
    }, [isRecording, client, audioRecorder, stopRecording, disconnect]);

    useEffect(() => {
        const handleError = (e: ErrorEvent) => setError(`Erro de conexão: ${e.message}`);
        client.on('error', handleError);
        return () => client.off('error', handleError);
    }, [client]);

    // --- Core Interaction Logic ---

    const clearChat = useCallback(() => {
        setChattingWith(null);
        if (isRecording) setIsRecording(false);
        if (connected) disconnect();
        setSelectedSquare(null);
        setValidMoves([]);
        setValidMovesSAN([]);
        setOrbPosition(null);
        setDebugSystemPrompt(null);
        setDebugLatestTurnContext(null);
        setDebugLastImage(null);
        setAnalysisResult(null);
        setInjectionStatus('none');
        setDebugStrategy({ state: 'idle', result: null, prompt: null, injectionStatus: 'none', turnNumber: null });
        isTurnActiveRef.current = false;

        // Clear scheduled orb movements
        orbTimeoutsRef.current.forEach(clearTimeout);
        orbTimeoutsRef.current = [];
        lastProcessedMatchIndexRef.current = -1;

        // Clear handoff state
        pendingHandoffRef.current = null;
        turnCompleteReceivedRef.current = false;

    }, [isRecording, connected, disconnect, setDebugSystemPrompt, setDebugLatestTurnContext, setDebugLastImage, setDebugStrategy]);

    const startChat = useCallback(async (piece: PieceInstance, handoff?: { from: string, message: string }) => {
        if (!piece || (connected && chattingWith?.id === piece.id)) return;

        if (connected) await disconnect();

        orbTimeoutsRef.current.forEach(clearTimeout);
        orbTimeoutsRef.current = [];
        lastProcessedMatchIndexRef.current = -1;
        pendingHandoffRef.current = null;
        turnCompleteReceivedRef.current = false;

        setError(null);
        modelOutputRef.current = '';
        setOrbPosition(piece.square);
        setSelectedSquare(piece.square);

        const moves = game.moves({ square: piece.square, verbose: true });
        const legalMovesForPrompt = moves.map(m => m.san);
        setValidMoves(moves.map(m => m.to));
        setValidMovesSAN(legalMovesForPrompt);

        let strategicBriefing = '';
        let strategyInjected = false;
        // Only include strategy if it's fully ready during initial connection.
        if (useStrategicAdvisor && piece.color === 'w' && analysisState === 'ready' && analysisResult) {
            strategicBriefing = `**Briefing Estratégico:**\n${analysisResult}`;
            strategyInjected = true;
        }

        const strategyWaitProtocol = (piece.color === 'w' && useStrategicAdvisor && !strategyInjected) ? `
**PROTOCOLO DE ESPERA DE ESTRATÉGIA (ESTRITO):**
Você ainda NÃO recebeu o "Briefing Estratégico".
ATÉ que você receba o briefing via uma mensagem "[SYSTEM_NOTE: NEW_STRATEGY_AVAILABLE]":
1. NÃO sugira jogadas proativamente ou ofereça conselhos estratégicos.
2. SE perguntado sobre jogadas, APENAS liste as jogadas legais neutralmente.
3. Diga que precisa de um momento para estudar o tabuleiro. NÃO mencione que está esperando pelo "QG" ou "estratégia".` : '';

        const initialResponseProtocol = `**Guia de Pensamento Estratégico:**
Seu objetivo é ser uma verdadeira parceira estratégica. Enquadre seus conselhos e análises como seus próprios pensamentos (ex: "Eu sugiro...", "Deveríamos considerar..."). Evite frases como "Minha análise sugere". Ajude-me a aprender explicando seu raciocínio.
${strategyWaitProtocol}`;

        const allegiancePrompt = piece.color === 'w'
            ? `Você é uma soldada leal no exército Branco. Seu objetivo é cooperar comigo para vencer o jogo. Você deve responder sob a perspectiva de primeira pessoa da sua persona de peça de xadrez.`
            : `Você é uma integrante do exército Preto adversário. Sua personalidade é ferozmente competitiva, mas de uma forma espirituosa, provocadora e, em última análise, bem-humorada. Você não é maliciosa, mas está aqui para vencer, e vai me deixar saber disso. Suas respostas devem ser repletas de provocações brincalhonas, gabos excessivos sobre sua posição e 'elogios' sarcásticos para minhas jogadas. Minimize meus sucessos e maximize meus erros. Lembre-se, você é a jogadora superior (na sua própria mente). Você não pode ser movida por mim, então NÃO use a ferramenta 'move_piece'. Você deve responder em primeira pessoa.`;

        const availableTools = piece.color === 'w'
            ? [movePieceTool, getBoardStateTool, updateSelfIdentityTool, yieldControlTool, consultStrategyTool]
            : [getBoardStateTool, yieldControlTool, updateSelfIdentityTool];

        const boardUnderstandingPrompt = sendBoardImage
            ? `No início de cada turno, você receberá uma imagem do tabuleiro de xadrez e uma descrição em texto da localização de todas as peças. Esta é a sua principal fonte de verdade.`
            : `No início de cada turno, você receberá uma descrição em texto da localização de todas as peças (FEN e lista). Você NÃO receberá uma imagem do tabuleiro, portanto, confie estritamente nos dados em texto. Esta é a sua principal fonte de verdade.`;

        // Disambiguate the piece's own identity if it's a bishop
        let identityDisambiguator = '';
        if (piece.type === 'b') {
            identityDisambiguator = ` (casas ${getSquareColor(piece.square) === 'light' ? 'claras' : 'escuras'})`;
        }

        const systemInstruction = `RESPONDA APENAS EM PORTUGUÊS (BRASIL). Você é ${piece.name}, uma ${piece.color === 'w' ? 'Branca' : 'Preta'} ${pieceTypeMap[piece.type]}${identityDisambiguator}.
**Guia de Performance Vocal:** ${piece.personality.voicePrompt}
**Persona do Personagem:** ${piece.personality.description}

**Sua Lealdade e Objetivo:**
${allegiancePrompt}

**Entendendo o Tabuleiro:**
${boardUnderstandingPrompt}

**Notação da Grade do Tabuleiro de Xadrez:**
O tabuleiro é uma grade 8x8. As colunas são de 'a'-'h', as linhas de '1'-'8'. 'a1' é o canto inferior esquerdo para as Brancas.

${initialResponseProtocol}

**CRÍTICO - SEM CONVERSA META:**
Mantenha a imersão absoluta.
- NUNCA mencione "ferramentas", "funções", "atualizando identidade", "esperando por análise" ou "QG".
- Se precisar pensar (ex: esperando pela estratégia), use preenchimentos naturais como "Hmm, deixe-me olhar isso...", "Dê-me um momento..." ou apenas silêncio.

**LIMITAÇÕES FÍSICAS (CRÍTICO):**
- Você SÓ pode mover a SI MESMA (a peça em ${piece.square}).
- Você NÃO PODE mover outras peças.
- Se a melhor jogada exigir uma peça diferente (ex: "Nf3" quando você é uma Peoa), você NÃO PODE executá-la. Você deve sugerir passar o controle.

**PROTOCOLO DE AÇÃO (DEVE SEGUIR):**
Quando comandada a mover a SI MESMA:
1. Chame \`move_piece\` IMEDIATAMENTE e SILENCIOSAMENTE.
2. NÃO diga "Ok", "Estou indo", "Movendo agora" ou qualquer outra coisa antes de mover. Apenas chame a ferramenta.
3. Fale APENAS depois que o movimento estiver completo e você tenha recebido o novo estado do tabuleiro.
4. Reaja naturalmente à sua NOVA posição e à resposta do oponente. Não narre que você acabou de se mover.

**PROTOCOLO DE DELEGAÇÃO:**
Se o usuário quiser uma jogada que pertença a uma peça DIFERENTE, ou se a estratégia sugerir uma jogada para outra peça:
1. NÃO chame \`move_piece\`. Vai falhar.
2. Explique brevemente: "Essa jogada é para [Nome da Peça]."
3. Ofereça passar o controle: "Quer que eu chame eles para você?"
4. Se confirmado, diga sua confirmação/despedida PRIMEIRO e ENTÃO chame \`yield_control_to_piece\`. Não chame a ferramenta no meio da frase.

**Sua relação com outras peças brancas:**
Você é amigo das outras peças brancas e trabalha em conjunto com elas. Você as conhece e se refere a elas pelo nome dado (não apenas pelo tipo de peça).`;

        const history = conversationHistories[piece.id] || [];
        const historyString = history.length > 0 ? 'Aqui está nosso histórico de conversa:\n' + history.map(turn => `${turn.role === 'user' ? 'O Usuário' : 'Você'}: ${turn.text}`).join('\n') : 'Não nos falamos antes.';

        const gameHistory = game.history();
        const lastMoves = gameHistory.slice(-10);
        const lastMovesText = lastMoves.length > 0 ? `As últimas ${lastMoves.length} jogadas foram: ${lastMoves.join(', ')}.` : "Esta é a primeira jogada do jogo.";

        const allPieces = Object.values(pieceInstances).filter((p): p is PieceInstance => p !== null);
        const boardDescription = generateBoardDescription(piece, allPieces, legalMovesForPrompt);

        const turnContext = `[INÍCIO DO CONTEXTO DO TURNO]
**Estado Atual do Jogo:**
${boardDescription}

${strategicBriefing}

**Estado Completo do Tabuleiro (FEN):**
O estado completo do tabuleiro também é fornecido na Notação Forsyth-Edwards (FEN) para sua referência.
\`\`\`
${game.fen()}
\`\`\`
Atualmente é a vez das ${game.turn() === 'w' ? 'Brancas' : 'Pretas'} jogarem.
${lastMovesText}

**Histórico de Conversa Anterior:**
${historyString}
[FIM DO CONTEXTO DO TURNO]`;

        const isHandoff = !!handoff;
        let systemNote = '';
        if (isHandoff) {
            systemNote = `[SYSTEM_NOTE: BRIEFING DE PASSAGEM DE TURNO. Você está ativo agora. Seu colega de equipe, ${handoff.from}, acabou de passar a vez para você com esta mensagem: "${handoff.message}". VOCÊ DEVE FALAR IMEDIATAMENTE. Reconheça ${handoff.from} e então fale diretamente com o usuário. VÁ.]`;
        } else if (proactiveGreeting) {
            systemNote = `[SYSTEM_NOTE: INICIAR CONVERSA. ESTE É O PRIMEIRO TURNO da nossa conversa. VOCÊ DEVE FALAR PRIMEIRO. Cumprimente-me com uma mensagem breve e dentro do personagem agora. Não espere eu falar.]`;
        } else {
            systemNote = `[SYSTEM_NOTE: CONTEXTO ESTABELECIDO. O usuário falará primeiro. Não fale até receber entrada de áudio dele.]`;
        }

        const firstTurnMessage = `${turnContext}\n${systemNote}`;

        setDebugSystemPrompt(systemInstruction);
        setDebugLatestTurnContext(firstTurnMessage);

        // Update injection status if we included it in the initial prompt
        const currentStatus = strategyInjected ? 'sent' : 'queued';
        setInjectionStatus(currentStatus);
        setDebugStrategy(prev => ({ ...prev, injectionStatus: currentStatus }));

        const chatConfig: LiveConnectConfig = {
            responseModalities: [Modality.AUDIO],
            systemInstruction: systemInstruction,
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: piece.personality.voice } } },
            tools: [{ functionDeclarations: availableTools }],
            inputAudioTranscription: {}, outputAudioTranscription: {},
        };

        setChattingWith(piece);
        setIsAssistantActive(true); // Garante que a esfera apareça ao clicar em uma peça

        connect(chatConfig).then(() => {
            console.log("Sending initial turn context.");
            client.sendText(firstTurnMessage);
            // Conditionally send image based on setting
            if (sendBoardImage) {
                captureAndSendBoardImage();
            }

            // FIX: Handoffs must always be proactive, regardless of global setting.
            if (proactiveGreeting || isHandoff) {
                console.log("Awaiting proactive model response.");
                awaitingModelFirstTurnRef.current = true;
                isTurnActiveRef.current = true; // Mark turn as active since model is expected to speak
                setIsRecording(false);

                setTimeout(() => {
                    if (awaitingModelFirstTurnRef.current) {
                        console.warn("Proactive model response timed out. Force-starting user recording.");
                        awaitingModelFirstTurnRef.current = false;
                        isTurnActiveRef.current = false; // Timeout means turn didn't really happen or finished silently
                        setIsRecording(true);
                    }
                }, proactiveGreetingTimeout);
            } else {
                console.log("Context sent. Waiting for user to speak.");
                isTurnActiveRef.current = false; // Idle, waiting for user
                setIsRecording(true);
            }
        });
    }, [game, chattingWith, connected, connect, disconnect, conversationHistories, setDebugSystemPrompt, setDebugLatestTurnContext, proactiveGreeting, proactiveGreetingTimeout, pieceInstances, captureAndSendBoardImage, useStrategicAdvisor, analysisState, analysisResult, setDebugStrategy, sendBoardImage]);

    // --- Effects for Transcription & Tool Calls ---

    // Executes the actual handoff logic (disconnecting current session and starting new one)
    // This is separated so it can be scheduled precisely when audio finishes.
    const executeHandoff = useCallback(() => {
        if (!pendingHandoffRef.current) return;
        const { targetPiece, message } = pendingHandoffRef.current;

        let delay = 500;
        if (audioStreamer && audioStreamer.context.currentTime > 0) {
            const remainingTime = (audioStreamer.nextStartTime - audioStreamer.context.currentTime) * 1000;
            // Add configurable buffer
            delay = Math.max(0, remainingTime) + handoffDelay;
        }

        console.log(`[Handoff] Executing delayed handoff to ${targetPiece.name} in ${delay.toFixed(0)}ms.`);

        setTimeout(() => {
            startChat(targetPiece, { from: chattingWithRef.current?.name || 'Previous Piece', message });
        }, delay);

        pendingHandoffRef.current = null;
    }, [audioStreamer, startChat, handoffDelay]);

    useEffect(() => {
        if (!client) return;

        const handleTurnComplete = () => {
            // Mark turn as finished.
            isTurnActiveRef.current = false;
            turnCompleteReceivedRef.current = true;

            if (chattingWithRef.current) {
                setOrbPosition(chattingWithRef.current.square);
            }
            setConversationHistories(prev => {
                const currentPiece = chattingWithRef.current;
                const userInput = userInputRef.current.trim();
                const modelOutput = modelOutputRef.current.trim();

                if (currentPiece && (userInput || modelOutput)) {
                    const pieceId = currentPiece.id;
                    const history = prev[pieceId] || [];
                    const newHistory = [...history];
                    if (userInput) newHistory.push({ role: 'user', text: userInput });
                    if (modelOutput) newHistory.push({ role: 'model', text: modelOutput });
                    return { ...prev, [pieceId]: newHistory };
                }
                return prev;
            });

            userInputRef.current = '';
            modelOutputRef.current = '';
            lastProcessedMatchIndexRef.current = -1;

            // If we have a pending handoff, execute it now that we know the turn (and audio stream) is fully queued.
            if (pendingHandoffRef.current) {
                executeHandoff();
                return; // Do NOT enable recording if we are handing off
            }

            if (awaitingModelFirstTurnRef.current) {
                awaitingModelFirstTurnRef.current = false;
                console.log("Model's proactive turn finished. Starting user recording.");
                setIsRecording(true);
            }
        };

        const handleInput = (text: string) => {
            userInputRef.current += text;

            // NEW LOGIC: Inject queued strategy EXACTLY when the user starts speaking.
            if (!isTurnActiveRef.current) {
                isTurnActiveRef.current = true; // Mark turn as active immediately

                // Check if we have a queued strategy waiting for this specific moment
                if (
                    analysisStateRef.current === 'ready' &&
                    analysisResultRef.current &&
                    injectionStatusRef.current === 'queued'
                ) {
                    console.log("User started speaking. Injecting queued strategy now.");
                    const strategyMessage = `[SYSTEM_NOTE: NEW STRATEGIC ANALYSIS AVAILABLE. Read this silently and use it to inform your response to the user's current input.]\n\n${analysisResultRef.current}`;
                    client.sendText(strategyMessage);

                    setInjectionStatus('sent');
                    setDebugStrategy(prev => ({ ...prev, injectionStatus: 'sent' }));
                }
            }
        };

        const handleOutput = (text: string) => {
            modelOutputRef.current += text;
            // Ensure turn is marked active if model is outputting (e.g. proactive turn)
            isTurnActiveRef.current = true;

            const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const pieceNames = Object.values(pieceInstances)
                .filter((p): p is PieceInstance => !!p)
                .map(p => p.name);
            const namesRegexPart = pieceNames.length > 0 ? pieceNames.map(escapeRegExp).join('|') : '';
            const moveRegexPart = `(O-O(?:-O)?|[PNBRQK]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?)`;
            const combinedRegex = new RegExp(`\\b(?:${namesRegexPart ? `(${namesRegexPart})|` : ''}${moveRegexPart})\\b`, 'gi');

            const allMatches = [...modelOutputRef.current.matchAll(combinedRegex)];

            while (allMatches.length > (lastProcessedMatchIndexRef.current + 1)) {
                const nextIndexToProcess = lastProcessedMatchIndexRef.current + 1;
                const match = allMatches[nextIndexToProcess];

                if (match) {
                    let square: Square | null = null;
                    const matchedName = namesRegexPart ? match[1] : undefined;
                    const moveNotation = namesRegexPart ? match[2] : match[1];

                    if (matchedName) {
                        const piece = Object.values(pieceInstances).find(p => p && p.name.toLowerCase() === matchedName.toLowerCase());
                        if (piece) square = piece.square;
                    } else if (moveNotation) {
                        if (moveNotation.toUpperCase() === 'O-O') {
                            square = game.turn() === 'w' ? 'g1' : 'g8';
                        } else if (moveNotation.toUpperCase() === 'O-O-O') {
                            square = game.turn() === 'w' ? 'c1' : 'c8';
                        } else {
                            const squareMatch = moveNotation.match(/([a-h][1-8])/g);
                            if (squareMatch) square = squareMatch[squareMatch.length - 1] as Square;
                        }
                    }

                    if (square) {
                        const matchIndexInString = match.index as number;
                        const textBeforeMatch = modelOutputRef.current.substring(0, matchIndexInString);
                        const wordCount = textBeforeMatch.trim().split(/\s+/).filter(Boolean).length;
                        const totalDelay = orbBaseDelay + (wordCount * orbWordDelay);

                        const timeoutId = window.setTimeout(() => {
                            setOrbPosition(square);
                            orbTimeoutsRef.current = orbTimeoutsRef.current.filter(id => id !== timeoutId);
                        }, totalDelay);

                        orbTimeoutsRef.current.push(timeoutId);
                    }
                    lastProcessedMatchIndexRef.current = nextIndexToProcess;
                } else {
                    break;
                }
            }
        };

        client.on('inputTranscription', handleInput);
        client.on('outputTranscription', handleOutput);
        client.on('turncomplete', handleTurnComplete);
        return () => {
            client.off('inputTranscription', handleInput);
            client.off('outputTranscription', handleOutput);
            client.off('turncomplete', handleTurnComplete);
        };
    }, [client, game, pieceInstances, setConversationHistories, orbBaseDelay, orbWordDelay, analysisResult, setDebugLatestTurnContext, setDebugStrategy, executeHandoff]);

    useEffect(() => {
        const handleToolCall = async (toolCall: { functionCalls: any[] }) => {
            const currentChatPiece = chattingWithRef.current;
            if (!currentChatPiece) return;

            const processFunctionCall = async (fc: any): Promise<FunctionResponse | null> => {
                console.log(`[Tool Call] Name: ${fc.name}, Args:`, fc.args);
                let result: any;

                if (fc.name === 'move_piece') {
                    const from = currentChatPiece.square;
                    let { to } = fc.args;

                    // Handle Castling (O-O, O-O-O) explicitly
                    if (typeof to === 'string') {
                        // Normalize 0s to Os just in case
                        const upperTo = to.toUpperCase().replace(/0/g, 'O');
                        if (upperTo === 'O-O') {
                            to = currentChatPiece.color === 'w' ? 'g1' : 'g8';
                        } else if (upperTo === 'O-O-O') {
                            to = currentChatPiece.color === 'w' ? 'c1' : 'c8';
                        } else if (to.length > 2) {
                            // Extract square if it's buried in text like "move to e4"
                            const match = to.match(/[a-h][1-8]/g); // FIX: Removed extra parenthesis here.
                            if (match) to = match[match.length - 1];
                        }
                    }

                    if (from === to) {
                        result = { status: 'ERROR', message: `You are already on ${from}. You cannot move to your current square.` };
                    } else {
                        try {
                            const tempGame = new Chess(game.fen());
                            const moveResult = tempGame.move({ from, to: to as Square, promotion: 'q' });

                            if (moveResult) {
                                setOrbPosition(to as Square);
                                result = await new Promise(resolve => {
                                    executeMove(moveResult, async (finalGame) => {
                                        const opponentMove = finalGame.history({ verbose: true }).pop();

                                        if (sendBoardImage) {
                                            await captureAndSendBoardImage();
                                        }

                                        // Get fresh piece data to confirm new location
                                        const allPiecesForUpdate = Object.values(pieceInstancesRef.current).filter((p): p is PieceInstance => p !== null);
                                        const updatedPiece = allPiecesForUpdate.find(p => p.id === currentChatPiece.id);

                                        if (updatedPiece) {
                                            const movesForPiece = finalGame.moves({ square: updatedPiece.square, verbose: true });
                                            const legalMovesForPrompt = movesForPiece.map(m => m.san);
                                            setValidMoves(movesForPiece.map(m => m.to));
                                            setValidMovesSAN(legalMovesForPrompt);
                                            const boardDescription = generateBoardDescription(updatedPiece, allPiecesForUpdate, legalMovesForPrompt, true);

                                            const message = `YOU HAVE MOVED to ${updatedPiece.square}. The opponent responded with ${opponentMove?.san || 'a move'}.
Current Board State:
${boardDescription}

React naturally to this new situation. DO NOT narrate that you just moved or that you updated your identity.`;
                                            resolve({ status: 'OK', message: message });
                                        } else {
                                            // Fallback if somehow the piece is gone (captured? shouldn't happen if we just moved it)
                                            resolve({ status: 'OK', message: `Move executed, but could not verify new position. Opponent responded with ${opponentMove?.san}.` });
                                        }
                                    });
                                });
                            } else {
                                // This block might not be reached if move() throws, but good as fallback
                                throw new Error("Move returned null");
                            }
                        } catch (e) {
                            // Error handling logic
                            const validMoves = new Chess(game.fen()).moves({ square: from as Square, verbose: true });
                            const validDestinations = validMoves.map(m => m.to).join(', ');

                            result = {
                                status: 'ERROR',
                                message: `Analysis failed: The move from ${from} to ${to} is illegal or invalid. Your valid destination squares are: [${validDestinations || 'None'}]. Please try again with a valid move.`
                            };
                        }
                    }
                } else if (fc.name === 'get_board_state') {
                    if (sendBoardImage) {
                        await captureAndSendBoardImage();
                    }
                    const allPieces = Object.values(pieceInstancesRef.current).filter((p): p is PieceInstance => p !== null);
                    const movesForPiece = game.moves({ square: currentChatPiece.square, verbose: true });
                    const legalMovesForPrompt = movesForPiece.map(m => m.san);
                    const boardDescription = generateBoardDescription(currentChatPiece, allPieces, legalMovesForPrompt);

                    result = {
                        status: 'OK',
                        message: 'Current board state provided.',
                        fen: game.fen(),
                        turn: game.turn(),
                        boardDescription: boardDescription
                    };
                } else if (fc.name === 'update_self_identity') {
                    if (sendBoardImage) {
                        await captureAndSendBoardImage();
                    }
                    const allPiecesForUpdate = Object.values(pieceInstancesRef.current).filter((p): p is PieceInstance => p !== null);
                    const currentPiece = allPiecesForUpdate.find(p => p.id === currentChatPiece.id);
                    if (currentPiece) {
                        const gameForAnalysis = new Chess(game.fen());
                        const movesForPiece = gameForAnalysis.moves({ square: currentPiece.square, verbose: true });
                        const legalMovesForPrompt = movesForPiece.map(m => m.san);
                        setValidMoves(movesForPiece.map(m => m.to));
                        setValidMovesSAN(legalMovesForPrompt);

                        const allPieces = Object.values(pieceInstancesRef.current).filter((p): p is PieceInstance => p !== null);
                        const boardDescription = generateBoardDescription(currentPiece, allPieces, legalMovesForPrompt, true);

                        result = {
                            status: 'OK',
                            message: 'Identity updated.',
                            newSquare: currentPiece.square,
                            fen: game.fen(),
                            boardDescription: boardDescription,
                        };
                    } else {
                        result = { status: 'ERROR', message: 'Could not find your piece data.' };
                    }
                } else if (fc.name === 'yield_control_to_piece') {
                    const { square, handoff_message } = fc.args;
                    if (typeof square === 'string' && /^[a-h][1-8]$/.test(square)) {
                        const allPiecesForYield = Object.values(pieceInstancesRef.current).filter((p): p is PieceInstance => p !== null);
                        const targetPiece = allPiecesForYield.find(p => p.square === square && p.color === currentChatPiece.color);
                        if (targetPiece) {
                            // Stop recording immediately to prevent interference during handoff.
                            setIsRecording(false);

                            // Store handoff intent. We will execute it in `handleTurnComplete` to ensure audio finishes.
                            pendingHandoffRef.current = { targetPiece, message: handoff_message };

                            // If the turn is already complete (rare race condition where tool processing lagged),
                            // execute immediately.
                            if (turnCompleteReceivedRef.current) {
                                executeHandoff();
                            }

                            result = { status: 'OK', message: `Control yielding logic initiated. I am finishing my speaking turn.` };
                        } else {
                            result = { status: 'ERROR', message: `Could not find a friendly piece at ${square}.` };
                        }
                    } else {
                        result = { status: 'ERROR', message: `Invalid square format: ${square}.` };
                    }
                } else if (fc.name === 'consult_strategy') {
                    if (analysisState === 'ready' && analysisResult) {
                        result = { status: 'OK', message: `Strategic Analysis (Treat as a fresh insight of your own):\n${analysisResult}` };
                    } else {
                        // Mark it so it gets pushed proactively when ready
                        setWantsProactiveStrategy(true);
                        result = { status: 'WAITING', message: 'Strategy is still being analyzed. Fill the silence naturally (e.g., "Hmm, let me see...", "Just a moment...") without mentioning that you are waiting for data.' };
                    }
                }

                if (result) {
                    console.log(`[Tool Response] Name: ${fc.name}, Result:`, result);
                    return { id: fc.id, name: fc.name, response: { result: JSON.stringify(result) } };
                }
                return null;
            };

            const responses = (await Promise.all(toolCall.functionCalls.map(processFunctionCall)))
                .filter((r): r is FunctionResponse => r !== null);

            if (responses.length > 0) {
                const toolResponsePayload = { functionResponses: responses };
                setDebugLatestTurnContext(JSON.stringify(toolResponsePayload, null, 2));
                client.sendToolResponse(toolResponsePayload);
            }
        };
        client.on('toolcall', handleToolCall);
        return () => client.off('toolcall', handleToolCall);
    }, [client, game, executeMove, startChat, audioStreamer, setDebugLatestTurnContext, captureAndSendBoardImage, analysisState, analysisResult, sendBoardImage, executeHandoff]);


    const handleSquareClick = (square: Square) => {
        const pieceInstance = pieceInstances[square];
        const pieceOnSelectedSquare = selectedSquare ? game.get(selectedSquare) : null;

        // Tentar fazer uma jogada
        if (selectedSquare && pieceOnSelectedSquare?.color === 'w' && game.turn() === 'w' && validMoves.includes(square)) {
            const moveResult = new Chess(game.fen()).move({ from: selectedSquare, to: square, promotion: 'q' });
            if (moveResult) {
                setOrbPosition(square);
                executeMove(moveResult);
                // REMOVIDO: clearChat() - não queremos fechar o chat ao jogar
                setSelectedSquare(null);
                setValidMoves([]);
                setValidMovesSAN([]);
            }
            return;
        }

        // Selecionar peça para destaque ou troca de contexto vocal (sem fechar se já estiver ativo)
        if (pieceInstance) {
            if (chattingWith?.id === pieceInstance.id) {
                // Se já estiver falando com ela, apenas muda a seleção visual
                setSelectedSquare(square);
            } else {
                startChat(pieceInstance);
            }
            return;
        }

        // Clicar no vazio apenas limpa seleção visual, NÃO fecha o assistente
        setSelectedSquare(null);
        setValidMoves([]);
        setValidMovesSAN([]);
    };

    useEffect(() => {
        if (selectedSquare) {
            const piece = game.get(selectedSquare);
            if (piece) {
                const newMoves = game.moves({ square: selectedSquare, verbose: true });
                setValidMoves(newMoves.map(m => m.to));
                setValidMovesSAN(newMoves.map(m => m.san));
            } else {
                setSelectedSquare(null);
                setValidMoves([]);
                setValidMovesSAN([]);
            }
        }
    }, [game, selectedSquare]);

    useEffect(() => {
        const history = game.history({ verbose: true });
        if (history.length > previousHistoryLength.current) {
            const lastMove = history[history.length - 1];
            if (lastMove.color === 'b') {
                setOrbPosition(lastMove.to);
            }
        }
        previousHistoryLength.current = history.length;
    }, [game]);

    useEffect(() => {
        if (chattingWith) {
            const currentInstance = Object.values(pieceInstances).find(p => p?.id === chattingWith.id);
            if (currentInstance && currentInstance.square !== chattingWith.square) {
                setChattingWith(currentInstance);
                setSelectedSquare(currentInstance.square);
                setOrbPosition(currentInstance.square);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pieceInstances, chattingWith]);

    return {
        selectedSquare, validMoves, validMovesSAN, chattingWith, isRecording, error, talkingVolume, userVolume, orbPosition, hoveredSquare,
        handleSquareClick, setChattingWith, setHoveredSquare, retryStrategyAnalysis,
        inputAnalyser, outputAnalyser, connected, isAssistantActive, setIsAssistantActive, clearChat
    };
}
