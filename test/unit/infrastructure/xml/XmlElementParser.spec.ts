import { XmlElementParser } from '../../../../src/infrastructure/xml/XmlElementParser';
import { LocatorStrategy } from '../../../../src/core/enums/LocatorStrategy';
import { XmlParsingError } from '../../../../src/core/errors/XmlParsingError';
import { IIdGenerator } from '../../../../src/shared/id/IIdGenerator';
import { createMockLogger } from '../../support/createMockLogger';

const SAMPLE_XML = `<?xml version='1.0' encoding='UTF-8' standalone='yes'?>
<hierarchy rotation="0">
  <android.widget.FrameLayout class="android.widget.FrameLayout" text="" resource-id="" content-desc="" checkable="false" checked="false" clickable="false" enabled="true" selected="false" bounds="[0,0][1080,2280]">
    <android.widget.Button class="android.widget.Button" text="Calculate" resource-id="com.example.app:id/btnCalculate" content-desc="" checkable="false" checked="false" clickable="true" enabled="true" selected="false" bounds="[100,200][300,260]" />
    <android.widget.Button class="android.widget.Button" text="" resource-id="" content-desc="Clear input" checkable="false" checked="false" clickable="true" enabled="true" selected="false" bounds="[320,200][420,260]" />
    <android.widget.EditText class="android.widget.EditText" text="" resource-id="" content-desc="" checkable="false" checked="true" clickable="true" enabled="false" selected="true" bounds="[100,100][300,160]" />
  </android.widget.FrameLayout>
</hierarchy>`;

function createSequentialIdGenerator(): jest.Mocked<IIdGenerator> {
  let counter = 0;
  return { generate: jest.fn(() => `element-${++counter}`) };
}

describe('XmlElementParser', () => {
  function parseSample() {
    const parser = new XmlElementParser(createSequentialIdGenerator(), createMockLogger());
    return parser.parse(SAMPLE_XML, 'screen-1');
  }

  it('parses every element in the hierarchy (excluding the <hierarchy> wrapper) and tags them with the given screenId', () => {
    const elements = parseSample();

    expect(elements).toHaveLength(4);
    expect(elements.every((e) => e.screenId === 'screen-1')).toBe(true);
  });

  it('builds parent/child relationships matching the XML tree structure', () => {
    const elements = parseSample();
    const frameLayout = elements.find((e) => e.className === 'android.widget.FrameLayout')!;
    const buttons = elements.filter((e) => e.className === 'android.widget.Button');
    const editText = elements.find((e) => e.className === 'android.widget.EditText')!;

    expect(frameLayout.parentElementId).toBeNull();
    expect(frameLayout.childElementIds).toHaveLength(3);
    expect(frameLayout.childElementIds.sort()).toEqual(
      [...buttons.map((b) => b.elementId), editText.elementId].sort(),
    );
    buttons.forEach((button) => expect(button.parentElementId).toBe(frameLayout.elementId));
    expect(editText.parentElementId).toBe(frameLayout.elementId);
    expect(editText.childElementIds).toEqual([]);
  });

  it('extracts text, resource-id, content-desc, and bounds correctly', () => {
    const elements = parseSample();
    const calculateButton = elements.find((e) => e.text === 'Calculate')!;

    expect(calculateButton.resourceId).toBe('com.example.app:id/btnCalculate');
    expect(calculateButton.contentDescription).toBe('');
    expect(calculateButton.bounds).toEqual({ left: 100, top: 200, right: 300, bottom: 260 });
  });

  it('extracts boolean state attributes correctly, including mixed true/false on one element', () => {
    const elements = parseSample();
    const editText = elements.find((e) => e.className === 'android.widget.EditText')!;

    expect(editText.checked).toBe(true);
    expect(editText.enabled).toBe(false);
    expect(editText.selected).toBe(true);
    expect(editText.clickable).toBe(true);
  });

  it('generates a resource-id locator (priority 1) and a text-based xpath locator (priority 3) when both are present', () => {
    const elements = parseSample();
    const calculateButton = elements.find((e) => e.text === 'Calculate')!;

    const strategies = calculateButton.locators.map((l) => l.strategy);
    expect(strategies).toContain(LocatorStrategy.RESOURCE_ID);
    expect(strategies).toContain(LocatorStrategy.XPATH_TEXT);
    expect(strategies).toContain(LocatorStrategy.XPATH_CLASS_INDEX);
    expect(strategies).not.toContain(LocatorStrategy.ACCESSIBILITY_ID);

    expect(calculateButton.locators[0].strategy).toBe(LocatorStrategy.RESOURCE_ID);
    expect(calculateButton.locators[0].value).toBe('com.example.app:id/btnCalculate');
    const priorities = calculateButton.locators.map((l) => l.priority);
    expect(priorities).toEqual([...priorities].sort((a, b) => a - b));
  });

  it('generates only an accessibility-id locator, the class-index fallback, and a coordinates fallback when only content-desc is present', () => {
    const elements = parseSample();
    const clearButton = elements.find((e) => e.contentDescription === 'Clear input')!;

    const strategies = clearButton.locators.map((l) => l.strategy);
    expect(strategies).toEqual([
      LocatorStrategy.ACCESSIBILITY_ID,
      LocatorStrategy.XPATH_CLASS_INDEX,
      LocatorStrategy.COORDINATES,
    ]);
    expect(clearButton.locators[0].value).toBe('Clear input');
  });

  it('generates the class-index xpath fallback plus a coordinates fallback when no other identifying attribute is present', () => {
    const elements = parseSample();
    const editText = elements.find((e) => e.className === 'android.widget.EditText')!;

    expect(editText.locators).toHaveLength(2);
    expect(editText.locators[0].strategy).toBe(LocatorStrategy.XPATH_CLASS_INDEX);
    expect(editText.locators[1].strategy).toBe(LocatorStrategy.COORDINATES);
    // bounds="[100,100][300,160]" -> center (200, 130)
    expect(editText.locators[1].value).toBe('200,130');
  });

  it('does not generate a coordinates locator when bounds are missing/unparseable (zero bounds)', () => {
    const parser = new XmlElementParser(createSequentialIdGenerator(), createMockLogger());
    const xml = `<?xml version='1.0' encoding='UTF-8' standalone='yes'?>
<hierarchy rotation="0">
  <android.widget.Button class="android.widget.Button" text="No bounds" resource-id="" content-desc="" checkable="false" checked="false" clickable="true" enabled="true" selected="false" />
</hierarchy>`;

    const [button] = parser.parse(xml, 'screen-1');

    const strategies = button.locators.map((l) => l.strategy);
    expect(strategies).not.toContain(LocatorStrategy.COORDINATES);
  });

  it('increments the class-index xpath per tag name, independent of sibling position among other tags', () => {
    const elements = parseSample();
    const calculateButton = elements.find((e) => e.text === 'Calculate')!;
    const clearButton = elements.find((e) => e.contentDescription === 'Clear input')!;
    const editText = elements.find((e) => e.className === 'android.widget.EditText')!;

    const xpathOf = (element: (typeof elements)[number]) =>
      element.locators.find((l) => l.strategy === LocatorStrategy.XPATH_CLASS_INDEX)!.value;

    expect(xpathOf(calculateButton)).toBe(
      '/android.widget.FrameLayout[1]/android.widget.Button[1]',
    );
    expect(xpathOf(clearButton)).toBe('/android.widget.FrameLayout[1]/android.widget.Button[2]');
    expect(xpathOf(editText)).toBe('/android.widget.FrameLayout[1]/android.widget.EditText[1]');
  });

  it('escapes double quotes in text-based xpath locators by falling back to single quotes', () => {
    const xml = `<hierarchy>
      <android.widget.TextView class="android.widget.TextView" text='Say "hi"' resource-id="" content-desc="" clickable="false" enabled="true" checked="false" selected="false" bounds="[0,0][10,10]" />
    </hierarchy>`;
    const parser = new XmlElementParser(createSequentialIdGenerator(), createMockLogger());

    const [element] = parser.parse(xml, 'screen-1');

    const xpathLocator = element.locators.find((l) => l.strategy === LocatorStrategy.XPATH_TEXT)!;
    expect(xpathLocator.value).toBe(`//android.widget.TextView[@text='Say "hi"']`);
  });

  it('defaults to zero bounds and logs a warning when the bounds attribute is malformed', () => {
    const xml = `<hierarchy>
      <android.widget.View class="android.widget.View" text="" resource-id="" content-desc="" clickable="false" enabled="true" checked="false" selected="false" bounds="not-a-bounds-string" />
    </hierarchy>`;
    const logger = createMockLogger();
    const parser = new XmlElementParser(createSequentialIdGenerator(), logger);

    const [element] = parser.parse(xml, 'screen-1');

    expect(element.bounds).toEqual({ left: 0, top: 0, right: 0, bottom: 0 });
    expect(logger.warn).toHaveBeenCalled();
  });

  it('throws XmlParsingError for malformed XML', () => {
    const parser = new XmlElementParser(createSequentialIdGenerator(), createMockLogger());

    expect(() => parser.parse('this is not valid xml <<< >>>', 'screen-1')).toThrow(
      XmlParsingError,
    );
  });

  it('throws XmlParsingError when the XML has no root element', () => {
    const parser = new XmlElementParser(createSequentialIdGenerator(), createMockLogger());

    expect(() => parser.parse('', 'screen-1')).toThrow(XmlParsingError);
  });
});
