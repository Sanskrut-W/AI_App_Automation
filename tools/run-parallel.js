#!/usr/bin/env node
/**
 * Runs test cases on several devices at the same time — one worker per device.
 *
 * Why one worker per DEVICE and not per test case: a phone has a single foreground app and a
 * single screen, so unlike a browser (where Playwright opens many cheap, isolated contexts in one
 * process) there is no way to drive two test cases against one app on one device concurrently. The
 * device is the unit of parallelism, and each worker needs:
 *
 *   - its own Appium server port          (this script starts one server per worker)
 *   - its own UiAutomator2 systemPort     (APPIUM_SYSTEMPORT — see runWorker; two sessions both
 *                                          defaulting to 8200 fight over that host port)
 *   - its own test account               (config/test-accounts.json -> deviceAccounts; sharing one
 *                                          account means the workers log each other out)
 *
 * Usage:
 *   node tools/run-parallel.js --package com.betwayafrica.za --module manual \
 *     --run <serial>=<testCaseId>[,<testCaseId>...] --run <serial>=<testCaseId> [--keep-appium]
 *
 * Each --run pairs a device with the test case it should execute. Add more --run flags for more
 * devices. Devices are verified present via adb, and each one's account assignment is checked
 * before anything launches, so a misconfigured run fails in seconds rather than mid-suite.
 */
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const BASE_APPIUM_PORT = 4723;
const BASE_SYSTEM_PORT = 8200;
const APPIUM_START_TIMEOUT_MS = 90_000;

function parseArgs(argv) {
  const args = { runs: [], keepAppium: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[i + 1];
      if (!value) throw new Error(`${arg} needs a value`);
      i += 1;
      return value;
    };
    switch (arg) {
      case '--package':
        args.packageName = next();
        break;
      case '--module':
        args.module = next();
        break;
      case '--run': {
        const [serial, ids] = next().split('=');
        const testCaseIds = (ids ?? '').split(',').map((id) => id.trim()).filter(Boolean);
        if (!serial || testCaseIds.length === 0) {
          throw new Error('--run must look like <deviceSerial>=<testCaseId>[,<testCaseId>...]');
        }
        args.runs.push({ serial, testCaseIds });
        break;
      }
      case '--keep-appium':
        args.keepAppium = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!args.packageName) throw new Error('--package is required');
  if (!args.module) throw new Error('--module is required');
  if (args.runs.length === 0) throw new Error('at least one --run is required');
  return args;
}

function attachedDevices() {
  const result = spawnSync('adb', ['devices'], { encoding: 'utf8', shell: true });
  if (result.status !== 0) throw new Error(`adb devices failed: ${result.stderr}`);
  return result.stdout
    .split('\n')
    .slice(1)
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) => parts.length >= 2 && parts[1] === 'device')
    .map((parts) => parts[0]);
}

/**
 * Confirms every device has its own distinct account before any session opens. Two workers sharing
 * an account is the failure that looks like a flaky test but isn't: they overwrite each other's
 * session and read each other's balance.
 */
function verifyAccounts(packageName, runs) {
  const configPath = path.join(REPO_ROOT, 'config', 'test-accounts.json');
  if (!fs.existsSync(configPath)) {
    throw new Error(`Missing ${configPath} — copy config/test-accounts.example.json and fill it in.`);
  }
  const entry = JSON.parse(fs.readFileSync(configPath, 'utf8'))[packageName];
  if (!entry) throw new Error(`config/test-accounts.json has no entry for ${packageName}`);

  const assignments = runs.map(({ serial }) => {
    const accountId = entry.deviceAccounts?.[serial];
    if (!accountId) {
      throw new Error(
        `Device ${serial} has no account in config/test-accounts.json -> ${packageName}.deviceAccounts. ` +
          'Running several devices at once needs one account each.',
      );
    }
    if (!entry.accounts?.[accountId]) {
      throw new Error(`Account "${accountId}" (mapped to ${serial}) is not defined under accounts.`);
    }
    return { serial, accountId };
  });

  const duplicates = assignments
    .map((a) => a.accountId)
    .filter((id, index, all) => all.indexOf(id) !== index);
  if (duplicates.length > 0) {
    throw new Error(
      `Devices share the account(s) ${[...new Set(duplicates)].join(', ')}. ` +
        'Each concurrent device needs its own account or they will log each other out.',
    );
  }
  return assignments;
}

function appiumStatus(port) {
  return new Promise((resolve) => {
    const request = http.get({ host: '127.0.0.1', port, path: '/status', timeout: 2000 }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    request.on('error', () => resolve(false));
    request.on('timeout', () => {
      request.destroy();
      resolve(false);
    });
  });
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Starts an Appium server on this port, or reuses one that is already listening. */
async function ensureAppium(port) {
  if (await appiumStatus(port)) {
    console.log(`  appium :${port} already running — reusing it`);
    return null;
  }
  console.log(`  starting appium :${port}`);
  const child = spawn('appium', ['-p', String(port)], {
    shell: true,
    stdio: 'ignore',
    detached: false,
  });
  const deadline = Date.now() + APPIUM_START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await delay(1000);
    if (await appiumStatus(port)) {
      console.log(`  appium :${port} ready`);
      return child;
    }
    if (child.exitCode !== null) {
      throw new Error(`appium :${port} exited with code ${child.exitCode}`);
    }
  }
  child.kill();
  throw new Error(`appium :${port} did not become ready within ${APPIUM_START_TIMEOUT_MS}ms`);
}

/** Returns the app to a logged-out state on one device, so a run starts from a known state. */
function resetDevice(serial) {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [path.join(REPO_ROOT, 'tools', 'generators', 'reset-logged-out.js'), serial],
      { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let output = '';
    child.stdout.on('data', (d) => (output += d));
    child.stderr.on('data', (d) => (output += d));
    child.on('close', (code) => {
      const last = output.trim().split('\n').pop() ?? '';
      console.log(`  [${serial}] reset: ${last}`);
      resolve(code === 0);
    });
  });
}

function runWorker({ serial, testCaseIds, appiumPort, systemPort, packageName, module: mod }) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(
      process.execPath,
      [
        path.join(REPO_ROOT, 'dist', 'main.js'),
        '--execute-only',
        '--package',
        packageName,
        '--module',
        mod,
        // Repeated per test case: they run back-to-back on this device in one session, with the
        // account's logout teardown between them.
        ...testCaseIds.flatMap((id) => ['--test-case-id', id]),
        '--device',
        serial,
      ],
      {
        cwd: REPO_ROOT,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          APPIUM_PORT: String(appiumPort),
          // Each worker gets its own host-side UiAutomator2 bridge port.
          //
          // The name matters and is easy to get wrong: EnvConfigProvider maps a dot-path config
          // key to an env var by upper-casing it and replacing dots with underscores, so
          // "appium.systemPort" becomes APPIUM_SYSTEMPORT — not APPIUM_SYSTEM_PORT, which would
          // map to the non-existent key "appium.system.port" and be ignored. Getting this wrong
          // is not a quiet no-op: both workers then take the default 8200, and the second one's
          // failure to bind tears down the bridge the FIRST worker is already using, so a healthy
          // run dies mid-suite with ECONNREFUSED 127.0.0.1:8200 (observed exactly this way).
          APPIUM_SYSTEMPORT: String(systemPort),
        },
      },
    );

    const logPath = path.join(REPO_ROOT, 'logs', `parallel-${serial}-${started}.log`);
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    const logStream = fs.createWriteStream(logPath);
    let tail = '';
    const capture = (chunk) => {
      logStream.write(chunk);
      tail = (tail + chunk).slice(-4000);
    };
    child.stdout.on('data', capture);
    child.stderr.on('data', capture);

    child.on('close', (code) => {
      logStream.end();
      const reportMatch = /HTML report:\s*(\S+\.html)/.exec(tail);
      const countsMatch = /Test cases executed:\s*(\d+)\s*\((\d+) passed, (\d+) failed\)/.exec(tail);
      resolve({
        serial,
        testCaseIds,
        exitCode: code,
        durationMs: Date.now() - started,
        passed: countsMatch ? Number(countsMatch[2]) : null,
        failed: countsMatch ? Number(countsMatch[3]) : null,
        report: reportMatch ? reportMatch[1] : null,
        logPath,
      });
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  console.log('Preflight');
  const attached = attachedDevices();
  const missing = args.runs.map((r) => r.serial).filter((s) => !attached.includes(s));
  if (missing.length > 0) {
    throw new Error(
      `Not attached: ${missing.join(', ')}. adb sees: ${attached.join(', ') || '(none)'}`,
    );
  }
  console.log(`  devices: ${args.runs.map((r) => r.serial).join(', ')}`);

  const assignments = verifyAccounts(args.packageName, args.runs);
  for (const { serial, accountId } of assignments) {
    console.log(`  ${serial} -> account "${accountId}"`);
  }

  const workers = args.runs.map((run, index) => ({
    ...run,
    packageName: args.packageName,
    module: args.module,
    appiumPort: BASE_APPIUM_PORT + index,
    systemPort: BASE_SYSTEM_PORT + index,
  }));

  const servers = [];
  try {
    for (const worker of workers) {
      servers.push(await ensureAppium(worker.appiumPort));
    }

    // Sequentially, not in parallel: reset-logged-out.js talks to Appium on a fixed port and sets
    // no systemPort of its own, so two concurrent resets would both take the default host bridge
    // port (8200) and collide. Each reset only takes a few seconds, so serialising costs little.
    console.log('\nResetting devices to a logged-out state');
    for (const worker of workers) {
      await resetDevice(worker.serial);
    }

    console.log('\nRunning');
    for (const w of workers) {
      console.log(
        `  [${w.serial}] ${w.testCaseIds.join(' then ')}  (appium :${w.appiumPort}, systemPort ${w.systemPort})`,
      );
    }
    const started = Date.now();
    const results = await Promise.all(workers.map((w) => runWorker(w)));
    const wallClock = Date.now() - started;

    console.log('\n=== Parallel run complete ===');
    let anyFailed = false;
    let sequentialMs = 0;
    for (const r of results) {
      sequentialMs += r.durationMs;
      // The CLI exits 0 even when a test case fails, so the counts it printed are what decide the
      // verdict; the exit code only matters when it is non-zero (a crash before the summary).
      const verdict =
        r.failed === null
          ? `UNKNOWN — could not parse the run summary (exit ${r.exitCode}); see the log`
          : r.failed === 0 && r.exitCode === 0
            ? 'PASSED'
            : `FAILED — ${r.failed} of ${(r.passed ?? 0) + r.failed} test case(s) failed`;
      if (verdict !== 'PASSED') anyFailed = true;
      console.log(`  ${r.serial}  ${r.testCaseIds.join(' then ')}`);
      console.log(`    ${verdict}  ${(r.durationMs / 1000).toFixed(0)}s`);
      if (r.report) console.log(`    report: ${r.report}`);
      console.log(`    log:    ${r.logPath}`);
    }
    console.log(
      `\n  wall clock: ${(wallClock / 1000).toFixed(0)}s  ` +
        `(sequential would have been ~${(sequentialMs / 1000).toFixed(0)}s)`,
    );
    process.exitCode = anyFailed ? 1 : 0;
  } finally {
    const started = servers.filter(Boolean);
    if (started.length > 0 && !args.keepAppium) {
      console.log('\nStopping the Appium servers this run started');
      for (const server of started) server.kill();
    }
  }
}

main().catch((error) => {
  console.error(`\nrun-parallel failed: ${error.message}`);
  process.exit(1);
});
