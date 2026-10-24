import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles/app.css';
import './styles/quiz.css';
import './styles/engine.css';
import './styles/dashboard.css';
import './styles/redesign.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Failed to find root element');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
