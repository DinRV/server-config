'use strict';

const native = tryLoadNative();

function tryLoadNative() {
  try {
    return require('../build/Release/fastjson.node');
  } catch (err) {
    return null;
  }
}

function parse(str, reviver) {
  if (native && str.length > 1024) return native.parse(str);
  return JSON.parse(str, reviver);
}

function stringify(value, replacer, space) {
  if (native && !replacer && !space) return native.stringify(value);
  return JSON.stringify(value, replacer, space);
}

module.exports = { parse, stringify, hasNativeBindings: Boolean(native) };
