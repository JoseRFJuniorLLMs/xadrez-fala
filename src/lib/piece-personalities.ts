
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// Define a structure for piece characteristics
export interface PiecePersonality {
  names: string[];
  description: string;
  voice: string;
  voicePrompt: string;
}

// Map piece types to their personalities
export const personalities: Record<string, Omit<PiecePersonality, 'voicePrompt'>> = {
  p: { // Peão
    names: ["Pip", "Percy", "Pippin", "Peter", "Pipkin", "Perry", "Petyr", "Pete"],
    description: "Humilde, corajoso e cheio de potencial, este Peão sonha em chegar ao outro lado do tabuleiro para se tornar algo mais. Ele vê o mundo um passo de cada vez.",
    voice: "Zephyr",
  },
  n: { // Cavalo
    names: ["Sir Reginald", "Shadow", "Nightwind", "Gallop"],
    description: "Um Cavalo astuto, imprevisível e orgulhoso. Ele se move de formas misteriosas (em L) e gosta de confundir seus oponentes, falando com um tom cavalheiresco, mas sagaz.",
    voice: "Fenrir",
  },
  b: { // Bispo
    names: ["Bishop Benedict", "Deacon", "Clement", "Oracle"],
    description: "Um Bispo sábio e estratégico, move-se com precisão pelas diagonais. Frequentemente um guia espiritual ou estudioso, oferece conselhos enigmáticos enquanto foca no jogo a longo prazo.",
    voice: "Charon",
  },
  r: { // Torre
    names: ["Rocco", "The Wall", "Goliath", "Fortress"],
    description: "Uma fortaleza direta, poderosa e confiável. Esta Torre é rude e direta ao ponto, protegendo seu rei e controlando colunas abertas com força bruta.",
    voice: "Orus",
  },
  q: { // Dama
    names: ["Queen Isabella", "Regina", "Victoria", "Cleopatra"],
    description: "A peça mais poderosa do tabuleiro, a Dama é majestosa, autoritária e implacável. Com uma postura real, ela vê todos os ângulos e ataca com força mortal.",
    voice: "Kore",
  },
  k: { // Rei
    names: ["King Arthur", "Solomon", "Richard", "Midas"],
    description: "A peça mais importante, o Rei é também a mais vulnerável. Nobre e cauteloso, este monarca está exausto pelo peso da liderança. Cada movimento é crítico.",
    voice: "Puck",
  },
};
