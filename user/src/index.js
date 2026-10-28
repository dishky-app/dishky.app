import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import TenantGate from './TenantGate';
import tenant from './tenant';
import { ThemeProvider } from './components/ThemeContext';
import { ToastProvider } from './components/Usetoast';
import { installInputLimits } from './utils/enforceInputLimits';
import { installContentProtection } from './utils/contentProtection';
import { installImageCropper } from './utils/imageCropper';

import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';

// Every input: max 100 characters / 5 words; every textarea: max 500 characters.
installInputLimits();
// No dragging images / selecting or copying page text; every picked image goes through the crop step.
installContentProtection();
installImageCropper();

const root = ReactDOM.createRoot(document.getElementById('root'));
// dishky.com/<restaurant>/<venue>/display shows the order-status board. It is
// loaded lazily so its (full-screen, global) styles never touch the ordering app.
const DisplayPanel = React.lazy(() => import('./Display/DisplayPanel'));

root.render(
  <TenantGate>
    {tenant.display ? (
      <React.Suspense fallback={null}>
        <DisplayPanel />
      </React.Suspense>
    ) : (
      <ThemeProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </ThemeProvider>
    )}
  </TenantGate>
);
