import { spawn } from 'child_process';

export function run(cmd, args = []) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    let out = '', err = '';
    p.stdout.on('data', d => out += d.toString());
    p.stderr.on('data', d => err += d.toString());
    p.on('close', code => code === 0 ? resolve(out.trim()) : reject(new Error(err || `exit ${code}`)));
  });
}