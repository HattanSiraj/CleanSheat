import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import { initializeCleanSheetStorage } from "./workspaceStorage.js";

initializeCleanSheetStorage()
  .catch(() => {})
  .finally(() => {
    createRoot(document.getElementById("root")).render(<App />);
  });
