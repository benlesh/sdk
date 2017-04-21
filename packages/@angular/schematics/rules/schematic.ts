import {Rule, SchematicContext, Tree} from '../src/interface';

import {Observable} from 'rxjs/Observable';


export type SchematicOptions = {
  name: string;
  options: any;
};


export function schematic(options: SchematicOptions): Rule {
  return (host: Tree, context: SchematicContext) => {
    const schematic = context.schematic.collection.createSchematic(options.name, options.options);
    return schematic.call(Observable.of(Tree.branch(host)));
  };
}
