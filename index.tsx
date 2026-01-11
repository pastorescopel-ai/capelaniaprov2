
// ############################################################
// # SYSTEM ENTRY POINT - RESTORE POINT V1.1.5-STABLE
// # EVERYTHING IS WORKING PERFECTLY UP TO THIS POINT
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