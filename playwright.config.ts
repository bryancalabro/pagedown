import { existsSync } from "node:fs";
import { chromium, defineConfig, devices } from "@playwright/test";

// claude code cloud sessions ship a pre-installed chromium; Cursor VMs often have system Chrome.
// never download browsers here. prefer Playwright's own build, then known system paths.
// /new-app copies this file into each scaffold, so the candidate list has to travel with it.
const BROWSER_CANDIDATES = [
    "/opt/pw-browsers/chromium",
    "/opt/google/chrome/chrome",
    "/usr/bin/google-chrome",
    "/usr/local/bin/google-chrome",
];
const executablePath = existsSync(chromium.executablePath())
    ? undefined
    : BROWSER_CANDIDATES.find((p) => existsSync(p));

// a port of its own: vite preview defaults to 4173, so a sibling build on this machine would answer there.
// /new-app changes it in every copy, since two apps on one port test each other.
const PORT = 4991;

// a Claude Code cloud session runs as root, where Chromium's sandbox refuses to start at all
const isRoot = process.getuid?.() === 0;

export default defineConfig({
    testDir: "e2e",
    
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: 0,
    reporter: "list",
    use: {
        baseURL: `http://localhost:${PORT}`,
        colorScheme: "light",
        launchOptions: { executablePath, args: isRoot ? ["--no-sandbox"] : [] },
        screenshot: "only-on-failure",
        trace: "retain-on-failure",
    },
    projects: [
        { name: "desktop", use: { ...devices["Desktop Chrome"] } },
        // a plain viewport on the desktop device, not devices["Pixel 7"]: any isMobile/hasTouch
        // preset crashes Chromium's mobile-emulation code path in a sandboxed root container
        { name: "mobile", use: { ...devices["Desktop Chrome"], viewport: { width: 412, height: 915 } } },
    ],
    // the suite runs against the production build, the same bundle vercel serves
    webServer: {
        command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
        url: `http://localhost:${PORT}`,
        // never reuse: a server already on the port is another app or a build from before the last change
        reuseExistingServer: false,
        timeout: 180_000,
    },
});
