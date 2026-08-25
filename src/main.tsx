import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

// Регистрация Service Worker для офлайн-работы и установки на Android
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js")
      .then((registration) => {
        console.log("SW зарегистрирован:", registration.scope);
      })
      .catch((error) => {
        console.log("Ошибка регистрации SW:", error);
      });
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
