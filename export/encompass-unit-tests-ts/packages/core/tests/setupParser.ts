import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import { installLearnHintsStorage } from '../src/parser/learnHints.js';

installLearnHintsStorage();

const require = createRequire(import.meta.url);
const parserPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src/parser/customFieldCalcParser.js'
);
require(parserPath);
