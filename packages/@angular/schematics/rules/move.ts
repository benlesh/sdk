import {Rule, Tree} from '../src/interface';


export function move(root: string): Rule {
  return (tree: Tree) => {
    tree.find().forEach(originalPath => {
      tree.rename(originalPath, `${root}/${originalPath}`);
    });
    return tree;
  };
}
