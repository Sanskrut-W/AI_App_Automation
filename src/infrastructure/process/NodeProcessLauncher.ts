import { spawn } from 'child_process';
import { IProcessLauncher } from '../../shared/process/IProcessLauncher';

/** Spawns a detached child process with ignored stdio and unrefs it so Node can exit independently of it. */
export class NodeProcessLauncher implements IProcessLauncher {
  launchDetached(command: string, args: string[]): void {
    const child = spawn(command, args, { detached: true, stdio: 'ignore' });
    child.unref();
  }
}
