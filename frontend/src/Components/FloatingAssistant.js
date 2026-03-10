import React from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import './FloatingAssistant.css';

function FloatingAssistant({ onClick }) {
  return (
    <div className="floating-assistant" onClick={onClick}>
      <DotLottieReact
        src="https://lottie.host/c1110b37-658f-4161-b1e2-9f425e8aefe1/gCOADdinfh.lottie"
        loop
        autoplay
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}

export default FloatingAssistant;
