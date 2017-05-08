import {TreeBase} from './base';
import {FileDoesNotExistException, UpdateRecorderBase} from './virtual';
import {Action} from '../action';
import {BaseException} from '../exception';
import {UpdateRecorder} from '../interface';


export class CannotCreateFileException extends BaseException {
  constructor(path: string) { super(`Cannot create file "${path}".`); }
}


export class NullTree extends TreeBase {
  // Simple readonly file system operations.
  exists(_path: string) { return false; }
  read(_path: string) { return null; }
  find(_glob?: string) { return []; }

  // Change content of host files.
  beginUpdate(path: string): never {
    throw new FileDoesNotExistException(path);
  }
  commitUpdate(record: UpdateRecorder): never {
    throw new FileDoesNotExistException(record instanceof UpdateRecorderBase
      ? record.path
      : '<unknown>');
  }

  // Change structure of the host.
  copy(path: string, _to: string): never {
    throw new FileDoesNotExistException(path);
  }
  delete(path: string): never {
    throw new FileDoesNotExistException(path);
  }
  create(path: string, _content: Buffer | string): never {
    throw new CannotCreateFileException(path);
  }
  rename(path: string, _to: string): never {
    throw new FileDoesNotExistException(path);
  }
  overwrite(path: string, _content: Buffer | string): never {
    throw new FileDoesNotExistException(path);
  }

  // Returns an ordered list of Action to get this host.
  get actions(): Action[] {
    return [];
  }
}
