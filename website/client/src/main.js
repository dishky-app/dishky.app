import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.js";
import { AppProvider } from "./context/AppContext.js";
import { OwnerProvider } from "./context/OwnerContext.js";
import { ToastProvider } from "./components/Toast/Toast.js";
import protectContent from "./utils/protectContent.js";
import "./index.css";
import "./styles/skins.css";

protectContent();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ToastProvider>
      <AppProvider>
        <OwnerProvider>
          <App />
        </OwnerProvider>
      </AppProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);
