/**
 * Stream a zip of export/encompass-unit-tests-ts for work-machine download.
 * Excludes node_modules, dist, and logs (same as export .gitignore).
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const EXPORT_PARENT = path.join(ROOT, 'export');
const EXPORT_FOLDER = path.join(EXPORT_PARENT, 'encompass-unit-tests-ts');

export const TS_EXPORT_ZIP_NAME = 'encompass-unit-tests-ts.zip';

export function exportFolderExists() {
  return fs.existsSync(EXPORT_FOLDER);
}

/**
 * Pipe a zip tarball of the export folder to an Express response stream.
 * @param {import('express').Response} res
 */
export function streamTsExportZip(res) {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      'tar',
      [
        '-a',
        '-c',
        '-f',
        '-',
        '--exclude=node_modules',
        '--exclude=dist',
        '--exclude=*.log',
        'encompass-unit-tests-ts',
      ],
      {
        cwd: EXPORT_PARENT,
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    proc.stdout.pipe(res);
    proc.stderr.on('data', (chunk) => {
      console.error('ts-export zip:', chunk.toString().trim());
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`tar exited with code ${code}`));
    });
  });
}
