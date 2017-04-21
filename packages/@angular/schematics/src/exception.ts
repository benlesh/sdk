
// Starting with TS 2.1, Error cannot be properly extended anymore, so we implement the same
// interface but in a different package.
export class BaseException extends Error {
  private _error: Error;

  constructor(message = '') {
    super(message);
    // this._error = new Error(message || this.constructor.name);
    // Object.setPrototypeOf(this, this._error);
  }

  get message() { return this._error.message; }
  get name() { return this.constructor.name; }
  get stack() { return this._error.stack; }
}
