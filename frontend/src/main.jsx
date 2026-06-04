import React from "react";
import ReactDOM from "react-dom/client";
import { Toaster } from "react-hot-toast";
import App from "./App.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: "#1a1a2e",
          color: "#f0f0f5",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "10px",
          fontFamily: "'DM Sans', sans-serif",
          fontSize: "14px",
        },
        success: { iconTheme: { primary: "#4ade80", secondary: "#1a1a2e" } },
        error: { iconTheme: { primary: "#f87171", secondary: "#1a1a2e" } },
      }}
    />
    <App />
  </React.StrictMode>
);