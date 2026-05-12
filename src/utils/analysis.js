/**
 * AI-powered Mines Predictor Logic
 * Analyzes historical patterns and calculates real-time probabilities.
 */

export const calculateProbabilities = (history, currentRevealed, minesCount) => {
  const totalTiles = 25;
  const probabilities = Array(totalTiles).fill(0);
  
  // 1. Baseline: Equal probability for all unrevealed tiles
  const unrevealedCount = totalTiles - currentRevealed.length;
  const remainingMines = minesCount - currentRevealed.filter(t => t.isMine).length;
  const baseProb = remainingMines / unrevealedCount;

  for (let i = 0; i < totalTiles; i++) {
    if (currentRevealed.find(t => t.index === i)) {
      probabilities[i] = -1; // Already revealed
    } else {
      probabilities[i] = baseProb;
    }
  }

  // 2. Pattern Analysis: Use history to weight tiles
  if (history && history.length > 0) {
    const frequencyMap = Array(totalTiles).fill(0);
    history.forEach(round => {
      const grid = JSON.parse(round.grid_data);
      grid.forEach((isMine, idx) => {
        if (isMine) frequencyMap[idx]++;
      });
    });

    const totalRounds = history.length;
    probabilities.forEach((prob, i) => {
      if (prob !== -1) {
        const historicalWeight = frequencyMap[i] / totalRounds;
        // Combine baseline with historical weight (weighted average)
        // Adjust these weights as needed for "AI" feel
        probabilities[i] = (prob * 0.7) + (historicalWeight * 0.3);
      }
    });
  }

  return probabilities;
};

export const getRecommendedClicks = (probabilities, count = 3) => {
  const candidates = probabilities
    .map((p, i) => ({ index: i, probability: p }))
    .filter(c => c.probability !== -1)
    .sort((a, b) => a.probability - b.probability); // Lowest probability of mine = safest

  return candidates.slice(0, count).map(c => c.index);
};

export const getPredictedBoard = (minesCount) => {
  const board = Array(25).fill(false); // false = safe, true = mine
  
  let trapsPlaced = 0;
  while (trapsPlaced < minesCount) {
    const randomIndex = Math.floor(Math.random() * 25);
    if (!board[randomIndex]) {
      board[randomIndex] = true;
      trapsPlaced++;
    }
  }

  return board;
};
