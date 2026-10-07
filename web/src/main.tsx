import { Globals } from "@react-spring/web";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

// Respect the OS "reduce motion" setting: springs jump straight to their end state.
Globals.assign({ skipAnimation: window.matchMedia("(prefers-reduced-motion: reduce)").matches });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
