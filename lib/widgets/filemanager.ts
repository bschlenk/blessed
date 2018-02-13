/**
 * filemanager.js - file manager element for blessed
 * Copyright (c) 2013-2015, Christopher Jeffrey and contributors (MIT License).
 * https://github.com/chjj/blessed
 */

/**
 * Modules
 */

import * as path from 'path';
import * as fs from 'fs';
import * as helpers from '../helpers';
import List from './list';

export default class FileManager extends List {
  public type = 'file-manager';

  constructor(options = {}) {
    super({
      parseTags: true,
      ...options,
    });

    this.cwd = options.cwd || process.cwd();
    this.file = this.cwd;
    this.value = this.cwd;

    if (options.label && ~options.label.indexOf('%path')) {
      this._label.setContent(options.label.replace('%path', this.cwd));
    }

    this.on('select', (item) => {
      const value = item.content.replace(/\{[^{}]+\}/g, '').replace(/@$/, '');
      const file = path.resolve(self.cwd, value);

      return fs.stat(file, (err, stat) => {
        if (err) {
          return this.emit('error', err, file);
        }
        this.file = file;
        this.value = file;
        if (stat.isDirectory()) {
          this.emit('cd', file, self.cwd);
          this.cwd = file;
          if (options.label && ~options.label.indexOf('%path')) {
            this._label.setContent(options.label.replace('%path', file));
          }
          this.refresh();
        } else {
          this.emit('file', file);
        }
      });
    });
  }

  refresh(cwd, callback) {
    if (!callback) {
      callback = cwd;
      cwd = null;
    }

    if (cwd) {
      this.cwd = cwd;
    } else {
      cwd = this.cwd;
    }

    return fs.readdir(cwd, (err, list) => {
      if (err && err.code === 'ENOENT') {
        this.cwd = cwd !== process.env.HOME
          ? process.env.HOME
          : '/';
        return this.refresh(callback);
      }

      if (err) {
        if (callback) {
          return callback(err);
        }
        return this.emit('error', err, cwd);
      }

      let dirs = [];
      let files = [];

      list.unshift('..');

      list.forEach((name) => {
        const f = path.resolve(cwd, name);
        let stat;

        try {
          stat = fs.lstatSync(f);
        } catch (e) {}

        if ((stat && stat.isDirectory()) || name === '..') {
          dirs.push({
            name: name,
            text: '{light-blue-fg}' + name + '{/light-blue-fg}/',
            dir: true
          });
        } else if (stat && stat.isSymbolicLink()) {
          files.push({
            name: name,
            text: '{light-cyan-fg}' + name + '{/light-cyan-fg}@',
            dir: false
          });
        } else {
          files.push({
            name: name,
            text: name,
            dir: false
          });
        }
      });

      dirs = helpers.asort(dirs);
      files = helpers.asort(files);

      list = dirs.concat(files).map(data => data.text);

      this.setItems(list);
      this.select(0);
      this.screen.render();

      this.emit('refresh');

      if (callback) {
        callback();
      }
    });
  }

  pick(cwd, callback) {
    if (!callback) {
      callback = cwd;
      cwd = null;
    }

    const focused = this.screen.focused === this;
    const hidden = this.hidden;
    let onfile;
    let oncancel;

    const resume = () => {
      this.removeListener('file', onfile);
      this.removeListener('cancel', oncancel);
      if (hidden) {
        this.hide();
      }
      if (!focused) {
        this.screen.restoreFocus();
      }
      this.screen.render();
    }

    onfile = (file) => {
      resume();
      return callback(null, file);
    }

    oncancel = () => {
      resume();
      return callback();
    };

    this.on('file', onfile);
    this.on('cancel', oncancel);

    this.refresh(cwd, (err) => {
      if (err) {
        return callback(err);
      }

      if (hidden) {
        this.show();
      }

      if (!focused) {
        this.screen.saveFocus();
        this.focus();
      }

      this.screen.render();
    });
  }

  reset(cwd, callback) {
    if (!callback) {
      callback = cwd;
      cwd = null;
    }
    this.cwd = cwd || this.options.cwd;
    this.refresh(callback);
  }
}
