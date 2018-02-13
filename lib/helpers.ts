/**
 * helpers.js - helpers for blessed
 * Copyright (c) 2013-2015, Christopher Jeffrey and contributors (MIT License).
 * https://github.com/chjj/blessed
 */

import * as fs from 'fs';
import { join } from 'path';
import unicode from './unicode';
import Screen from './widgets/screen';
import Element from './widgets/element';

const nextTick = global.setImmediate || process.nextTick.bind(process);

export interface ASortable {
  name: string;
}

export interface HSortable {
  index: number;
}

/**
 * Sort a list of objects containing a name field
 * case insensitively, only by first letter. If the first
 * letter is a ".", use the second letter.
 * @param array The array to sort.
 * @return The input array, sorted.
 */
export function asort<T extends ASortable>(array: T[]): T[] {
  return array.sort((objA, objB) => {
    let a = objA.name.toLowerCase();
    let b = objB.name.toLowerCase();

    if (a[0] === '.' && b[0] === '.') {
      a = a[1];
      b = b[1];
    } else {
      a = a[0];
      b = b[0];
    }

    return a > b ? 1 : (a < b ? -1 : 0);
  });
}

/**
 * Sort an array of objects by their index field.
 * @param array The array to sort.
 * @return The input array, sorted.
 */
export function hsort<T extends HSortable>(array: T[]): T[] {
  return array.sort((a, b) => {
    return b.index - a.index;
  });
}

/**
 * Find the target file in the start directory by searching recursively.
 * @param start The path to start looking from.
 * @param target The basename of the file to find.
 * @return The path to the found file, or null.
 */
export function findFile(start: string, target: string): string | null {
  return (function read(dir: string): string | null {
    let file;
    let out;

    // guard agains special system directories
    if (dir === '/dev' || dir === '/sys'
        || dir === '/proc' || dir === '/net') {
      return null;
    }

    let files: string[];
    try {
      files = fs.readdirSync(dir);
    } catch (e) {
      files = [];
    }

    for (let fileBase of files) {
      const file = join(dir, fileBase);
      if (fileBase === target) {
        return join(dir, file);
      }

      let stat;
      try {
        stat = fs.lstatSync(file);
      } catch (e) {
        stat = null;
      }

      if (stat && stat.isDirectory() && !stat.isSymbolicLink()) {
        out = read(file);
        if (out) {
          return out;
        }
      }
    }

    return null;
  })(start);
}

/**
 * Escape text for tag-enabled elements.
 */
export function escape(text: string): string {
  return text.replace(/[{}]/g,
    (ch) => ch === '{' ? '{open}' : '{close}');
}

/**
 * Convert `{red-fg}foo{/red-fg}` to `\x1b[31mfoo\x1b[39m`.
 * Replaces all friendly named color tags with ansi escape codes.
 */
export function parseTags(text: string, screen: Screen): string {
  if (!/{\/?[\w\-,;!#]*}/.test(text)) {
    return text;
  }

  const { program } = screen;
  let out = '';
  let state: string[];
  let bg: string[] = [];
  let fg: string[] = [];
  let flag: string[] = [];
  let cap: RegExpExecArray;
  let slash: boolean;
  let param: string;
  let attr: string;
  let esc = false;

  while (true) {
    if (!esc && (cap = /^{escape}/.exec(text))) {
      text = text.substring(cap[0].length);
      esc = true;
      continue;
    }

    if (esc && (cap = /^([\s\S]+?){\/escape}/.exec(text))) {
      text = text.substring(cap[0].length);
      out += cap[1];
      esc = false;
      continue;
    }

    if (esc) {
      out += text;
      break;
    }

    if (cap = /^{(\/?)([\w\-,;!#]*)}/.exec(text)) {
      text = text.substring(cap[0].length);
      slash = cap[1] === '/';
      param = cap[2].replace(/-/g, ' ');

      if (param === 'open') {
        out += '{';
        continue;
      } else if (param === 'close') {
        out += '}';
        continue;
      }

      if (param.slice(-3) === ' bg') {
        state = bg;
      } else if (param.slice(-3) === ' fg') {
        state = fg;
      } else {
        state = flag;
      }

      if (slash) {
        if (!param) {
          out += program._attr('normal');
          bg.length = 0;
          fg.length = 0;
          flag.length = 0;
        } else {
          attr = program._attr(param, false);
          if (attr == null) {
            out += cap[0];
          } else {
            state.pop();
            if (state.length) {
              out += program._attr(state[state.length - 1]);
            } else {
              out += attr;
            }
          }
        }
      } else {
        if (!param) {
          out += cap[0];
        } else {
          attr = program._attr(param);
          if (attr == null) {
            out += cap[0];
          } else {
            state.push(param);
            out += attr;
          }
        }
      }

      continue;
    }

    if (cap = /^[\s\S]+?(?={\/?[\w\-,;!#]*})/.exec(text)) {
      text = text.substring(cap[0].length);
      out += cap[0];
      continue;
    }

    out += text;
    break;
  }

  return out;
}

export function generateTags(style: Object, text: string) {
  let open = '';
  let close = '';

  Object.entries(style || {}).forEach(([key, val]) => {
    if (typeof val === 'string') {
      val = val.replace(/^light(?!-)/, 'light-');
      val = val.replace(/^bright(?!-)/, 'bright-');
      open = `{${val}-${key}}${open}`;
      close += `{/${val}-${key}}`;
    } else {
      if (val === true) {
        open = `{${key}}${open}`;
        close += `{/${key}}`;
      }
    }
  });

  if (text != null) {
    return open + text + close;
  }

  return { open, close };
}

// TODO: why are these args reversed from Element?
export function attrToBinary(style, element = {}) {
  // TODO: bring this into here instead
  return Element.prototype.sattr.call(element, style);
}

export function stripTags(text: string | null): string {
  if (!text) {
    return '';
  }
  return text
    .replace(/{(\/?)([\w\-,;!#]*)}/g, '')
    .replace(/\x1b\[[\d;]*m/g, '');
}

export function cleanTags(text: string | null): string {
  return stripTags(text).trim();
}

export function dropUnicode(text: string | null): string {
  if (!text) {
    return '';
  }
  return text
    .replace(unicode.chars.all, '??')
    .replace(unicode.chars.combining, '')
    .replace(unicode.chars.surrogate, '?');
};

/**
 * Remove the given element from the array if it exists.
 * @param array The array to remove the element from.
 * @param el The element to remove.
 * @return The index of the element that was removed, or -1 if it didn't exist.
 */
export function removeIfExists(array: any[], el: any): number {
  const i = array.indexOf(el);
  if (i !== -1) {
    array.splice(i, 1);
  }
  return i;
}

export type MethodType = (...args: any[]) => any;

/**
 * A decorator causing the decorated method to run only one time.
 * A _resetExecution method is added to the decorated function to clear
 * the executed flag, allowing it to run one more time.
 */
export function runOnce(
  target: Object,
  name: string,
  descriptor: TypedPropertyDescriptor<MethodType>,
): TypedPropertyDescriptor<MethodType> {
  let hasExecuted = false;
  function wrapper(...args: any[]) {
    if (hasExecuted) {
      return;
    }
    const ret = descriptor.value(...args);
    hasExecuted = true;
    return ret;
  }

  function reset() {
    hasExecuted = false;
  }

  Object.defineProperty(wrapper, '_resetExecution', reset);

  reset();

  descriptor.value = wrapper;
  return descriptor;
}

/**
 * A decorator that creates an alias of the method under the given name.
 */
export function alias(aliasName: string): MethodDecorator {
  return function (target, name, descriptor) {
    Object.defineProperty(target, aliasName, descriptor);
  }
}

export function noop() {};

export { Screen, Element, nextTick };
