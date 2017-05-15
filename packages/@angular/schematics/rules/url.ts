import {Source, SchematicContext} from '../src';
import {BaseException} from '../src/exception';
import {Tree} from '../src/interface';

import {parse} from 'url';
import {Observable} from 'rxjs/Observable';
import {FileSystemTree} from '../src/tree/filesystem';
import {EmptyTree} from '../src/tree/empty';


export function url(urlString: string): Source {
  const url = parse(urlString);

  return (context: SchematicContext) => {
    return context.engine.createSourceFromUrl(url);
  };
}
