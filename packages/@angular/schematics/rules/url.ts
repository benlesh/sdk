import {Source, SchematicContext} from '../src';
import {BaseException} from '../src/exception';
import {Tree} from '../src/interface';

import {parse} from 'url';
import {Observable} from 'rxjs/Observable';
import {FileSystemTree} from '../src/tree/filesystem';
import {EmptyTree} from '../src/tree/empty';


export class InvalidSourceUrlException extends BaseException {
  constructor(url: string) { super(`Invalid source url: "${url}".`); }
}


export function url(urlString: string): Source {
  const url = parse(urlString);

  return (context: SchematicContext) => {
    switch (url.protocol) {
      case null:
      case 'file:':
        if (url.path && url.path.startsWith('.')) {
          return Observable.of(new FileSystemTree(context.schematic.path + '/' + url.path));
        } else {
          return Observable.of(new FileSystemTree(url.path || context.schematic.path));
        }
      case 'host:':
        return context.host.map(tree => {
          return Tree.branch(tree, (url.path || '') + '/**', true);
        });
      case 'null:':
        return Observable.of(new EmptyTree());
    }

    throw new InvalidSourceUrlException(urlString);
  };
}
