/* eslint-disable guard-for-in, no-restricted-syntax */
import merge from 'lodash.merge';
import { takeEvery } from 'redux-saga/effects';

const TYPE_DIVIDED_SYMBOLS = '/';
const makeType = (namespace, type) =>
  `${namespace}${TYPE_DIVIDED_SYMBOLS}${type}`;
const makeActionCreator = type => (payload) => {
  return {
    type,
    payload,
  };
};
// prettier-ignore
const GeneratorFunction = (function*(){}).constructor; // eslint-disable-line
const isGeneratorFunction = func => func instanceof GeneratorFunction;
const extractReducers = (instance) => {
  const reducers = {};
  const defaultState = {};
  let prototype = Object.getPrototypeOf(instance);
  let constructor = prototype && prototype.constructor;
  while (constructor && (constructor.defaultState || constructor.reducers)) {
    merge(reducers, constructor.reducers);
    merge(defaultState, constructor.defaultState);
    prototype = Object.getPrototypeOf(prototype);
    constructor = prototype && prototype.constructor;
  }
  return {
    reducers,
    defaultState,
  };
};
const extractGeneratorFunctions = (instance) => {
  const effects = {};
  // TODO 通过原型链获取所有父级的副作用函数
  const keys = Object.getOwnPropertyNames(Object.getPrototypeOf(instance));
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    const value = instance[key];
    if (value && isGeneratorFunction(value)) {
      effects[key] = value;
    }
  }
  return effects;
};

/**
 * 状态管理模型
 */
class Model {
  constructor(namespace) {
    const selft = this;

    this.namespace = namespace; // 命名空间
    this.types = {}; // 动作类型
    this.actions = {}; // 动作创建器
    this.selectors = {}; // 状态选择器

    const { reducers, defaultState } = extractReducers(this);
    const effects = extractGeneratorFunctions(this);
    const actionKeys = [
      ...Object.keys(effects || {}),
      ...Object.keys(reducers || {}),
    ];
    for (const key of actionKeys) {
      const reducer = reducers[key];
      if (key.indexOf(TYPE_DIVIDED_SYMBOLS) >= 0) {
        // 非当前命名空间下的 action
        const type = key;
        if (reducer) {
          reducers[type] = reducer;
        }
      } else {
        const type = makeType(namespace, key);
        this.types[key] = type;
        if (!this.actions[key]) {
          this.actions[key] = makeActionCreator(type).bind(selft);
        }
        if (reducer) {
          reducers[type] = reducer;
        }
      }
    }

    this.defaultState = defaultState; // 默认状态
    // 副作用函数
    this.effect = function* effect() {
      for (const key of Object.keys(effects || {})) {
        const type = key.indexOf('/') >= 0 ? key : makeType(namespace, key);
        yield takeEvery(type, effects[key].bind(selft));
      }
    };
    // 状态处理
    this.reduce = (state = defaultState, action) => {
      const reduceProcess = reducers[action.type];
      if (typeof reduceProcess === 'function') {
        return reduceProcess(state, action);
      }
      return state;
    };
  }

  getState = state => state[this.namespace];
}

export default Model;
