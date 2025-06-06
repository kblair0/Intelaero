// components/Map/UI/ProgressBar.tsx
import React from 'react';

interface ProgressBarProps {
  progress: number; // value between 0 and 100
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress }) => {
  return (
    <div style={styles.container}>
      <div style={{ ...styles.bar, width: `${progress}%` }} />
    </div>
  );
};

const styles = {
  container: {
    width: '100%', // Removed absolute positioning
    height: '10px',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: '5px',
  },
  bar: {
    height: '100%',
    backgroundColor: '#1976d2',
    borderRadius: '5px',
    transition: 'width 0.3s ease',
  },
};
