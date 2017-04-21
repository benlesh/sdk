import {TreeBase} from './base';
import {FileDoesNotExistException} from './virtual';
import {Action} from '../action';
import {BaseException} from '../exception';


export class CannotCreateFileException extends BaseException {
  constructor(path: string) { super(`Cannot create file "${path}".`); }
}


export class NullTree extends TreeBase {
  // Simple readonly file system operations.
  exists(_path: string) { return false; }
  read(_path: string) { return null; }
  find(_glob?: string) { return []; }

  // Change content of host files.
  insertContentLeft(path: string, _index: number, _content: Buffer | string) {
    throw new FileDoesNotExistException(path);
  }
  insertContentRight(path: string, _index: number, _content: Buffer | string) {
    throw new FileDoesNotExistException(path);
  }
  removeContent(path: string, _index: number, _length: number) {
    throw new FileDoesNotExistException(path);
  }

  // Change structure of the host.
  copy(path: string, _to: string) {
    throw new FileDoesNotExistException(path);
  }
  delete(path: string) {
    throw new FileDoesNotExistException(path);
  }
  create(path: string, _content: Buffer | string) {
    throw new CannotCreateFileException(path);
  }
  rename(path: string, _to: string) {
    throw new FileDoesNotExistException(path);
  }
  overwrite(path: string, _content: Buffer | string) {
    throw new FileDoesNotExistException(path);
  }

  // Returns an ordered list of Action to get this host.
  get actions(): Action[] {
    return [];
  }
}
