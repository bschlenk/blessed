/**
 * node.js - base abstract node for blessed
 * Copyright (c) 2013-2015, Christopher Jeffrey and contributors (MIT License).
 * https://github.com/chjj/blessed
 */

import { EventEmitter } from '../events';
import { removeIfExists } from '../helpers';
import Screen from './screen';

export interface NodeOptions {
  screen?: Screen;
  parent?: Node;
  children?: Node[];
}

export type NodeVisitor = (el: Node) => void;

let nextUid = 0;

export default class Node extends EventEmitter {
  public type = 'node';

  private options: NodeOptions = {};
  private screen: Node;
  private children: Node[];
  private detached: boolean;
  private parent: Node;
  private uid: number;
  private index: number;
  /** The focused element? Null if no focused element? */
  private focused: Node;
  private destroyed: boolean;

  private data: { [key: string]: any } = {};
  // TODO: should these be deprecated:
  private $ = this.data;
  private _ = this.data;

  constructor(options: NodeOptions = {}) {
    super();

    this.options = options;
    this.screen = options.screen;

    if (!this.screen) {
      // I don't think node should care about this
      if (this.type === 'screen') {
        this.screen = this;
      } else if (Screen.total === 1) {
        this.screen = Screen.global;
      } else if (options.parent) {
        this.screen = options.parent;
        while (this.screen && this.screen.type !== 'screen') {
          this.screen = this.screen.parent;
        }
      } else if (Screen.total) {
        // This _should_ work in most cases as long as the element is appended
        // synchronously after the screen's creation. Throw error if not.
        this.screen = Screen.instances[Screen.instances.length - 1];
        process.nextTick(() => {
          if (!this.parent) {
            throw new Error('Element (' + this.type + ')'
              + ' was not appended synchronously after the'
              + ' screen\'s creation. Please set a `parent`'
              + ' or `screen` option in the element\'s constructor'
              + ' if you are going to use multiple screens and'
              + ' append the element later.');
          }
        });
      } else {
        throw new Error('No active screen.');
      }
    }

    this.parent = options.parent || null;
    this.children = [];
    this.$ = this._ = this.data = {};
    this.uid = nextUid++;
    this.index = this.index != null ? this.index : -1;

    // event emitter shouldn't know about screens
    if (this.type !== 'screen') {
      this.detached = true;
    }

    if (this.parent) {
      this.parent.append(this);
    }

    (options.children || []).forEach(this.append.bind(this));
  }

  public insert(element: Node, i?: number) {
    if (element.screen && element.screen !== this.screen) {
      throw new Error('Cannot switch a node\'s screen.');
    }

    element.detach();
    element.parent = this;
    element.screen = this.screen;

    if (i === 0) {
      this.children.unshift(element);
    } else if (i === this.children.length) {
      this.children.push(element);
    } else {
      this.children.splice(i, 0, element);
    }

    element.emit('reparent', this);
    this.emit('adopt', element);

    const emit = (el: Node) => {
      const n = el.detached !== this.detached;
      el.detached = this.detached;
      if (n) {
        el.emit('attach');
      }
      el.children.forEach(emit);
    };

    emit(element);

    if (!this.screen.focused) {
      this.screen.focused = element;
    }
  }

  public prepend(element: Node) {
    this.insert(element, 0);
  }

  public append(element: Node) {
    this.insert(element, this.children.length);
  }

  public insertBefore(element: Node, other: Node) {
    const i = this.children.indexOf(other);
    if (i !== -1) {
      this.insert(element, i);
    }
  }

  public insertAfter(element: Node, other: Node) {
    const i = this.children.indexOf(other);
    if (i !== -1) {
      this.insert(element, i + 1);
    }
  }

  public remove(element: Node) {
    // can't remove an element if it isn't a child of this
    if (element.parent !== this) {
      return;
    }

    const i = this.children.indexOf(element);
    if (i === -1) {
      return;
    }

    element.clearPos();

    element.parent = null;

    this.children.splice(i, 1);

    removeIfExists(this.screen.clickable, element);
    removeIfExists(this.screen.keyable, element);

    element.emit('reparent', null);
    this.emit('remove', element);

    // TODO: this is in a few places
    const emit = (el: Node) => {
      const n = el.detached !== true;
      el.detached = true;
      if (n) {
        el.emit('detach');
      }
      el.children.forEach(emit);
    };

    emit(element);

    if (this.screen.focused === element) {
      this.screen.rewindFocus();
    }
  }

  public detach() {
    if (this.parent) {
      this.parent.remove(this);
    }
  }

  // To be overridden by subclasses
  public free() {
    return;
  }

  public destroy() {
    this.detach();
    this.forDescendants(
      (el: Node) => {
        el.free();
        el.destroyed = true;
        el.emit('destroy');
      },
      true);
  }

  public forDescendants(iter: NodeVisitor, includeThis?: boolean) {
    if (includeThis) {
      iter(this);
    }
    this.children.forEach(function emit(el) {
      iter(el);
      el.children.forEach(emit);
    });
  }

  public forAncestors(iter: NodeVisitor, includeThis: boolean) {
    if (includeThis) {
      iter(this);
    }
    let el: Node = this;
    while (el = el.parent) {
      iter(el);
    }
  }

  public collectDescendants(includeThis: boolean): Node[] {
    const out: Node[] = [];
    this.forDescendants(
      (el) => { out.push(el); },
      includeThis,
    );
    return out;
  }

  public collectAncestors(includeThis: boolean): Node[] {
    const out: Node[] = [];
    this.forAncestors(
      (el) => { out.push(el); },
      includeThis,
    );
    return out;
  }

  public emitDescendants(...args: any[]) {
    let iter: NodeVisitor;

    if (typeof args[args.length - 1] === 'function') {
      iter = args.pop();
    }

    this.forDescendants(
      (el) => {
        if (iter) {
          iter(el);
        }
        el.emit.apply(el, args);
      },
      true,
    );
  }

  public emitAncestors(...args: any[]) {
    let iter: NodeVisitor;

    if (typeof args[args.length - 1] === 'function') {
      iter = args.pop();
    }

    this.forAncestors(
      (el) => {
        if (iter) {
          iter(el);
        }
        el.emit.apply(el, args);
      },
      true,
    );
  }

  public hasDescendant(target: Node): boolean {
    const find = (el: Node): boolean => {
      for (const child of el.children) {
        if (child === target) {
          return true;
        }
        if (find(child) === true) {
          return true;
        }
      }
      return false;
    };

    return find(this);
  }

  public hasAncestor(target: Node): boolean {
    let el: Node = this;
    while (el = el.parent) {
      if (el === target) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get data stored on this node.
   * @param name The name of the data to retrieve.
   * @param defaultValue The default value if the data doesn't exist.
   * @return The data stored on this node.
   */
  public get(name: string, defaultValue: any): any {
    if (this.data.hasOwnProperty(name)) {
      return this.data[name];
    }
    return defaultValue;
  }

  /**
   * Store data on this node.
   * @param name The name of the data to store.
   * @param value The value of the data to store.
   */
  public set(name: string, value: any) {
    this.data[name] = value;
  }
}
