/**
 * button.js - button element for blessed
 * Copyright (c) 2013-2015, Christopher Jeffrey and contributors (MIT License).
 * https://github.com/chjj/blessed
 */

import Input from './input';

export default class Button extends Input {
  public type = 'button';
  constructor(options = {}) {
    super({
      autoFocus: false,
      ...options,
    });

    this.on('keypress', (ch, key) => {
      if (key.name === 'enter' || key.name === 'space') {
        return this.press();
      }
    });

    if (this.options.mouse) {
      this.on('click', () => this.press());
    }
  }

  press() {
    this.focus();
    this.value = true;
    const result = this.emit('press');
    delete this.value;
    return result;
  }
}
