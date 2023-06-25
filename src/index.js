const { isObject, typeOf, isEqual, deepClone } = require('./utils')

const storeNames = new Set()

const createStore = (storeName, config = {}) => {
  if (typeof storeName !== 'string') throw TypeError(`The'createStore' needs to receive a string as the first argument`)
  if (storeNames.has(storeName)) throw Error(`A store named '${storeName}' has already existed.`)
  storeNames.add(storeName)
  console.log(storeNames)
  let duringAction = false
  let gettersProxy
  if (!isObject(config)) config = {}
  config.state = config.state ? config.state : {}
  config.actions = config.actions ? config.actions : {}
  config.getters = config.getters ? config.getters : {}
  /*
    定义一个函数以检查写入的属性是否与store中原有的方法重名
  */
  const checkStateName = (propName) => {
    if (Object.keys(config.actions).indexOf(propName) !== -1) {
      throw new Error(`Cannot write a key which has the same name as the action '${propName}' into the state.`)
    }
    const getters = gettersProxy ? gettersProxy : config.getters
    if (getters && Object.keys(getters).indexOf(propName) !== -1) {
      throw new Error(`Cannot write a key which has the same name as the getter '${propName}' into the state.`)
    }
    switch (propName) {
      case '$set':
      case '$reset':
      case '$patch':
      case '$onAction':
      case '$onState':
      case '$onGetter':
      case '$onActions':
      case '$onStates':
      case '$onGetters':
      case '$clearListeners':
      case 'storeName':
      case 'state':
      case 'getters':
        throw new Error(`Cannot write a key which has the same name as the '${propName}' of the store into the state.`)
    }
  }
  const checkStateNames = (state) => {
    Object.keys(state).forEach((propName) => {
      checkStateName(propName)
    })
  }
  checkStateNames(config.state)

  /*
    stateListeners
  */
  const stateListeners = new Set()
  const getValueByChain = (chain, target) => {
    let value = target
    const chainArr = chain.split('.')
    for (let item of chainArr) {
      value = value[item]
      if (value === undefined) return
    }
    return value
  }
  const stateSnapshoots = {}
  const getStateSnapshootsByChains = (target) => {
    stateListeners.forEach((listnerContainer) => {
      const { chain } = listnerContainer
      if (chain !== '*') stateSnapshoots[chain] = getValueByChain(chain, target)
    })
  }
  const callStateListeners = (preState, type, byAction) => {
    stateListeners.forEach((listnerContainer) => {
      const { listener, chain, deep } = listnerContainer
      const mutation = {
        storeName,
        type,
        byAction
      }
      if (chain === '*') {
        listener(mutation, preState)
        return
      }
      mutation.chain = chain
      mutation.value = getValueByChain(chain, stateProxy)
      if (deep) {
        mutation.preValue = getValueByChain(chain, preState)
        if (!isEqual(mutation.value, mutation.preValue)) listener(mutation, preState)
      } else {
        mutation.preValue = stateSnapshoots[chain]
        if (mutation.value !== mutation.preValue) listener(mutation, preState)
      }
    })
  }

  /* getters */
  gettersProxy = new Proxy(config.getters, {
    get(target, propName) {
      return Reflect.apply(target[propName], stateProxy, [stateProxy])
    },
    set(target, propName, value) {
      if (Object.keys(stateProxy).indexOf(propName) !== -1) {
        throw new Error(`Cannot write a key which has the same name as the state '${propName}' into the getters.`)
      }
      if (Object.keys(config.actions).indexOf(propName) !== -1) {
        throw new Error(`Cannot write a key which has the same name as the action '${propName}' into the getters.`)
      }
      if (typeof value !== 'function') {
        throw new TypeError(`Getters should be defined as functions.`)
      }
      const preState = deepClone(config.state)
      getGettersSnapshoots()
      const res = Reflect.set(target, propName, value)
      callGettersListeners(preState, 'redefined', duringAction)
      return res
    },
    deleteProperty(target, propName) {
      const preState = deepClone(config.state)
      getGettersSnapshoots()
      const res = Reflect.deleteProperty(target, propName)
      callGettersListeners(preState, 'redefined', duringAction)
      return res
    }
  })
  /* gettersListeners */
  const gettersListeners = new Set()
  const gettersSnapshoots = {}
  const getGettersSnapshoots = () => {
    for (let key in gettersProxy) {
      gettersSnapshoots[key] = gettersProxy[key]
    }
  }
  const callGettersListeners = (preState, type, byAction) => {
    gettersListeners.forEach((listenerContainer) => {
      const { getterName, listener } = listenerContainer
      const value = gettersProxy[getterName]
      const preValue = gettersSnapshoots[getterName]
      if (!isEqual(value, preValue)) {
        const mutation = {
          storeName,
          getterName,
          type,
          byAction,
          value,
          preValue
        }
        listener(mutation, preState)
      }
    })
  }

  /*
    定义创建stateProxy的函数
    如果state中出现了引用数据类型，则也要为它们创建Proxy
    当修改stateProxy中的内容时，触发监听器
    以config.state为源对象，创建一个stateProxy
  */
  const createStateProxy = state => {
    // 如果传入的参数是引用数据类型的话,则继续为它创建proxy
    if (isObject(state)) {
      for (let k in state) {
        if (isObject(state[k])) {
          state[k] = createStateProxy(state[k])
        }
      }
    }
    // 返回创建的proxy
    return new Proxy(state, {
      get(target, propName) {
        if (propName === '__target__') {
          return target
        }
        return Reflect.get(target, propName)
      },
      set(target, propName, value) {
        // 如果修改的新值是对象数据类型的话,也需要为它创建proxy
        if (isObject(value)) {
          value = createStateProxy(value)
        }
        const preState = deepClone(config.state)
        getStateSnapshootsByChains(stateProxy)
        getGettersSnapshoots()
        const res = Reflect.set(target, propName, value)
        callStateListeners(preState, 'direct', duringAction)
        callGettersListeners(preState, 'direct', duringAction)
        return res
      },
      deleteProperty(target, propName) {
        const preState = deepClone(config.state)
        getStateSnapshootsByChains(stateProxy)
        getGettersSnapshoots()
        const res = Reflect.deleteProperty(target, propName)
        callStateListeners(preState, 'direct', duringAction)
        callGettersListeners(preState, 'direct', duringAction)
        return res
      }
    })
  }
  let stateProxy = createStateProxy(config.state)

  /*
    深拷贝一份state，用于复原初始state
  */
  const originalState = deepClone(config.state)

  /*
    创建action监听器对象
  */
  const actionListeners = new Set()


  /*
    批量订阅
  */
  const subscribeInBulk = (subscribeMethod, identifiers, ...args) => {
    const unSubscribeMethods = new Set()
    identifiers.forEach((identifier) => {
      const res = subscribeMethod(identifier, ...args)
      unSubscribeMethods.add(res)
    })
    return () => {
      let res = false
      unSubscribeMethods.forEach((unSubscribeMethod) => {
        res = unSubscribeMethod() || res
      })
      return res
    }
  }

  /*
    创建store对象
  */
  const store = {
    storeName: storeName,
    state: stateProxy,
    getters: gettersProxy,
    $set: (state) => {
      const preState = deepClone(config.state)
      getStateSnapshootsByChains(stateProxy)
      getGettersSnapshoots()
      stateProxy = createStateProxy(state)
      checkStateNames(stateProxy)
      callStateListeners(preState, '$set', duringAction)
      callGettersListeners(preState, '$set', duringAction)
    },
    $patch: (replacement) => {
      const preState = deepClone(config.state)
      getStateSnapshootsByChains(stateProxy)
      getGettersSnapshoots()
      stateProxy = createStateProxy({ ...config.state, ...replacement })
      checkStateNames(stateProxy)
      callStateListeners(preState, '$patch', duringAction)
      callGettersListeners(preState, '$patch', duringAction)
    },
    $reset: () => {
      const preState = deepClone(config.state)
      getStateSnapshootsByChains(stateProxy)
      getGettersSnapshoots()
      stateProxy = createStateProxy(originalState)
      callStateListeners(preState, '$reset', duringAction)
      callGettersListeners(preState, '$reset', duringAction)
    },
    $onAction: (actionName, listener) => {
      const listenerContainer = { actionName, listener }
      actionListeners.add(listenerContainer)
      return () => actionListeners.delete(listenerContainer)
    },
    $onActions: (actionNames, listener) => subscribeInBulk(storeProxy.$onAction, actionNames, listener),
    // $onActions: (actionNames, listener) => {
    //   unSubscribeMethods = new Set()
    //   actionNames.forEach((actionName) => {
    //     const res = storeProxy.$onGetter(actionName, listener)
    //     unSubscribeMethods.add(res)
    //   })
    //   return () => {
    //     let res
    //     unSubscribeMethods.forEach((unSubscribeMethod) => {
    //       res = res || unSubscribeMethod()
    //     })
    //     return res
    //   }
    // },
    $onState: (chain, listener, isImmediately = false, deep = 'true') => {
      if (isImmediately) {
        const mutation = { storeName, type: 'initialize', byAction: duringAction }
        if (chain !== '*') {
          const value = getValueByChain(chain, stateProxy)
          mutation.chain = chain
          mutation.value = mutation.preValue = value
        }
        listener(mutation, stateProxy, stateProxy)
      }
      let listenerContainer = { chain, listener, deep }
      stateListeners.add(listenerContainer)
      return () => stateListeners.delete(listenerContainer)
    },
    $onStates: (chains, listener, isImmediately = false, deep = 'true') => subscribeInBulk(storeProxy.$onState, chains, listener, isImmediately, deep),
    // $onStates: (chains, listener, isImmediately = false, deep = 'true') => {
    //   unSubscribeMethods = new Set()
    //   chains.forEach((chain) => {
    //     const res = storeProxy.$onState(chain, listener, isImmediately, deep)
    //     unSubscribeMethods.add(res)
    //   })
    //   return () => {
    //     let res
    //     unSubscribeMethods.forEach((unSubscribeMethod) => {
    //       res = res || unSubscribeMethod()
    //     })
    //     return res
    //   }
    // },
    $onGetter: (getterName, listener, isImmediately = false) => {
      if (isImmediately) {
        const value = preValue = gettersProxy[getterName]
        mutation = { storeName, getterName, type: 'initialize', value, preValue }
        listener(mutation, stateProxy, stateProxy)
      }
      let listenerContainer = { getterName, listener }
      gettersListeners.add(listenerContainer)
      return () => gettersListeners.delete(listenerContainer)
    },
    $onGetters: (chains, listener, isImmediately = false) => subscribeInBulk(storeProxy.$onGetter, chains, listener, isImmediately),
    // $onGetters: (getterNames, listener, isImmediately = false) => {
    //   unSubscribeMethods = new Set()
    //   getterNames.forEach((getterName) => {
    //     const res = storeProxy.$onGetter(getterName, listener, isImmediately)
    //     unSubscribeMethods.add(res)
    //   })
    //   return () => {
    //     let res
    //     unSubscribeMethods.forEach((unSubscribeMethod) => {
    //       res = res || unSubscribeMethod()
    //     })
    //     return res
    //   }
    // },
    $clearListeners: type => {
      switch (type) {
        case 'state':
          stateListeners.clear()
          break
        case 'getters':
          gettersListeners.clear()
          break
        case 'actions':
          actionListeners.clear()
          break
        case '*':
          stateListeners.clear()
          gettersListeners.clear()
          actionListeners.clear()
        default:
          throw new Error(`The '$clearListeners' method takes one of 'state','getters','actions' or '*' as the argument`)
      }
    }
  }


  /*
    创建storeProxy
    读取store.state时，返回stateProxy
    读取store中没有的属性时，从stateProxy中读取
    修改store中原有的属性时，报错
    修改store中没有的属性时，从stateProxy中修改
    */
  const storeProxy = new Proxy(store, {
    get(target, propName) {
      if (target[propName] !== undefined) return target[propName]
      if (Object.keys(stateProxy).indexOf(propName) !== -1) {
        return Reflect.get(stateProxy, propName)
      } else if (Object.keys(config.getters).indexOf(propName) !== -1) {
        return Reflect.get(gettersProxy, propName)
      } else {
        return
      }
    },
    set(_, propName, value) {
      checkStateName(propName)
      return Reflect.set(stateProxy, propName, value)
    },
    deleteProperty(_, propName) {
      return Reflect.deleteProperty(stateProxy, propName)
    }
  })

  /*
    绑定每个action的this，指向storeProxy
    创建actionProxy，拦截action的调用
    将每个actionProxy写入store中
  */
  for (let key in config.actions) {
    const action = config.actions[key].bind(storeProxy)
    store[key] = new Proxy(action, {
      apply(target, thisArg, args) {
        duringAction = key
        let res
        let catchedError
        let catchError = false
        const preState = deepClone(config.state)
        try { res = Reflect.apply(target, thisArg, args) } catch (error) {
          catchedError = error
        }

        let after = (callback) => !catchedError ? callback(res) : undefined

        let onError = (callback) => {
          catchError = true
          return catchedError ? callback(catchedError) : undefined
        }

        if (typeOf(res) === 'Promise') {
          after = callback => {
            res.then(
              value => callback(value),
              () => { }
            )
            duringAction = false
            return res
          }
          onError = callback => {
            res.then(
              () => { },
              reason => callback(reason)
            )
            return res
          }
        } else {
          duringAction = false
        }

        const payload = { actionName: key, storeName, args, after, onError }
        actionListeners.forEach((listenerContainer) => {
          const { actionName, listener } = listenerContainer
          if (actionName === key || '*') listener(payload, preState)
        })

        if (!catchError && catchedError) throw catchedError
        return res
      }
    })
  }

  return storeProxy

}

module.exports = { createStore }
