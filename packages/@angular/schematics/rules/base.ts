import {Rule, Source, SchematicContext, Tree, MergeStrategy} from '../src/interface';
import {Observable} from 'rxjs/Observable';
import {BaseException} from '../src/exception';


export class InvalidRuleResultException extends BaseException {
  constructor(value: any) {
    let v: string = 'Unknown Type';
    if (value === undefined) {
      v = 'undefined';
    } else if (value === null) {
      v = 'null';
    } else if (typeof value == 'function') {
      v = `Function()`;
    } else if (typeof value != 'object') {
      v = `${typeof value}(${JSON.stringify(value)})`;
    } else {
      if (Object.getPrototypeOf(value) == Object) {
        v = `Object(${JSON.stringify(value)})`;
      } else if (value.constructor) {
        v = `Instance of class ${value.constructor.name}`;
      } else {
        v = 'Unknown Object';
      }
    }
    super(`Invalid rule or source result: ${v}.`);
  }
}


export function source(tree: Tree): Source {
  return () => tree;
}
export function empty(): Source {
  return () => Tree.empty();
}


export function callSource(source: Source, context: SchematicContext): Observable<Tree> {
  const result = source(context);

  if (result instanceof Tree) {
    return Observable.of(result);
  } else if (result instanceof Observable) {
    return result;
  } else {
    throw new InvalidRuleResultException(result);
  }
}
export function callRule(rule: Rule,
                         input: Observable<Tree>,
                         context: SchematicContext): Observable<Tree> {
  return input.first().mergeMap(i => {
    const result = rule(i, context);

    if (result instanceof Tree) {
      return Observable.of(result);
    } else if (result instanceof Observable) {
      return result;
    } else {
      throw new InvalidRuleResultException(result);
    }
  });
}


export function chain(rules: Rule[]): Rule {
  return (tree: Tree, context: SchematicContext) => {
    return rules.reduce((acc: Observable<Tree>, curr: Rule) => {
      return callRule(curr, acc, context);
    }, Observable.of(tree));
  };
}


export function apply(source: Source, rules: Rule[]): Source {
  return (context: SchematicContext) => {
    return callRule(chain(rules), callSource(source, context), context);
  };
}


export function merge(sources: Source[], strategy: MergeStrategy = MergeStrategy.Default): Source {
  return (context: SchematicContext) => {
    return sources.reduce((acc: Observable<Tree>, curr: Source) => {
      const result = callSource(curr, context);
      return acc.mergeMap(x => {
        return result.map(y => Tree.merge(x, y, strategy || context.strategy));
      });
    }, Observable.of(Tree.empty()));
  };
}


export function mergeWith(sources: Source[], strategy: MergeStrategy = MergeStrategy.Default): Rule {
  return (tree: Tree, context: SchematicContext) => {
    return sources.reduce((acc: Observable<Tree>, curr: Source) => {
      const result = callSource(curr, context);
      return acc.mergeMap(x => {
        return result.map(y => Tree.merge(x, y, strategy || context.strategy));
      });
    }, Observable.of(tree));
  };
}


export function noop(): Rule {
  return (tree: Tree, _context: SchematicContext) => tree;
}


export function partitionAndApply(glob: string, options: { left?: Rule[], right?: Rule[] }): Rule {
  return (tree: Tree, context: SchematicContext) => {
    const [left, right] = Tree.partition(tree, glob);
    const leftRule = callRule(chain(options.left || []), Observable.of(left), context);
    const rightRule = callRule(chain(options.right || []), Observable.of(right), context);

    return leftRule.mergeMap(l => rightRule.map(r => Tree.merge(l, r)));
  };
}

export function filter(glob?: string): Rule {
  return (tree: Tree) => {
    return Tree.branch(tree, glob);
  };
}
