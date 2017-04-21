import * as stringUtils from '@angular/schematics/rules/utils/strings';
import { apply, mergeWith, move, template, url, MergeStrategy, Rule } from '@angular/schematics';


export default function(options: any): Rule {
  return mergeWith([
    apply(url('./files'), [
      template({ utils: stringUtils, ...options }),
      move(options.sourceDir),
    ])
  ], MergeStrategy.Overwrite);
};
