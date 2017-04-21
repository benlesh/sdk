import {BaseException} from '../exception';


export class InvalidPathException extends BaseException {
  constructor(path: string) { super(`Path "${path}" is invalid.`); }
}


export function normalizePath(path: string) {
  let p = path;
  if (p[0] != '/') {
    p = '/' + p;
  }
  if (p.endsWith('..')) {
    throw new InvalidPathException(path);
  }

  let oldP: string | null = null;
  while (oldP !== p) {
    oldP = p;
    p = p
      .replace(/\/[^\/]+\/\.\.\//g, '/')
      .replace(/\/[^\/]+\/\.\.$/g, '/')
      .replace(/\/\.?$/g, '/')
      .replace(/\/\.?\//g, '/');
  }

  if (p.startsWith('/../') || (p.endsWith('/') && p !== '/')) {
    throw new InvalidPathException(path);
  }
  return p;
}
