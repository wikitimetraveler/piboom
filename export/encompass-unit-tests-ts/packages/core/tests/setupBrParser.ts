import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import { installDomParserShim } from '../src/br/xmlDomShim.js';

installDomParserShim();

const require = createRequire(import.meta.url);
const brPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src/br/brRuleParser.js'
);
require(brPath);
