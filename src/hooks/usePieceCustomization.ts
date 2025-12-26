/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// FIX: Import `React` to make the `React.*` type annotations available.
import React, { useState, useCallback, useRef } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { PieceInstance, ImageTransform } from '../types';

const pieceTypeMap: Record<string, string> = { p: "Peoa", n: "Amazona", b: "Bispa", r: "Torre", q: "Dama", k: "Rainha" };

export function usePieceCustomization() {
  const [imagePromptTemplate, setImagePromptTemplate] = useState('Arte de fantasia de uma peça de xadrez {type} de cor {color}, chamada {name}. Descrição da peça: {description}. Estilo de voz/fala: {voicePrompt}. O estilo deve ser épico, detalhado, com iluminação dramática. O personagem desenhado é a própria peça de xadrez (não desenhe um personagem humano). Evite texto. Proporção quadrada.');

  const [pieceImageUrls, setPieceImageUrls] = useState<Record<string, string>>({});
  const [pieceImageTransforms, setPieceImageTransforms] = useState<Record<string, ImageTransform>>({});
  const [loadingPieceId, setLoadingPieceId] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  const aiClientRef = useRef(new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! }));

  const generatePieceImage = useCallback(async (piece: PieceInstance) => {
    setLoadingPieceId(piece.id);
    setImageError(null);
    try {
      const prompt = imagePromptTemplate
        .replace('{color}', piece.color === 'w' ? 'Branca' : 'Preta')
        .replace('{type}', pieceTypeMap[piece.type].toLowerCase())
        .replace('{name}', piece.name)
        .replace('{description}', piece.personality.description)
        .replace('{voicePrompt}', piece.personality.voicePrompt);

      const response = await aiClientRef.current.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: prompt }],
        },
        config: {
          responseModalities: [Modality.IMAGE],
        },
      });

      let base64ImageBytes: string | null = null;
      if (response.candidates && response.candidates.length > 0) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            base64ImageBytes = part.inlineData.data;
            break;
          }
        }
      }

      if (base64ImageBytes) {
        const imageUrl = `data:image/jpeg;base64,${base64ImageBytes}`;
        setPieceImageUrls(prev => ({ ...prev, [piece.id]: imageUrl }));
        // Reset transform when a new image is generated
        setPieceImageTransforms(prev => ({ ...prev, [piece.id]: { x: 0, y: 0, scale: 1 } }));
      } else {
        throw new Error("Nenhum dado de imagem encontrado na resposta da API.");
      }
    } catch (err) {
      console.error(err);
      setImageError("Não foi possível gerar o retrato da peça.");
    } finally {
      setLoadingPieceId(null);
    }
  }, [imagePromptTemplate]);

  const handlePersonalityChange = useCallback((
    pieceId: string,
    newDescription: string,
    setPieceInstances: React.Dispatch<React.SetStateAction<Record<string, PieceInstance | null>>>,
    setChattingWith: React.Dispatch<React.SetStateAction<PieceInstance | null>>
  ) => {
    setPieceInstances(prevInstances => {
      const newInstances = { ...prevInstances };
      const square = Object.keys(newInstances).find(s => newInstances[s]?.id === pieceId);
      if (square && newInstances[square]) {
        const updatedPiece = { ...newInstances[square]! };
        updatedPiece.personality = { ...updatedPiece.personality, description: newDescription };
        newInstances[square] = updatedPiece;
      }
      return newInstances;
    });

    setChattingWith(prev => {
      if (prev?.id === pieceId) {
        const newPersonality = { ...prev.personality, description: newDescription };
        return { ...prev, personality: newPersonality };
      }
      return prev;
    });
  }, []);

  const handleNameChange = useCallback((
    pieceId: string,
    newName: string,
    setPieceInstances: React.Dispatch<React.SetStateAction<Record<string, PieceInstance | null>>>,
    setChattingWith: React.Dispatch<React.SetStateAction<PieceInstance | null>>
  ) => {
    setPieceInstances(prev => {
      const newInstances = { ...prev };
      const square = Object.keys(newInstances).find(s => newInstances[s]?.id === pieceId);
      if (square && newInstances[square]) {
        newInstances[square] = { ...newInstances[square]!, name: newName };
      }
      return newInstances;
    });

    setChattingWith(prev => prev?.id === pieceId ? { ...prev, name: newName } : prev);
  }, []);

  const handleVoiceChange = useCallback((
    pieceId: string,
    newVoice: string,
    setPieceInstances: React.Dispatch<React.SetStateAction<Record<string, PieceInstance | null>>>,
    setChattingWith: React.Dispatch<React.SetStateAction<PieceInstance | null>>
  ) => {
    setPieceInstances(prevInstances => {
      const newInstances = { ...prevInstances };
      const square = Object.keys(newInstances).find(s => newInstances[s]?.id === pieceId);
      if (square && newInstances[square]) {
        const updatedPiece = { ...newInstances[square]! };
        updatedPiece.personality = { ...updatedPiece.personality, voice: newVoice };
        newInstances[square] = updatedPiece;
      }
      return newInstances;
    });

    setChattingWith(prev => {
      if (prev?.id === pieceId) {
        const newPersonality = { ...prev.personality, voice: newVoice };
        return { ...prev, personality: newPersonality };
      }
      return prev;
    });
  }, []);

  const handleVoicePromptChange = useCallback((
    pieceId: string,
    newVoicePrompt: string,
    setPieceInstances: React.Dispatch<React.SetStateAction<Record<string, PieceInstance | null>>>,
    setChattingWith: React.Dispatch<React.SetStateAction<PieceInstance | null>>
  ) => {
    setPieceInstances(prevInstances => {
      const newInstances = { ...prevInstances };
      const square = Object.keys(newInstances).find(s => newInstances[s]?.id === pieceId);
      if (square && newInstances[square]) {
        const updatedPiece = { ...newInstances[square]! };
        updatedPiece.personality = { ...updatedPiece.personality, voicePrompt: newVoicePrompt };
        newInstances[square] = updatedPiece;
      }
      return newInstances;
    });

    setChattingWith(prev => {
      if (prev?.id === pieceId) {
        const newPersonality = { ...prev.personality, voicePrompt: newVoicePrompt };
        return { ...prev, personality: newPersonality };
      }
      return prev;
    });
  }, []);

  return {
    imagePromptTemplate,
    setImagePromptTemplate,
    pieceImageUrls,
    setPieceImageUrls,
    pieceImageTransforms,
    setPieceImageTransforms,
    loadingPieceId,
    imageError,
    generatePieceImage,
    handlePersonalityChange,
    handleNameChange,
    handleVoiceChange,
    handleVoicePromptChange,
  };
}