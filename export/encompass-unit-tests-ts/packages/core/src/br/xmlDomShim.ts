import { DOMParser as XmldomParser } from '@xmldom/xmldom';

/** Polyfill DOMParser for Node before loading brRuleParser.js */
export function installDomParserShim(): void {
  if (typeof globalThis.DOMParser === 'undefined') {
    (globalThis as Record<string, unknown>).DOMParser = XmldomParser;
  }
}
