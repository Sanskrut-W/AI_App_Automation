import { DOMParser, onErrorStopParsing } from '@xmldom/xmldom';
import type { Element as XmlNode, Document as XmlDocument } from '@xmldom/xmldom';
import { Element, ElementProps } from '../../core/entities/Element';
import { ElementBounds } from '../../core/value-objects/ElementBounds';
import { LocatorCandidate } from '../../core/value-objects/LocatorCandidate';
import { LocatorStrategy } from '../../core/enums/LocatorStrategy';
import { XmlParsingError } from '../../core/errors/XmlParsingError';
import { IXmlElementParser } from '../../application/interfaces/xml/IXmlElementParser';
import { IIdGenerator } from '../../shared/id/IIdGenerator';
import { ILogger } from '../../shared/logger/ILogger';

const ZERO_BOUNDS: ElementBounds = { left: 0, top: 0, right: 0, bottom: 0 };
const BOUNDS_PATTERN = /\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]/;

interface LocatorInput {
  tagName: string;
  xpath: string;
  resourceId: string;
  contentDescription: string;
  text: string;
  bounds: ElementBounds;
}

/** Parses an Android UiAutomator2 XML hierarchy dump into a flat list of Element records with generated locators. */
export class XmlElementParser implements IXmlElementParser {
  constructor(
    private readonly idGenerator: IIdGenerator,
    private readonly logger: ILogger,
  ) {}

  parse(xml: string, screenId: string): Element[] {
    const document = this.parseDocument(xml);

    const root = document.documentElement;
    if (!root) {
      throw new XmlParsingError('XML hierarchy has no root element.');
    }

    const elements: Element[] = [];
    // The <hierarchy> tag is Appium's wrapper, not a real UI element — walk its children as roots.
    const rootNodes = root.tagName === 'hierarchy' ? Array.from(root.children) : [root];
    this.walkSiblings(rootNodes, screenId, null, '', elements);

    return elements;
  }

  private parseDocument(xml: string): XmlDocument {
    try {
      const parser = new DOMParser({ onError: onErrorStopParsing });
      return parser.parseFromString(xml, 'text/xml');
    } catch (error) {
      throw new XmlParsingError(`Failed to parse XML hierarchy: ${this.describe(error)}`);
    }
  }

  private walkSiblings(
    siblings: XmlNode[],
    screenId: string,
    parentElementId: string | null,
    parentXPath: string,
    elements: Element[],
  ): string[] {
    const siblingIndexByTag = new Map<string, number>();
    const ids: string[] = [];

    for (const node of siblings) {
      const tagName = node.tagName;
      const siblingIndex = (siblingIndexByTag.get(tagName) ?? 0) + 1;
      siblingIndexByTag.set(tagName, siblingIndex);
      const xpath = `${parentXPath}/${tagName}[${siblingIndex}]`;

      const elementId = this.idGenerator.generate();
      const childElementIds = this.walkSiblings(
        Array.from(node.children),
        screenId,
        elementId,
        xpath,
        elements,
      );

      const text = node.getAttribute('text') ?? '';
      const resourceId = node.getAttribute('resource-id') ?? '';
      const contentDescription = node.getAttribute('content-desc') ?? '';
      const bounds = this.parseBounds(node.getAttribute('bounds'));

      const props: ElementProps = {
        elementId,
        screenId,
        className: node.getAttribute('class') ?? tagName,
        text,
        resourceId,
        accessibilityId: contentDescription,
        contentDescription,
        bounds,
        clickable: this.parseBoolean(node.getAttribute('clickable')),
        enabled: this.parseBoolean(node.getAttribute('enabled')),
        selected: this.parseBoolean(node.getAttribute('selected')),
        checked: this.parseBoolean(node.getAttribute('checked')),
        isPassword: this.parseBoolean(node.getAttribute('password')),
        parentElementId,
        childElementIds,
        locators: this.buildLocators({
          tagName,
          xpath,
          resourceId,
          contentDescription,
          text,
          bounds,
        }),
      };

      elements.push(new Element(props));
      ids.push(elementId);
    }

    return ids;
  }

  private parseBounds(raw: string | null): ElementBounds {
    if (!raw) {
      return ZERO_BOUNDS;
    }
    const match = BOUNDS_PATTERN.exec(raw);
    if (!match) {
      this.logger.warn('Unable to parse bounds attribute, defaulting to zero bounds', { raw });
      return ZERO_BOUNDS;
    }
    const [, left, top, right, bottom] = match;
    return { left: Number(left), top: Number(top), right: Number(right), bottom: Number(bottom) };
  }

  private parseBoolean(raw: string | null): boolean {
    return raw === 'true';
  }

  private buildLocators(input: LocatorInput): LocatorCandidate[] {
    const locators: LocatorCandidate[] = [];

    if (input.resourceId) {
      locators.push({
        strategy: LocatorStrategy.RESOURCE_ID,
        value: input.resourceId,
        priority: 1,
      });
    }
    if (input.contentDescription) {
      locators.push({
        strategy: LocatorStrategy.ACCESSIBILITY_ID,
        value: input.contentDescription,
        priority: 2,
      });
    }
    if (input.text) {
      locators.push({
        strategy: LocatorStrategy.XPATH_TEXT,
        value: `//${input.tagName}[@text=${this.escapeXPathLiteral(input.text)}]`,
        priority: 3,
      });
    }
    locators.push({ strategy: LocatorStrategy.XPATH_CLASS_INDEX, value: input.xpath, priority: 4 });

    if (this.hasRealBounds(input.bounds)) {
      const centerX = Math.round((input.bounds.left + input.bounds.right) / 2);
      const centerY = Math.round((input.bounds.top + input.bounds.bottom) / 2);
      locators.push({
        strategy: LocatorStrategy.COORDINATES,
        value: `${centerX},${centerY}`,
        priority: 5,
      });
    }

    return locators.sort((a, b) => a.priority - b.priority);
  }

  private hasRealBounds(bounds: ElementBounds): boolean {
    return bounds.left !== 0 || bounds.top !== 0 || bounds.right !== 0 || bounds.bottom !== 0;
  }

  /** Prefers double quotes; falls back to single quotes, then to concat() if the value has both. */
  private escapeXPathLiteral(value: string): string {
    if (!value.includes('"')) {
      return `"${value}"`;
    }
    if (!value.includes("'")) {
      return `'${value}'`;
    }
    const parts = value.split('"').map((part) => `"${part}"`);
    return `concat(${parts.join(`, '"', `)})`;
  }

  private describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
