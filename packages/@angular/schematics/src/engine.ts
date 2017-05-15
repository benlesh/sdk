import {
  CollectionDescription,
  ResolvedSchematicDescription,
  Schematic,
  SchematicContext,
  Source,
  Tree,
} from './interface';
import {Collection} from './collection';
import {SchematicImpl} from './schematic';
import {BaseException} from './exception';

import {Url} from 'url';


export class InvalidSourceUrlException extends BaseException {
  constructor(url: string) { super(`Invalid source url: "${url}".`); }
}
export class UnknownUrlSourceProtocol extends BaseException {
  constructor(url: string) { super(`Unknown Protocol on url "${url}".`); }
}


export interface SchematicEngineOptions {
  loadCollection(name: string): CollectionDescription | null;
  loadSchematic<T>(name: string,
                   collection: Collection,
                   options: T): ResolvedSchematicDescription | null;
}


export interface ProtocolHandler {
  (url: Url): Source;
}


export class SchematicEngine {
  private _protocolMap = new Map<string, ProtocolHandler>();

  constructor(private _options: SchematicEngineOptions) {
    // Default implementations.
    this.registerUrlProtocolHandler('host', (url: Url) => {
      return (context: SchematicContext) => {
        return context.host.map(tree => Tree.branch(tree, (url.path || '') + '/**'));
      };
    });
    this._protocolMap.set('null', () => {
      return () => Tree.empty();
    });
    this._protocolMap.set('', {
      createSourceFromUrl(url: Url): Source {
        const fileUrl = new Url(url.toString());
        fileUrl.protocol = 'file:';
        return (context: SchematicContext) => context.engine.createSourceFromUrl(fileUrl)(context);
      }
    });
  }

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

  registerUrlProtocolHandler(protocol: string, handler: ProtocolHandler) {
    this._protocolMap.set(protocol, handler);
  }

  createSourceFromUrl(url: Url): Source {
    const protocol = (url.protocol || '').replace(/:$/, '');
    const handler = this._protocolMap.get(protocol);
    if (!handler) {
      throw new UnknownUrlSourceProtocol(url.toString());
    }
    return handler(url);
  }
}
