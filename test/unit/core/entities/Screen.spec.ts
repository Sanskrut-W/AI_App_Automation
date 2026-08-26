import { Screen, ScreenProps } from '../../../../src/core/entities/Screen';

describe('Screen', () => {
  const validProps: ScreenProps = {
    screenId: 'screen-1',
    screenName: 'Home',
    screenshotPath: '/artifacts/screenshots/screen-1.png',
    xmlPath: '/artifacts/xml-dumps/screen-1.xml',
    packageName: 'com.example.calculator',
    activityName: '.MainActivity',
    parentScreenId: null,
    navigationPath: ['screen-1'],
    discoveredAt: '2026-07-20T00:00:00.000Z',
    structuralHash: 'hash-1',
  };

  it('constructs a screen with all provided fields', () => {
    const screen = new Screen(validProps);

    expect(screen.screenId).toBe('screen-1');
    expect(screen.screenName).toBe('Home');
    expect(screen.screenshotPath).toBe(validProps.screenshotPath);
    expect(screen.xmlPath).toBe(validProps.xmlPath);
    expect(screen.packageName).toBe(validProps.packageName);
    expect(screen.activityName).toBe(validProps.activityName);
    expect(screen.parentScreenId).toBeNull();
    expect(screen.navigationPath).toEqual(['screen-1']);
    expect(screen.discoveredAt).toBe(validProps.discoveredAt);
    expect(screen.structuralHash).toBe('hash-1');
  });

  it('throws when screenId is empty', () => {
    expect(() => new Screen({ ...validProps, screenId: '' })).toThrow(/non-empty screenId/);
  });

  it('supports a non-null parentScreenId and a multi-step navigationPath for non-root screens', () => {
    const screen = new Screen({
      ...validProps,
      screenId: 'screen-2',
      parentScreenId: 'screen-1',
      navigationPath: ['screen-1', 'screen-2'],
    });

    expect(screen.parentScreenId).toBe('screen-1');
    expect(screen.navigationPath).toEqual(['screen-1', 'screen-2']);
  });
});
