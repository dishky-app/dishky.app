import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './pages/ModalCSS.css'; // admin-modal + animation styles (the crop dialog uses them on every page)
import App from './App';
import { BrowserRouter } from "react-router-dom";
import { ToastProvider } from "./useToast";
import TableScrollButtons from "./components/TableScrollButtons";
import { AuthProvider } from "./context/AuthContext";
import { VenueProvider } from "./context/VenueContext";
import { CategoryCardsProvider } from "./context/CategoryCardsContext";
import { ModalProvider } from "./context/ModalContext";
import ErrorBoundary from "./components/ErrorBoundary";
import { installInputLimits } from "./utils/enforceInputLimits";
import { installContentProtection } from "./utils/contentProtection";
import { installImageCropper } from "./utils/imageCropper";

import 'bootstrap/dist/css/bootstrap.min.css';
import * as bootstrap from 'bootstrap/dist/js/bootstrap.bundle.min.js';

// Every input: max 100 characters / 5 words; every textarea: max 500 characters.
installInputLimits();
// No dragging images / selecting or copying page text; every picked image goes through the crop step.
installContentProtection();
installImageCropper();
// bootstrap's UMD bundle attaches itself to `window.bootstrap` in a plain
// <script> tag, but under a bundler (webpack/CRA) it's imported as an ES
// module instead — so nothing sets window.bootstrap automatically. Every
// tooltip in the app (see useGlobalTooltips.js and any manual
// data-bs-toggle="tooltip" markup) initializes via window.bootstrap.Tooltip,
// so without this line tooltips silently never appear.
window.bootstrap = bootstrap.default || bootstrap;

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <ErrorBoundary>
    <BrowserRouter>
      <AuthProvider>
        <VenueProvider>
          <CategoryCardsProvider>
            <ToastProvider>
              <ModalProvider>
                <App />
                <TableScrollButtons />
              </ModalProvider>
            </ToastProvider>
          </CategoryCardsProvider>
        </VenueProvider>
      </AuthProvider>
    </BrowserRouter>
  </ErrorBoundary>
);
