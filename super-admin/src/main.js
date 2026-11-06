import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.js";
import { AuthProvider } from "./auth.js";
import { ToastProvider } from "./useToast.js";
import TableScrollButtons from "./components/TableScrollButtons.js";
import { installInputLimits } from "./enforceInputLimits.js";
import { installContentProtection } from "./contentProtection.js";
import { installImageCropper } from "./imageCropper.js";
import { installFormRules } from "./formRules.js";
import GlobalConfirm from "./components/GlobalConfirm.js";
// Same stylesheet stack as the Admin Panel: shared Common.css first.
import "./Common.css";
import "./admin-shared.css";
import "./admin-forms.css";
import "./styles.css";
import "./details.css";
import "./tickets/tickets.css";
import "./responsive.css";

// Every input: max 100 characters / 5 words; every textarea: max 500 characters.
installInputLimits();
// No dragging images / selecting or copying page text; every picked image goes through the crop step.
installContentProtection();
installImageCropper();
// Mobile numbers: 10 digits; name fields capitalised; password fields get a show/hide eye.
installFormRules();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <App />
          <TableScrollButtons />
          <GlobalConfirm />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);
