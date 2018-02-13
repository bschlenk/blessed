/**
 * line.js - line element for blessed
 * Copyright (c) 2013-2015, Christopher Jeffrey and contributors (MIT License).
 * https://github.com/chjj/blessed
 */

import Box from './box';

export default class Line extends Box {
  public type = 'line';

  constructor({
    orientation = 'vertical',
    ...options,
  }) {
    if (orientation === 'vertical') {
      options.width = 1;
    } else {
      options.height = 1;
    }

    super(options);

    this.ch = !options.type || options.type === 'line'
      ? orientation === 'horizontal' ? '─' : '│'
      : options.ch || ' ';

    this.border = {
      type: 'bg',
      __proto__: this
    };

    this.style.border = this.style;
  }
