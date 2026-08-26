import path from 'path';
import { FileApkValidator } from '../../../../src/infrastructure/apk/FileApkValidator';
import { ApkValidationError } from '../../../../src/core/errors/ApkValidationError';
import { createMockLogger } from '../../support/createMockLogger';

describe('FileApkValidator', () => {
  const fixturesDir = path.resolve(__dirname, '../../../fixtures/apks');

  it('passes validation for a file with a valid ZIP magic number and .apk extension', async () => {
    const validator = new FileApkValidator(createMockLogger());

    const result = await validator.validate(path.join(fixturesDir, 'valid-fake.apk'));

    expect(result.isOk()).toBe(true);
  });

  it('fails validation when the file does not have a .apk extension', async () => {
    const validator = new FileApkValidator(createMockLogger());

    const result = await validator.validate(path.join(fixturesDir, 'valid-fake.apk.txt'));

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ApkValidationError);
    expect(result.unwrapErr().message).toMatch(/\.apk extension/);
  });

  it('fails validation when the file does not exist', async () => {
    const validator = new FileApkValidator(createMockLogger());

    const result = await validator.validate(path.join(fixturesDir, 'does-not-exist.apk'));

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toMatch(/does not exist/);
  });

  it('fails validation when the file is not a valid ZIP/APK archive', async () => {
    const validator = new FileApkValidator(createMockLogger());

    const result = await validator.validate(path.join(fixturesDir, 'invalid-not-a-zip.apk'));

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toMatch(/not a valid ZIP\/APK archive/);
  });
});
