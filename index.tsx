
// ############################################################
// # SYSTEM ENTRY POINT - REVOLUTION V2.0 (MODULAR)
// # ARCHITECTURE: REPOSITORY + CONTEXT API + AUTH ISOLATION
// ############################################################

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { AppProvider } from './contexts/AppContext';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AppProvider>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </AppProvider>
  </React.StrictMode>
);
