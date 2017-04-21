import {addDeclarationToModule} from './utility/ast-utils';
import {InsertChange} from './utility/change';

import {
  SchematicContext,
  SchematicDescription,
  Tree,
  Rule,
  apply,
  chain,
  filter,
  merge,
  mergeWith,
  move,
  noop,
  source,
  template,
  url,
} from '@angular/schematics';
import * as stringUtils from '@angular/schematics/rules/utils/strings';
import * as ts from 'typescript';

import 'rxjs/add/observable/fromPromise';
import 'rxjs/add/operator/merge';


function addDeclarationToNgModule(options: any): Rule {
  return (host: Tree) => {
    if (options['skip-import']) {
      return host;
    }

    let closestModule = options.sourceDir + '/' + options.path;
    while (closestModule && host.find(closestModule + '/*.module.ts').length == 0) {
      closestModule = closestModule.split('/').slice(0, -1).join('/');
    }

    const modulePath = host.find(closestModule + '/*.module.ts');
    if (modulePath.length == 0) {
      return host;
    }
    if (modulePath.length > 1) {
      throw new Error('More than one module matches. Use skip-import option to skip importing the '
                    + 'component into the closest module.');
    }

    const sourceText = host.read(modulePath[0]) !.toString('utf-8');
    const source = ts.createSourceFile(modulePath[0], sourceText, ts.ScriptTarget.Latest, true);

    const componentModule = options.path + '/'
                          + (options.flat ? stringUtils.dasherize(options.name) + '/' : '')
                          + stringUtils.dasherize(options.name)
                          + '.component';
    const changes = addDeclarationToModule(source, modulePath[0],
                                           stringUtils.classify(options.name),
                                           componentModule);
    const recorder = host.beginUpdate(modulePath[0]);
    for (const change of changes) {
      if (change instanceof InsertChange) {
        recorder.insertLeft(change.pos, change.toAdd);
      }
    }
    host.commitUpdate(recorder);

    return host;
  };
}


export default function(options: any): SchematicDescription<any> {
  const templateSource = apply(url('./files'), [
    options.spec ? noop() : filter('/**/!(*.spec.ts)'),
    template({
      ...stringUtils,
      'if-flat': (s: string) => options.flat ? '' : s,
      ...options
    }),
    move(options.sourceDir)
  ]);
  const moduleUpdateRule = apply(url('host://'), [
    filter('**/!(*-routing).module.ts'),
    addDeclarationToNgModule(options),
  ]);

  return mergeWith([templateSource, moduleUpdateRule]);
}
