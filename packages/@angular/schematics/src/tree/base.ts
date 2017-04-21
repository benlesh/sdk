import {Action} from '../action';
import {Tree} from '../interface';


export abstract class TreeBase extends Tree {
  // Readonly.
  abstract find(glob?: string): string[];
  abstract exists(path: string): boolean;

  // Content access.
  abstract read(path: string): Buffer | null;

  abstract overwrite(path: string, content: Buffer | string): void;

  // Change content of host files.
  abstract insertContentLeft(path: string, index: number, content: Buffer | string): void;
  abstract insertContentRight(path: string, index: number, content: Buffer | string): void;
  abstract removeContent(path: string, index: number, length: number): void;

  // Structural methods.
  abstract copy(from: string, to: string): void;
  abstract create(path: string, content: Buffer | string): void;
  abstract delete(path: string): void;
  abstract rename(from: string, to: string): void;

  // Returns an ordered list of Action to get this host.
  abstract readonly actions: Action[];
}
