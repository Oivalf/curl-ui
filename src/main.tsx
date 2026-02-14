import { render } from "preact";
import App from "./App";
import "./styles/global.css";
import { initConsoleRedirect } from "./utils/consoleRedirect";

initConsoleRedirect();

render(<App />, document.getElementById("root")!);
