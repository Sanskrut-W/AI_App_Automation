import { Element, ElementProps } from '../../../../src/core/entities/Element';
import { LocatorStrategy } from '../../../../src/core/enums/LocatorStrategy';

describe('Element', () => {
  const validProps: ElementProps = {
    elementId: 'element-1',
    screenId: 'screen-1',
    className: 'android.widget.Button',
    text: 'Calculate',
    resourceId: 'com.example.app:id/btnCalculate',
    accessibilityId: '',
    contentDescription: '',
    bounds: { left: 100, top: 200, right: 300, bottom: 260 },
    clickable: true,
    enabled: true,
    selected: false,
    checked: false,
    isPassword: false,
    parentElementId: 'element-0',
    childElementIds: [],
    locators: [
      {
        strategy: LocatorStrategy.RESOURCE_ID,
        value: 'com.example.app:id/btnCalculate',
        priority: 1,
      },
    ],
  };

  it('constructs an element with all provided fields', () => {
    const element = new Element(validProps);

    expect(element.elementId).toBe('element-1');
    expect(element.screenId).toBe('screen-1');
    expect(element.className).toBe('android.widget.Button');
    expect(element.text).toBe('Calculate');
    expect(element.resourceId).toBe(validProps.resourceId);
    expect(element.bounds).toEqual(validProps.bounds);
    expect(element.clickable).toBe(true);
    expect(element.parentElementId).toBe('element-0');
    expect(element.childElementIds).toEqual([]);
    expect(element.locators).toEqual(validProps.locators);
  });

  it('throws when elementId is empty', () => {
    expect(() => new Element({ ...validProps, elementId: '' })).toThrow(/non-empty elementId/);
  });

  it('throws when screenId is empty', () => {
    expect(() => new Element({ ...validProps, screenId: '' })).toThrow(/non-empty screenId/);
  });

  it('supports a null parent and non-empty children for a root/container element', () => {
    const element = new Element({
      ...validProps,
      elementId: 'element-0',
      parentElementId: null,
      childElementIds: ['element-1'],
    });

    expect(element.parentElementId).toBeNull();
    expect(element.childElementIds).toEqual(['element-1']);
  });
});
