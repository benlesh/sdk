import {Action} from '../action';
import {Tree} from '../interface';


export abstract class TreeBase extends Tree {
  // Returns an ordered list of Action to get this host.
  abstract readonly actions: Action[];
}
