const mockUnref = jest.fn();
const mockSpawn = jest.fn().mockReturnValue({ unref: mockUnref });

jest.mock('child_process', () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
}));

import { NodeProcessLauncher } from '../../../../src/infrastructure/process/NodeProcessLauncher';

describe('NodeProcessLauncher', () => {
  beforeEach(() => {
    mockSpawn.mockClear();
    mockUnref.mockClear();
  });

  it('spawns the process detached with ignored stdio, then unrefs it', () => {
    const launcher = new NodeProcessLauncher();

    launcher.launchDetached('emulator', ['-avd', 'Pixel_5_API_33']);

    expect(mockSpawn).toHaveBeenCalledWith('emulator', ['-avd', 'Pixel_5_API_33'], {
      detached: true,
      stdio: 'ignore',
    });
    expect(mockUnref).toHaveBeenCalledTimes(1);
  });
});
