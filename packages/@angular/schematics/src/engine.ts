import {
  CollectionDescription,
  Schematic,
  ResolvedSchematicDescription,
} from './interface';
import {Collection} from './collection';
import {SchematicImpl} from './schematic';


export interface SchematicEngineOptions {
  loadCollection(name: string): CollectionDescription | null;
  loadSchematic<T>(name: string,
                   collection: Collection,
                   options: T): ResolvedSchematicDescription | null;
}


export class SchematicEngine {
  constructor(private _options: SchematicEngineOptions) {}


  createCollection(name: string): Collection | null {
    const description = this._options.loadCollection(name);
    if (!description) {
      return null;
    }

    return new Collection(description, this);
  }

  createSchematic<T>(name: string, collection: Collection, options: T): Schematic | null {
    const description = this._options.loadSchematic<T>(name, collection, options);
    if (!description) {
      return null;
    }

    return new SchematicImpl(description, collection);
  }
}
