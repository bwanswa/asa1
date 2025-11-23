// pages/SystemModal.jsx
import React from 'react';

export const SystemModal = ({ message }) => (
    <div
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        color: 'white',
        padding: '15px 30px',
        borderRadius: '10px',
        zIndex: 100,
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        fontWeight: 'bold',
        textAlign: 'center',
        opacity: 1,
        transition: 'opacity 0.3s ease-out'
      }}
    >
      {message}
    </div>
);
