/**
 * checkbox.js - checkbox element for blessed
 * Copyright (c) 2013-2015, Christopher Jeffrey and contributors (MIT License).
 * https://github.com/chjj/blessed
 */

import Input from './input';

export default class Checkbox extends Input {
  public type = 'checkbox';

  public text: string;
  public checked: boolean;

  constructor(options = {}) {
    super(options);

    this.text = options.content || options.text || '';
    this.checked = options.checked || false;

    this.on('keypress', (ch, key) => {
      if (key.name === 'enter' || key.name === 'space') {
        this.toggle();
        this.screen.render();
      }
    });

    if (options.mouse) {
      this.on('click', () => {
        this.toggle();
        this.screen.render();
      });
    }

    this.on('focus', () => {
      const { lpos } = this;
      if (!lpos) {
        return;
      }
      this.screen.program.lsaveCursor('checkbox');
      this.screen.program.cup(lpos.yi, lpos.xi + 1);
      this.screen.program.showCursor();
    });

    this.on('blur', () => {
      this.screen.program.lrestoreCursor('checkbox', true);
    });
  }

  get value() {
    return this.checked;
  }

  render() {
    this.clearPos(true);
    this.setContent('[' + (this.checked ? 'x' : ' ') + '] ' + this.text, true);
    return this._render();
  }

  check() {
    if (this.checked) {
      return;
    }
    this.checked = true;
    this.emit('check');
  }

  uncheck() {
    if (!this.checked) {
      return;
    }
    this.checked = false;
    this.emit('uncheck');
  }

  toggle() {
    return this.checked ? this.uncheck() : this.check();
  }
}
