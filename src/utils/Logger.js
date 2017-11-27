'use strict';

export default class Logger {
  constructor(name) {
    this.name = name;
  }

  log() {
    console.log(this.name + ':', ...arguments);
  }

  warn() {
    console.warn(this.name + ':', ...arguments);
  }

  error() {
    console.error(this.name + ':', ...arguments);
  }
}