/* eslint-disable guard-for-in, no-restricted-syntax */
import { createStore, applyMiddleware, compose, combineReducers } from 'redux';
import createSagaMiddleware, { END } from 'redux-saga';

let composeEnhancers = compose;
if (process.env.NODE_ENV !== 'production') {
  composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;
}

/**
 * @param {object} config
 * @param {object} config.reducers
 * @param {object|array} config.preloadedState
 * @param {array} config.middlewares
 * @param {array} config.enhancers
 * @param {function} config.effect
 * @param {array} config.models
 */
const init = (config) => {
  // reducers
  let reducers = config.reducers || {};
  const mergeReducers = (nextReducers = {}) => {
    reducers = { ...reducers, ...nextReducers };
    if (Object.keys(reducers).length === 0) {
      return state => state;
    }
    return combineReducers(reducers);
  };
  for (const item of config.models || []) {
    reducers[item.namespace] = item.reduce;
  }

  // middlewares
  const sagaMiddleware = createSagaMiddleware();
  const middlewares = [sagaMiddleware, ...(config.middlewares || [])];

  // store
  const store = createStore(
    mergeReducers(),
    config.preloadedState,
    composeEnhancers(
      applyMiddleware(...middlewares),
      ...(config.enhancer || {}),
    ),
  );

  // effect
  if (config.effect) {
    sagaMiddleware.run(config.effect);
  }
  for (const item of config.models || []) {
    sagaMiddleware.run(item.effect);
  }

  return {
    ...store,
    /**
     * @param {array} models
     */
    model(models) {
      const modelReducers = {};
      // prettier-ignore
      for (const item of (Array.isArray(models) ? models : [models])) {
        if (!reducers[item.namespace]) {
          modelReducers[item.namespace] = item.reduce;
          sagaMiddleware.run(item.effect);
        }
      }
      store.replaceReducer(mergeReducers(modelReducers));
    },
    destroy() {
      store.dispatch(END);
    },
  };
};

export default init;
