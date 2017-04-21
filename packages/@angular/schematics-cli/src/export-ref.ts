import {dirname, resolve} from 'path';
import {existsSync, statSync} from 'fs';


export class ExportStringRef<T> {
  private _ref: T;
  private _module: string;
  private _path: string;

  constructor(ref: string, parentPath: string = process.cwd(), inner = true) {
    const [path, name] = ref.split('#', 2);
    this._module = path[0] == '.' ? resolve(parentPath, path) : path;
    this._ref = require(this._module);
    if (inner) {
      this._ref = (this._ref as any)[name || 'default'];
    }
  }

  get ref() { return this._ref; }
  get module() { return this._module; }
  get path() {
    if (!this._path) {
      if (existsSync(this._module) && statSync(this._module).isFile()) {
        this._path = dirname(this._module);
      } else {
        this._path = this._module;
      }
    }
    return this._path;
  }
}

