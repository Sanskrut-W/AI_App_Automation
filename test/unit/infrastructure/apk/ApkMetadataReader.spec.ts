const mockParse = jest.fn();

jest.mock('app-info-parser', () => {
  return jest.fn().mockImplementation(() => ({
    parse: mockParse,
  }));
});

import AppInfoParser from 'app-info-parser';
import { ApkMetadataReader } from '../../../../src/infrastructure/apk/ApkMetadataReader';
import { ApkMetadataError } from '../../../../src/core/errors/ApkMetadataError';
import { createMockLogger } from '../../support/createMockLogger';

describe('ApkMetadataReader', () => {
  beforeEach(() => {
    mockParse.mockReset();
    (AppInfoParser as unknown as jest.Mock).mockClear();
  });

  it('maps a successfully parsed manifest into an ApkMetadataDto', async () => {
    mockParse.mockResolvedValue({
      package: 'com.example.calculator',
      versionName: '1.2.3',
      versionCode: 7,
      application: {
        label: 'Calculator',
        launcherActivities: [{ name: '.MainActivity' }],
      },
    });

    const reader = new ApkMetadataReader(createMockLogger());
    const result = await reader.read('/fake/path/app.apk');

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toEqual({
      packageName: 'com.example.calculator',
      versionName: '1.2.3',
      versionCode: '7',
      appLabel: 'Calculator',
      launcherActivity: '.MainActivity',
    });
  });

  it('defaults launcherActivity to null when no launcher activity is present', async () => {
    mockParse.mockResolvedValue({
      package: 'com.example.notes',
      versionName: '1.0',
      versionCode: 1,
      application: { label: 'Notes', launcherActivities: [] },
    });

    const reader = new ApkMetadataReader(createMockLogger());
    const result = await reader.read('/fake/path/app.apk');

    expect(result.unwrap().launcherActivity).toBeNull();
  });

  it('returns an ApkMetadataError when the manifest has no package name', async () => {
    mockParse.mockResolvedValue({ application: {} });

    const reader = new ApkMetadataReader(createMockLogger());
    const result = await reader.read('/fake/path/app.apk');

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ApkMetadataError);
  });

  it('returns an ApkMetadataError when parsing rejects', async () => {
    mockParse.mockRejectedValue(new Error('corrupt archive'));

    const reader = new ApkMetadataReader(createMockLogger());
    const result = await reader.read('/fake/path/app.apk');

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toMatch(/corrupt archive/);
  });
});
