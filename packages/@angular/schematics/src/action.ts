import {BaseException} from './exception';


export class UnknownActionException extends BaseException {
  constructor(action: Action) {
    super(`Unknown action: "${action.kind}".`);
  }
}


export type Action = FileExistsMarker
                   | OverwriteFileAction
                   | CreateFileAction
                   | RenameFileAction
                   | DeleteFileAction;


/**
 * This is an array of actions that is also optimizing as it goes. For example, if you rename a
 * file and then rename it again, it will only result in one action. If you create a file and you
 * overwrite its content the file will be created with the new content.
 */
export class ActionArray {
  private _actions: Action[] = [];

  toArray() { return [...this._actions]; }

  exists(path: string) {
    this._actions.push({ kind: 'f', path });
  }
  overwrite(path: string, content: Buffer) {
    this._actions.push({ kind: 'o', path, content });
  }
  create(path: string, content: Buffer) {
    this._actions.push({ kind: 'c', path, content });
  }
  rename(path: string, to: string) {
    this._actions.push({ kind: 'r', path, to });
  }
  delete(path: string) {
    this._actions.push({ kind: 'd', path });
  }

  clone() {
    const newArray = new ActionArray();
    newArray._actions = this.toArray();
    return newArray;
  }
}



// Mark a file that exists already. This is to assert the system before actions are applied to it.
export interface FileExistsMarker {
  kind: 'f';
  path: string;
}


// Overwrite a file. If the file does not already exist, this is an error.
export interface OverwriteFileAction {
  kind: 'o';
  path: string;
  content: Buffer;
}

// Create a file. If the file already exists then this is an error.
export interface CreateFileAction {
  kind: 'c';
  path: string;
  content: Buffer;
}

// Move a file from one path to another. If the source files does not exist, this is an error.
// If the target path already exists, this is an error.
export interface RenameFileAction {
  kind: 'r';
  path: string;
  to: string;
}

// Delete a file. If the file does not exist, this is an error.
export interface DeleteFileAction {
  kind: 'd';
  path: string;
}
