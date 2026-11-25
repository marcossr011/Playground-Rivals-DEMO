import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource-variable/outfit';
import '@fontsource-variable/inter';
import 'leaflet/dist/leaflet.css';
import './styles/base.css';
import './styles/app.css';
import './styles/games.css';
import './styles/outdoor.css';
import './styles/social.css';
import App from './App';
import { AppProvider } from './state/AppContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppProvider>
        <App />
      </AppProvider>
    </BrowserRouter>
  </React.StrictMode>
);
