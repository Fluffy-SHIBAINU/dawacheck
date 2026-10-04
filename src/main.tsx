import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/archivo/700.css';
import '@fontsource/archivo/800.css';
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/600.css';
import './styles/tokens.css';
import './styles/app.css';
import { App } from './App';
import { getWorker } from './ocr/engine';
import { prewarmOcrOnFirstVisit } from './ocr/prewarm';

prewarmOcrOnFirstVisit(undefined, getWorker);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
