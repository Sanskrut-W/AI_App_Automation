# Mobile Testing Platform

AI-Powered Autonomous Mobile Testing Platform. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full system design.

## Status

All 15 planned modules are implemented and unit-tested (device/app management, Appium driving,
screen capture, screen/element repositories, autonomous crawling, fingerprinting, Gemini-backed
screen analysis, test case generation, test execution, self-healing locators, and HTML/JSON
reporting), wired together into a single runnable pipeline (`src/main.ts` →
`src/interfaces/cli/commands/RunPipelineCommand.ts`).

Verified end to end against a real Android emulator, a real Appium/UiAutomator2 server, and a
real Gemini API call (full crawl → AI analysis → test generation → execution → report). See
Prerequisites below for what's needed to run it yourself.

## Prerequisites

To run the pipeline against a real APK you need, in addition to this project:

1. **Android SDK** with `adb` and `emulator` on your `PATH` (or set the `adbPath`/`emulatorPath`
   options where the composition root constructs `AdbClient`/`EmulatorDriver`).
2. **A running Appium server** (v2) with the UiAutomator2 driver installed — this project only
   ships a WebdriverIO *client*, it does not start or manage an Appium server itself:
   ```bash
   npm install -g appium
   appium driver install uiautomator2
   appium
   ```
   By default the client connects to `http://localhost:4723`; override via `appium.hostname` /
   `appium.port` / `appium.path` / `appium.protocol` in `config/default.json` or the matching
   `APPIUM_HOSTNAME` / `APPIUM_PORT` / `APPIUM_PATH` / `APPIUM_PROTOCOL` env vars.
3. **A device or emulator** — either an already-running one (get its serial from `adb devices`)
   or an AVD name you want the pipeline to boot for you.
4. **(Optional) a Gemini API key** in `.env` as `GEMINI_API_KEY` — without it, the pipeline still
   crawls the app and produces a report, but skips AI screen analysis and test case generation
   entirely (logged as a warning, not an error).

## Getting Started

```bash
cp .env.example .env
npm install
npm run build
npm test
```

## Per-app data isolation

Every artifact — screenshots, XML dumps, the screen/element repositories, generated test cases,
navigation graph, execution logs, and reports — lives under its own folder,
`artifacts/apps/<packageName>/`. Two different apps never share data. Re-running the same app
reuses its existing folder: the crawler recognizes screens it already knows about (skips
re-persisting them, but still explores through them for anything new), test case generation is
skipped for any screen that already has test cases, and execution always runs the app's *entire*
stored suite (old + newly generated) — this is what makes "generate once, execute repeatedly"
actually work.

## Running the pipeline

Full run — install, crawl, AI-analyze new screens, generate new test cases, execute the whole
stored suite, report:

```bash
# Against an already-running device/emulator:
npm start -- --apk ./path/to/app.apk --device emulator-5554

# Or let it boot an AVD for you first:
npm start -- --apk ./path/to/app.apk --avd Pixel_5_API_33 --boot-timeout-ms 120000

# Cap crawl breadth/depth for a faster, smaller run (e.g. against a large real-world app):
npm start -- --apk ./path/to/app.apk --device emulator-5554 --max-screens 8 --max-depth 6
```

This installs and launches the app, autonomously crawls every reachable screen, (if a Gemini key
is configured) analyzes each new screen and generates test cases from it, executes the app's
entire stored suite — self-healing a locator once if it breaks mid-run, falling back to Gemini for
the healing match only if deterministic fingerprint matching can't find one — and writes an HTML +
JSON report. The emulator (if the pipeline booted one) is left running afterwards; it is not
stopped automatically.

Execute-only — re-run an already-tested app's stored suite with no APK, no crawl, no AI call at
all (e.g. for a daily regression job):

```bash
npm start -- --execute-only --package com.example.app --device emulator-5554
```

See which apps have a stored suite to execute:

```bash
npm start -- --list-apps
```

Help:

```bash
npm start -- --help
```

## Scripts

| Script | Purpose |
|---|---|
| `npm run build` | Type-check and compile `src/` to `dist/` |
| `npm start` | Run the compiled entrypoint (`dist/main.js`) |
| `npm run dev` | Run `src/main.ts` directly with auto-restart on change |
| `npm run typecheck` | Type-check without emitting output |
| `npm run lint` / `lint:fix` | Lint (and auto-fix) `src/` and `test/` |
| `npm run format` / `format:check` | Format (or check formatting of) `src/` and `test/` |
| `npm test` / `test:watch` / `test:coverage` | Run the Jest test suite |
