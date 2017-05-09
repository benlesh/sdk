import {Tree, ResolvedSchematicDescription} from './interface';
import {SchematicImpl} from './schematic';

import 'rxjs/add/operator/toArray';
import 'rxjs/add/operator/toPromise';
import {Observable} from 'rxjs/Observable';



describe('Schematic', () => {
  it('works with a rule', done => {
    let inner: any = null;
    const desc: ResolvedSchematicDescription = {
      name: 'test',
      description: '',
      factory: '',
      path: 'a/b/c',
      rule: (tree: Tree) => {
        inner = Tree.branch(tree);
        tree.create('a/b/c', 'some content');
        return tree;
      }
    };

    const schematic = new SchematicImpl(desc, null !);

    schematic.call(Observable.of(Tree.empty()), {})
      .toPromise()
      .then(x => {
        expect(inner.find()).toEqual([]);
        expect(x.find()).toEqual(['/a/b/c']);
      })
      .then(done, done.fail);
  });

  it('works with a rule that returns an observable', done => {
    let inner: any = null;
    const desc: ResolvedSchematicDescription = {
      name: 'test',
      description: '',
      factory: '',
      path: 'a/b/c',
      rule: (fem: Tree) => {
        inner = fem;
        return Observable.of(Tree.empty());
      }
    };


    const schematic = new SchematicImpl(desc, null !);
    schematic.call(Observable.of(Tree.empty()), {})
      .toPromise()
      .then(x => {
        expect(inner.find()).toEqual([]);
        expect(x.find()).toEqual([]);
        expect(inner).not.toBe(x);
      })
      .then(done, done.fail);
  });

});
