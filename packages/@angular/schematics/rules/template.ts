import {Rule, Tree} from '../src/interface';
import {isBinary} from './utils/is-binary';
import {BaseException} from '../src/exception';

import {template as templateImpl} from 'lodash';
import {chain} from './base';


export class OptionIsNotDefinedException extends BaseException {
  constructor(name: string) { super(`Option "${name}" is not defined.`); }
}


export class UnknownPipeException extends BaseException {
  constructor(name: string) { super(`Pipe "${name}" is not defined.`); }
}


export class InvalidPipeException extends BaseException {
  constructor(name: string) { super(`Pipe "${name}" is invalid.`); }
}



export function lodashTemplate<T extends { [key: string]: any }>(options: T): Rule {
  return (tree: Tree) => {
    tree.find().forEach(originalPath => {
      // Lodash Template.
      const content = tree.read(originalPath);

      if (content && !isBinary(content)) {
        const t = templateImpl(content.toString('utf-8'));
        const output = t(options);
        tree.overwrite(originalPath, output);
      }
    });

    return tree;
  };
}

export function pathTemplate<T extends { [key: string]: any }>(options: T): Rule {
  return (tree: Tree) => {
    tree.find().forEach(originalPath => {
      // Path template.
      const newPath = originalPath.replace(/__([^_:]+)([^_]*)__/g, (_, match, pipes) => {
        if (!(match in options)) {
          throw new OptionIsNotDefinedException(match);
        }
        if (pipes) {
          return pipes.split(':').reduce((acc: string, pipe: string) => {
            if (!pipe) {
              return acc;
            }
            if (!(pipe in options)) {
              throw new UnknownPipeException(pipe);
            }
            if (typeof options[pipe] != 'function') {
              throw new InvalidPipeException(pipe);
            }
            return (options[pipe])(acc);
          }, '' + options[match]);
        }
        return '' + options[match];
      });

      if (originalPath === newPath) {
        return;
      }

      tree.rename(originalPath, newPath);
    });

    return tree;
  };
}



export function template<T extends { [key: string]: any }>(options: T): Rule {
  return chain([
    lodashTemplate(options),
    pathTemplate(options)
  ]);
}
