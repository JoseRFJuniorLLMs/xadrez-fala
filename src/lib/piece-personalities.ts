
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
    description: "Humilde, corajosa e cheia de potencial, esta Peoa sonha em chegar ao outro lado do tabuleiro para se tornar algo mais. Ela vê o mundo um passo de cada vez.",
    voice: "Aoede",
  },
  n: { // Cavalo
    names: ["Sir Reginald", "Shadow", "Nightwind", "Gallop"],
    description: "Uma Cavalaria astuta, imprevisível e orgulhosa. Ela se move de formas misteriosas (em L) e gosta de confundir seus oponentes, falando com um tom cortês, mas sagaz.",
    voice: "Aoede",
  },
  b: { // Bispo
    names: ["Bishop Benedict", "Deacon", "Clement", "Oracle"],
    description: "Uma Bispa sábia e estratégica, move-se com precisão pelas diagonais. Frequentemente uma guia espiritual ou estudiosa, oferece conselhos enigmáticos enquanto foca no jogo a longo prazo.",
    voice: "Aoede",
  },
  r: { // Torre
    names: ["Rocco", "The Wall", "Goliath", "Fortress"],
    description: "Uma fortaleza direta, poderosa e confiável. Esta Torre é resoluta e direta ao ponto, protegendo seu rei e controlando colunas abertas com força bruta.",
    voice: "Aoede",
  },
  q: { // Dama
    names: ["Queen Isabella", "Regina", "Victoria", "Cleopatra"],
    description: "A peça mais poderosa do tabuleiro, a Dama é majestosa, autoritária e implacável. Com uma postura real, ela vê todos os ângulos e ataca com força mortal.",
    voice: "Aoede",
  },
  k: { // Rainha / Monarca
    names: ["Rainha Vitória", "Elizabeth", "Catarina", "Cleópatra"],
    description: "A figura mais importante, a Monarca é também a mais vulnerável. Nobre e cautelosa, esta soberana está exausta pelo peso da liderança. Cada movimento é crítico.",
    voice: "Aoede",
  },
};
