/**
 * box.js - box element for blessed
 * Copyright (c) 2013-2015, Christopher Jeffrey and contributors (MIT License).
 * https://github.com/chjj/blessed
 */

import Element from './element';

export default class Box extends Element {
  public type = 'box';
  constructor(options = {}) {
    super(options);
  }
}
