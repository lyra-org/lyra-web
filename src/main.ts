// This Source Code Form is subject to the terms of the Lyra Public License,
// v1.0. If a copy of the Lyra Public License was not distributed with this file,
// You can obtain one here:
// www.meshiplaw.com/lyra.

import { mount } from "svelte";
import "./app.css";
// Side-effect import: applies the .dark class to <html> before App mounts,
// so the initial paint matches the active theme (no flash).
import "./lib/theme.svelte.ts";
import App from "./App.svelte";

const app = mount(App, {
  target: document.getElementById("app")!,
});

export default app;
