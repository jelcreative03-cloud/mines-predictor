import React from 'react';
import { motion } from 'framer-motion';
import { Skull, Gem, Zap } from 'lucide-react';

const StarIcon = () => (
  <svg viewBox="0 0 100 100" className="w-[80%] h-[80%] drop-shadow-xl" style={{ filter: 'drop-shadow(0px 6px 8px rgba(0,0,0,0.6))' }}>
    <defs>
      <linearGradient id="starGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FFA03A" />
        <stop offset="50%" stopColor="#F97316" />
        <stop offset="100%" stopColor="#C2410C" />
      </linearGradient>
      <linearGradient id="starInner" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FFDDBB" />
        <stop offset="100%" stopColor="#EA580C" />
      </linearGradient>
    </defs>
    <path d="M50 5 L64 35 L97 38 L72 61 L79 94 L50 77 L21 94 L28 61 L3 38 L36 35 Z" fill="url(#starGrad)" stroke="url(#starInner)" strokeWidth="3" strokeLinejoin="round"/>
  </svg>
);

const XIcon = () => (
  <svg viewBox="0 0 100 100" className="w-[70%] h-[70%] drop-shadow-xl" style={{ filter: 'drop-shadow(0px 6px 8px rgba(0,0,0,0.6))' }}>
    <defs>
      <linearGradient id="xGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#87CEFA" stopOpacity="0.95" />
        <stop offset="100%" stopColor="#4682B4" stopOpacity="0.95" />
      </linearGradient>
      <linearGradient id="xInner" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#E0FFFF" stopOpacity="0.8" />
        <stop offset="100%" stopColor="#5F9EA0" stopOpacity="0.8" />
      </linearGradient>
    </defs>
    <path d="M20 20 L35 20 L50 40 L65 20 L80 20 L55 50 L80 80 L65 80 L50 60 L35 80 L20 80 L45 50 Z" fill="url(#xGrad)" stroke="url(#xInner)" strokeWidth="3" strokeLinejoin="round" rx="5" ry="5"/>
  </svg>
);

const MinesGrid = ({ 
  probabilities, 
  revealed, 
  onTileClick, 
  recommended,
  predictedBoard,
  isShuffling
}) => {
  return (
    <div className="mines-grid glass">
      {Array(25).fill(null).map((_, i) => {
        const isRevealed = revealed.find(t => t.index === i);
        const isRecommended = recommended.includes(i);
        const prob = probabilities[i];
        const isPredicted = predictedBoard !== null;
        
        if (isPredicted) {
          const isMine = predictedBoard[i];
          return (
            <motion.div
              key={i}
              initial={{ rotateY: 90, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              transition={{ delay: i * 0.02, duration: 0.3 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onTileClick(i)}
              className="flex items-center justify-center cursor-pointer"
            >
              {isMine ? <XIcon /> : <StarIcon />}
            </motion.div>
          );
        }

        const getHeatColor = (p) => {
          if (p === -1) return 'transparent';
          // Red for high probability of mine, Green for low
          const r = Math.floor(p * 255);
          const g = Math.floor((1 - p) * 255);
          return `rgba(${r}, ${g}, 100, 0.15)`;
        };

        let tileClass = "tile";
        if (isRevealed) {
          tileClass += isRevealed.isMine ? " revealed-mine" : " revealed-safe";
        } else if (isRecommended) {
          tileClass += " recommended";
        }

        return (
          <motion.div
            key={i}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onTileClick(i)}
            className={tileClass}
          >
            {isRevealed ? (
              isRevealed.isMine ? (
                <Skull className="text-accent-danger" size={32} />
              ) : (
                <Gem className="text-accent-safe" size={32} />
              )
            ) : (
              <>
                <span className="prob-text">
                  {(prob * 100).toFixed(0)}%
                </span>
                {isRecommended && <Zap className="text-accent-predict animate-pulse" size={16} />}
                <div 
                  className="heatmap-overlay"
                  style={{ backgroundColor: getHeatColor(prob) }}
                />
              </>
            )}
          </motion.div>
        );
      })}
    </div>
  );
};

export default MinesGrid;
