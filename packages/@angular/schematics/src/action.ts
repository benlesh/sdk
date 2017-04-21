import {BaseException} from './exception';


export class UnknownActionException extends BaseException {
  constructor(action: Action) {
    super(`Unknown action: "${action.kind}".`);
  }
}

export type Action = FileExistsAction
                   | OverwriteFileAction
                   | CreateFileAction
                   | RenameFileAction
                   | DeleteFileAction
                   | ContentAction;

export type ContentAction = InsertContentLeftAction
                          | InsertContentRightAction
                          | RemoveContentAction;


// Indicates that a file already exists. If the file does not exists on the target file system
// this is an error.
export interface FileExistsAction {
  kind: 'f';
  path: string;
  content: Buffer;
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

// Insert content into a file. If the file does not exist, this is an error. If the index is
// outside the range [0, size], this is an error.
// This inserts to the left of the index.
// Sort key is used when multiple content is inserted and/or deleted at the same index.
export interface InsertContentLeftAction {
  kind: 'il';
  path: string;
  index: number;
  content: Buffer;
}

// Insert content into a file. If the file does not exist, this is an error. If the index is
// outside the range [0, size], this is an error.
// This inserts to the right of the index.
// Sort key is used when multiple content is inserted and/or deleted at the same index.
export interface InsertContentRightAction {
  kind: 'ir';
  path: string;
  index: number;
  content: Buffer;
}

// Delete content from a file. If the file does not exist, this is an error. If the index is
// outside the range [0, size - length], this is an error.
// Sort key is used when multiple content is inserted and/or deleted at the same index.
export interface RemoveContentAction {
  kind: 'x';
  path: string;
  index: number;
  length: number;
}


export function isContentAction(action: Action): action is ContentAction {
  return action.kind == 'o'
      || action.kind == 'x'
      || action.kind == 'il'
      || action.kind == 'ir';
}
