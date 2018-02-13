/**
 * events.js - event emitter for blessed
 * Copyright (c) 2013-2015, Christopher Jeffrey and contributors (MIT License).
 * https://github.com/chjj/blessed
 */

const slice = Array.prototype.slice;

export type Listener = (...args: any[]) => any;

export class EventEmitter {
  private _events: {[type: string]: Listener[]} = {};

  addListener(type: string, listener: Listener): void {
    if (!this._events[type]) {
      this._events[type] = [listener];
    } else {
      this._events[type].push(listener);
    }
    this._emit('newListener', [type, listener]);
  }

  on = this.addListener;

  removeListener(type: string, listener: Listener) {
    var handler = this._events[type];
    if (!handler) return;

    if (typeof handler === 'function' || handler.length === 1) {
      delete this._events[type];
      this._emit('removeListener', [type, listener]);
      return;
    }

    for (var i = 0; i < handler.length; i++) {
      if (handler[i] === listener || handler[i].listener === listener) {
        handler.splice(i, 1);
        this._emit('removeListener', [type, listener]);
        return;
      }
    }
  }

  off(type: string, listener: Listener): void {
    this.removeListener(type, listener);
  }

  removeAllListeners(type?: string): void {
    if (type) {
      this._events[type] = undefined;
    } else {
      this._events = {};
    }
  }

  once(type: string, listener: Listener): void {
    function on() {
      this.removeListener(type, on);
      return listener.apply(this, arguments);
    }
    on.listener = listener;
    this.on(type, on);
  }

  listeners(type: string): Listener[] {
    const listeners = this._events[type];
    if (listeners) {
      return listeners;
    }
    return [];
  }

  _emit(type: string, args: any[]): boolean {
    const handlers = this._events[type];
    let ret = true;

    if (!handlers) {
      if (type === 'error') {
        throw new args[0];
      }
      return;
    }

    for (let handler of handlers) {
      if (handler.apply(this, args) === false) {
        ret = false;
      }
    }

    return ret;
  }

  emit(type: string, ...args: any[]) {
    let el = this;

    this._emit('event', args);

    if (this.type === 'screen') {
      return this._emit(type, args);
    }

    if (this._emit(type, args) === false) {
      return false;
    }

    type = `element ${type}`;
    args.unshift(this);

    do {
      if (!el._events[type]) {
        continue;
      }
      if (el._emit(type, args) === false) {
        return false;
      }
    } while (el = el.parent);

    return true;
  }
}

// For hooking into the main EventEmitter if we want to.
// Might be better to do things this way being that it
// will always be compatible with node, not to mention
// it gives us domain support as well.
// Node.prototype._emit = Node.prototype.emit;
// Node.prototype.emit = function(type) {
//   var args, el;
//
//   if (this.type === 'screen') {
//     return this._emit.apply(this, arguments);
//   }
//
//   this._emit.apply(this, arguments);
//   if (this._bubbleStopped) return false;
//
//   args = slice.call(arguments, 1);
//   el = this;
//
//   args.unshift('element ' + type, this);
//   this._bubbleStopped = false;
//   //args.push(stopBubble);
//
//   do {
//     if (!el._events || !el._events[type]) continue;
//     el._emit.apply(el, args);
//     if (this._bubbleStopped) return false;
//   } while (el = el.parent);
//
//   return true;
// };
//
// Node.prototype._addListener = Node.prototype.addListener;
// Node.prototype.on =
// Node.prototype.addListener = function(type, listener) {
//   function on() {
//     if (listener.apply(this, arguments) === false) {
//       this._bubbleStopped = true;
//     }
//   }
//   on.listener = listener;
//   return this._addListener(type, on);
// };

export default EventEmitter;
