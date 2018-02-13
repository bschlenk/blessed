/**
 * blessed - a high-level terminal interface library for node.js
 * Copyright (c) 2013-2015, Christopher Jeffrey and contributors (MIT License).
 * https://github.com/chjj/blessed
 */

export default function blessed() {
  return blessed.program.apply(null, arguments);
}

blessed.program = blessed.Program = require('./program');
blessed.tput = blessed.Tput = require('./tput');
blessed.widget = require('./widget');
blessed.colors = require('./colors');
blessed.unicode = require('./unicode');
blessed.helpers = require('./helpers');

blessed.helpers.sprintf = blessed.tput.sprintf;
blessed.helpers.tryRead = blessed.tput.tryRead;
Object.assign(blessed, blessed.helpers);
Object.assign(blessed, blessed.widget);
