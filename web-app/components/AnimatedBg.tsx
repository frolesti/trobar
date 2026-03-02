import React from 'react';

export default function AnimatedBg() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        zIndex: -1,
        pointerEvents: 'none',
        backgroundImage: 'url(https://via.placeholder.com/1920x1080.gif?text=Background+GIF+Placeholder)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        opacity: 0.3,
        filter: 'blur(2px)'
      }}
    />
  );
}
