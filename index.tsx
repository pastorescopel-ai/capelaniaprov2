
// ############################################################
// # SYSTEM ENTRY POINT - RESTORE POINT V2.1.0-STABLE
// # PONTO DE RECUPERAÇÃO GERAL DO SISTEMA - CÓDIGO ÍNTEGRO
// # DATA: 20/05/2024 - VERSÃO PRO 2.1.0
// ############################################################

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
