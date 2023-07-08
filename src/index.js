const { isObject, typeOf, isEqual, deepClone } = require('./utils')

// storeNames 用于存储已创建的 store 名
const storeNames = new Set()

// 所有 store 共享一个 duringAction 变量，用于 [监听模块] 中的 [追踪 action 模块]
let duringAction = false

const createStore = (storeName, config = {}) => {

  /*
    storeName 模块
  */

  if (typeof storeName !== 'string') throw TypeError(`The'createStore' needs to receive a string as the first argument.`)
  if (storeNames.has(storeName)) throw Error(`A store named '${storeName}' has already existed.`)
  storeNames.add(storeName)

  /*
    创建 store
  */

  const store = {
    storeName,
    $set: state => {
      config.state = state
      modifyState(() => stateProxy = createStateProxy(config.state), '$set')
    },
    $patch: replacement => {
      modifyState(() => stateProxy = createStateProxy({ ...config.state, ...replacement }), '$patch')
    },
    $reset: () => {
      modifyState(() => {
        stateProxy = createStateProxy(initialMemory.get('initial'))
        restoreFunctions(stateProxy, 'initial', initialfunctionBackups)
      }, '$reset', false)
    }
  }

  /*
    检查 state 名模块
  */

  // checkStateName 用以检查写入的state名是否与 actions 和 getters 中的方法或 store 中原有的方法重名，如有则抛出错误
  const checkStateName = propName => {
    if (Object.keys(config.actions).indexOf(propName) !== -1) throw new Error(`Cannot write a key which has the same name as the action '${propName}' into the state.`)
    if (Object.keys(config.getters).indexOf(propName) !== -1) throw new Error(`Cannot write a key which has the same name as the getter '${propName}' into the state.`)
    if ([...Object.keys(store), 'state', 'actions', 'getters', '$onAction', '$onState', '$onGetter', '$clearListeners', '$cb', '$save', '$load', '$delSave', '$get'].indexOf(propName) !== -1) throw new Error(`Cannot write a key which has the same name as the '${propName}' of the store into the state.`)
  }

  // checkStateNames 用以检查 state 下第一层的每个属性
  const checkStateNames = state => {
    Object.keys(state).forEach(propName => {
      checkStateName(propName)
    })
  }

  // checkTargetProp 用于递归检测对象中是否存在 __target__ 属性
  const checkTargetProp = item => {
    if (typeOf(item) !== 'Object' && typeOf(item) !== 'Function') return
    Object.keys(item).forEach(key => {
      if (key === '__target__' && !isEqual(item, item[key])) throw new Error(`Objects in the state cannot have a user-defined property named '__target__'.`)
      checkTargetProp(item[key])
    })

  }

  /*
    检查 config 模块
    - 初始化传入 createStore 的 config ，并检查其是否符合要求
  */

  // 初始化
  const initializeConfig = target => {
    return typeOf(target) === 'Object' ? target : {}
  }
  config = initializeConfig(config)
  config.state = initializeConfig(config.state)
  config.actions = initializeConfig(config.actions)
  config.getters = initializeConfig(config.getters)

  // checkConfigItem 用以检查传入的 actions 和 getters 是都都为函数类型
  const checkConfigItem = (target, errMsg) => {
    for (let k in target) {
      if (typeOf(target[k]) !== 'Function' && typeOf(target[k]) !== 'AsyncFunction') throw TypeError(errMsg)
    }
  }

  // 分别检查 state、actions、getters
  checkStateNames(config.state)
  checkConfigItem(config.actions, 'Actions should be defined as Functions.')
  checkConfigItem(config.getters, 'Getters should be defined as Functions.')

  /*
    核心模块
    - 处理 store、state、getters、actions 之间的关系
  */

  // createStateProxy 用于为传入的 state 和其中每一层未被代理的对象创建 Proxy，将代理后的 stateProxy 返回
  const createStateProxy = state => {
    // 如果传入的参数是引用数据类型的话,则继续为它内部未被代理的对象创建 proxy
    if (isObject(state)) {
      for (let k in state) {
        if (isObject(state[k]) && !state[k].__target__) {
          state[k] = createStateProxy(state[k])
        }
      }
    }
    // 当用户试图操作 state 和其中的对象的 __target__ 属性时抛出 targetEorror
    const targetEorror = new Error(`The property named '__target__' of state or objects in state is read-only.`)
    // 返回创建的 proxy
    return new Proxy(state, {
      get(target, propName) {
        // 当读取代理对象的 __target__ 属性时，返回原对象
        if (propName === '__target__') return target
        return Reflect.get(target, propName)
      },
      set(target, propName, value) {
        if (propName === '__target__') throw targetEorror
        // 如果修改的新值是对象数据类型的话，也需要为它创建proxy
        value = isObject(value) && !value.__target__ ? createStateProxy(value) : value
        return modifyState(() => Reflect.set(target, propName, value), 'direct', { value })
      },
      deleteProperty(target, propName) {
        if (propName === '__target__') throw targetEorror
        return modifyState(() => Reflect.deleteProperty(target, propName), 'direct', propName)
      }
    })
  }

  // createGetterProxy 用于为 getters 创建代理对象
  const createGettersProxy = getters => {
    return new Proxy(getters, {
      get(target, propName) {
        if (typeof target[propName] === 'function') return Reflect.apply(target[propName], stateProxy, [stateProxy])
      },
      set() {
        throw new Error(`Getters should be defined when using 'createStore'.`)
      },
      deleteProperty() {
        return false
      }
    })
  }

  // createActionsProxy 用于处理 actions 中的 action，返回处理后的 actions 对象的代理对象
  const createActionsProxy = actions => {
    Object.keys(actions).forEach(key => {
      actions[key] = new Proxy(actions[key], {
        apply(target, _, args) {

          setDuringAction(key)

          let res
          let catchedError
          let catchError = false
          const preState = deepClone(config.state)
          try { res = Reflect.apply(target, storeProxy, args) } catch (error) {
            catchedError = error
          }

          let after = callback => !catchedError ? callback(res) : undefined

          let onError = callback => {
            catchError = true
            return catchedError ? callback(catchedError) : undefined
          }

          duringAction = false

          if (typeOf(res) === 'Promise') {

            res.then = new Proxy(res.then, {
              apply(target, thisArg, args) {
                const callbackProxy = callback => new Proxy(callback, {
                  apply(target, thisArg, args) {
                    let _duringAction = duringAction
                    setDuringAction(key)
                    const res = Reflect.apply(target, thisArg, args)
                    duringAction = _duringAction
                    return res
                  }
                })
                args[0] = typeof args[0] === 'function' ? callbackProxy(args[0]) : args[0]
                args[1] = typeof args[1] === 'function' ? callbackProxy(args[1]) : args[1]
                return Reflect.apply(target, thisArg, args)
              }
            })

            after = callback => {
              res.then(
                value => {
                  callback.call(storeProxy, value, storeProxy)
                },
                () => { }
              )
              return res
            }
            onError = callback => {
              res.then(
                () => { },
                reason => callback.call(storeProxy, reason, storeProxy)
              )
              return res
            }
          }

          const payload = { name: key, storeName, args, preState }
          actionListeners.forEach(listenerContainer => {
            const { actionName, listener } = listenerContainer
            if (actionName === key || actionName === '*') listener(payload, after, onError)
          })

          if (!catchError && catchedError) throw catchedError
          return res
        }
      })
    })

    return new Proxy(actions, {
      set() {
        throw new Error(`Actions should be defined when using 'createStore'.`)
      }
    })
  }

  // 分别处理 state，actions，getters，store
  let stateProxy = createStateProxy(config.state)
  const actionsProxy = createActionsProxy(config.actions)
  const gettersProxy = createGettersProxy(config.getters)
  store.actions = actionsProxy
  store.getters = gettersProxy
  const storeProxy = new Proxy(store, {
    get(target, propName) {
      // 从 storeProxy 中读取 state 和 getters 时，分别返回 stateProxy 和 gettersProxy
      if (propName === 'state') return stateProxy
      if (propName === 'getters') return gettersProxy
      // 读取 storeProxy 中原本存在的属性时，返回该属性
      if (target[propName] !== undefined) return target[propName]
      // 从 storeProxy 中读取的属性名在 stateProxy 中存在时，返回该属性
      if (Object.keys(stateProxy).indexOf(propName) !== -1) return Reflect.get(stateProxy, propName)
      // 从 storeProxy 中读取的属性名在 actionsProxy 中存在时，返回该属性
      if (Object.keys(actionsProxy).indexOf(propName) !== -1) return Reflect.get(actionsProxy, propName)
      // 从 storeProxy 中读取的属性名在 gettersProxy 中存在时，返回该属性
      if (Object.keys(gettersProxy).indexOf(propName) !== -1) return Reflect.get(gettersProxy, propName)
    },
    set(_, propName, value) {
      // 对 storeProxy 中进行设置属性操作时，该操作将转移到 stateProxy 上进行
      return Reflect.set(stateProxy, propName, value)
    },
    deleteProperty(_, propName) {
      // 对 storeProxy 中的属性进行删除操作时，该操作将转移到 stateProxy 上进行
      return Reflect.deleteProperty(stateProxy, propName)
    }
  })

  /*
    监听模块
  */

  // ↓↓↓ 监听相关模块 ↓↓↓

  // subscribeInBulk 用以在 $onState 或 $onAction 或 $onGetter 方法中进行批量监听操作
  const subscribeInBulk = (subscribeMethod, identifiers, ...args) => {
    const unSubscribeMethods = new Set()
    identifiers.forEach(identifier => {
      const res = subscribeMethod(identifier, ...args)
      unSubscribeMethods.add(res)
    })
    return () => {
      let res = false
      unSubscribeMethods.forEach(unSubscribeMethod => {
        res = unSubscribeMethod() || res
      })
      return res
    }
  }

  // chain 模块 - 监听 state 时使用 chain 作为标识符
  // parseChain 用于将 chain 解析并拆分为数组
  const parseChain = chain => {
    let chainArr = []
    for (let item of chain.split('.')) {
      const reg = /[^\[\]'`"]+/g
      chainArr = [...chainArr, ...item.match(reg)]
    }
    return chainArr
  }
  // getValueByChain  用于使用 chain 在 state 中获取对应的数据
  const getValueByChain = (chain, target) => {
    let value = target
    const chainArr = parseChain(chain)
    for (let item of chainArr) {
      value = value[item]
      if (value === undefined) return
    }
    return value
  }

  // 追踪 action 模块 - 用于监听 state 或 getter 发生变化时，判断其是否由 action 引起
  // 当一个 action 对 state 进行修改操作前后，修改 duringAction 的值，实现方式体现在 [核心模块] 的 createActionsProxy 函数中
  // setDuringAction 用于修改 duringAction 的值
  const setDuringAction = key => {
    const actionInfo = { storeName, actionName: key }
    switch (typeOf(duringAction)) {
      case 'Boolean':
        duringAction = [actionInfo]
        break
      case 'Array':
        duringAction = [...duringAction, actionInfo]
        break
    }
  }
  // setDuringAction 用于在现有的 duringAction 上合并新的 duringAction 信息
  const combineDuringAction = _duringAction => {
    switch (typeOf(duringAction)) {
      case 'Boolean':
        duringAction = _duringAction
        break
      case 'Array':
        duringAction = [...duringAction, ..._duringAction]
        break
    }
  }
  // 为 store 添加 $cb 方法，以配合追踪异步 action
  store.$cb = callback => {
    // _duringAction 是调用 $cb 时，duringAction 的值
    let _duringAction = duringAction
    return new Proxy(callback, {
      apply(target, thisArg, args) {
        let duringActionCache = duringAction
        if (_duringAction) combineDuringAction(_duringAction)
        const res = Reflect.apply(target, thisArg, args)
        duringAction = duringActionCache
        return res
      }
    })
  }

  // 取消监听模块 - 为 store 添加 $clearListeners 方法以取消监听
  store.$clearListeners = type => {
    switch (type) {
      case 'state':
        stateListeners.clear()
        break
      case 'getters':
      case 'getter':
        getterListeners.clear()
        break
      case 'actions':
      case 'action':
        actionListeners.clear()
        break
      case '*':
      case 'all':
        stateListeners.clear()
        getterListeners.clear()
        actionListeners.clear()
      default:
        throw new Error(`The '$clearListeners' method takes one of 'state','getters','actions' or '*' as the argument`)
    }
  }

  // modifyState 用于修改 state 数据，并对修改进行监听，所有 state 的修改操作都通过 modifyState 进行
  // - 将操作 state 的函数作为第一个参数传入，如果传入 false 则不修改 state 但强制执行
  // - 将操作的类型字符串作为第二个参数传入
  // - 如果不是批量修改操作，则将单独修改的值以 value 为键名放入一个对象中，作为第三个参数 check 传入，用以单独检查
  // - 如果不需要进行检查 state 名，则将 false 作为第三个参数 check 传入
  const modifyState = (modification, type, check) => {
    const preState = deepClone(config.state)
    getChainSnapshots()
    getGettersSnapshots()
    const res = modification ? modification() : undefined
    if (check !== false) {
      checkStateNames(stateProxy)
      typeOf(check) === 'Object' ? checkTargetProp(check.value) : checkTargetProp(stateProxy)
    }
    const mutationMakers = createMutationMakers(preState, type)
    const { createStateMutation, createGetterMutation } = mutationMakers
    callStateListeners(createStateMutation)
    callGetterListeners(createGetterMutation)
    chainSnapshots = {}
    gettersSnapshots = {}
    return res
  }

  // createMutationMaker 接收 preState, type, byAction，返回一个 mutation 的生成器
  const createMutationMakers = (preState, type) => {
    const _mutation = { storeName, type, byAction: duringAction, preState }
    return {
      createStateMutation: (chain, deep, isForce) => {
        const mutation = deepClone(_mutation)
        if (chain === '*') return mutation
        mutation.chain = chain
        mutation.value = getValueByChain(chain, stateProxy)
        // chainSnapshots[chain] 是这次变化前的该 chain 对应的引用地址的数据
        mutation.preValue = chainSnapshots[chain]
        if (isForce) {
          mutation.preValue = mutation.value
          return mutation
        }
        if (deep) {
          mutation.preValue = getValueByChain(chain, preState)
          // deep 下，函数类型的 preVale 默认是它的对象部分的快照，但还得判断该函数是否被更换了引用地址
          if (typeof chainSnapshots[chain] === 'function' && chainSnapshots[chain] !== mutation.value) {
            return mutation
            // 非函数类型或函数引用地址没有改变，则可以直接比较对象部分是否结构内容相等
          } else if (!isEqual(mutation.value, mutation.preValue)) return mutation
        } else {
          // 非 deep 下，直接比较引用地址是否改变
          if (mutation.value !== mutation.preValue) return mutation
        }
      },
      createGetterMutation: (getterName, isForce) => {
        const value = gettersProxy[getterName]
        const preValue = gettersSnapshots[getterName]
        if (!isForce && isEqual(value, preValue)) return undefined
        const mutation = deepClone(_mutation)
        mutation.name = getterName
        mutation.value = value
        mutation.preValue = isForce ? value : preValue
        return mutation
      }
    }
  }


  const createStateMutation = (preState, type, chain, deep) => {
    const mutation = {
      storeName,
      type,
      byAction: duringAction,
      preState
    }
    if (chain === '*') return mutation
    mutation.chain = chain
    mutation.value = getValueByChain(chain, stateProxy)
    // chainSnapshots[chain] 是这次变化前的该 chain 对应的引用地址的数据
    mutation.preValue = chainSnapshots[chain]
    if (deep) {
      mutation.preValue = getValueByChain(chain, preState)
      // deep 下，函数类型的 preVale 默认是它的对象部分的快照，但还得判断该函数是否被更换了引用地址
      if (typeof chainSnapshots[chain] === 'function' && chainSnapshots[chain] !== mutation.value) {
        return mutation
        // 非函数类型或函数引用地址没有改变，则可以直接比较对象部分是否结构内容相等
      } else if (!isEqual(mutation.value, mutation.preValue)) return mutation
    } else {
      // 非 deep 下，直接比较引用地址是否改变
      if (mutation.value !== mutation.preValue) return mutation
    }
  }

  // ↑↑↑ 监听相关模块 ↑↑↑

  // ↓↓↓ state 监听模块 ↓↓↓

  // stateListeners 用于存放监听的 state 的回调函数
  const stateListeners = new Set()

  // callStateListeners 需要在 state 可能发生变化时调用，它会判断哪些监听的 state 发生了变化，并执行 stateListeners 中对应的回调函数
  const callStateListeners = (createStateMutation) => {
    stateListeners.forEach(listenerContainer => {
      const { listener, chain, deep } = listenerContainer
      const mutation = createStateMutation(chain, deep)
      if (mutation) listener(mutation)
    })
  }

  // chainSnapshots 模块
  // chainSnapshots 用以保存 state 监听中的 chain 在 stateProxy 中某一时刻对应的数据的指向地址，在非 deep 模式的 state 监听中用以比较监听的数据的指向地址是否发生改变
  let chainSnapshots = {}
  // getChainSnapshots 调用时，将所有 state 监听中的 chain 与这些 chain 在当前 stateProxy 中对应的值（引用对象的话则是指向地址）作为键值对保存到 chainSnapshots 中
  const getChainSnapshots = () => {
    stateListeners.forEach(listenerContainer => {
      const { chain } = listenerContainer
      if (chain !== '*') chainSnapshots[chain] = getValueByChain(chain, stateProxy)
    })
  }

  // 为 store 添加 $onState 方法
  store.$onState = (chain, listener, isImmediate = false, deep = true) => {
    listener = listener.bind(storeProxy)
    switch (typeOf(chain)) {
      case 'String':
        let listenerContainer = { chain, listener, deep }
        stateListeners.add(listenerContainer)
        if (isImmediate) {
          const mutation = createMutationMakers(stateProxy, 'initial').createStateMutation(chain, deep, true)
          listener(mutation)
        }
        return () => stateListeners.delete(listenerContainer)
      case 'Array':
        return subscribeInBulk(storeProxy.$onState, chain, listener, isImmediate, deep)
      default:
        throw new TypeError(`The first argument received by '$onState' should be string type or array type.`)
    }
  }

  // ↑↑↑ state 监听模块 ↑↑↑

  // ↓↓↓ getter 监听模块 ↓↓↓

  // getterListeners 用于存放监听的 state 的回调函数
  const getterListeners = new Set()

  // callGetterListeners 需要在 state 可能发生变化时调用，它会判断此次变化是否使得监听的 getter 返回值发生了变化，并执行 getterListeners 中对应的回调函数
  const callGetterListeners = (createGetterMutation) => {
    getterListeners.forEach(listenerContainer => {
      const { getterName, listener } = listenerContainer
      const mutation = createGetterMutation(getterName)
      if (mutation) listener(mutation)
    })
  }

  // gettersSnapshots 模块
  // gettersSnapshots 用以保存监听的 getter 在某一时刻的返回值
  let gettersSnapshots = {}
  // getGettersSnapshots 调用时，将监听的 getter 的 getterName 与这些 getter 此时的返回值作为键值对保存到 gettersSnapshots 中
  const getGettersSnapshots = () => {
    getterListeners.forEach(listenerContainer => {
      const { getterName } = listenerContainer
      gettersSnapshots[getterName] = gettersProxy[getterName]
    })
  }

  // 为 sotre 添加 $onGetter 方法
  store.$onGetter = (getterName, listener, isImmediate = false) => {
    listener = listener.bind(storeProxy)
    const getterNames = Object.keys(gettersProxy)
    if (getterName === '*') return subscribeInBulk(storeProxy.$onGetter, getterNames, listener, isImmediate)
    if (getterNames.indexOf(getterName) === -1) throw new Error(`The getter named '${getterName}' to be subscribed is not defined in Getters.`)
    switch (typeOf(getterName)) {
      case 'String':
        let listenerContainer = { getterName, listener }
        getterListeners.add(listenerContainer)
        if (isImmediate) {
          const mutation = createMutationMakers(stateProxy, 'initial').createGetterMutation(getterName, true)
          listener(mutation)
        }
        return () => getterListeners.delete(listenerContainer)
      case 'Array':
        return subscribeInBulk(storeProxy.$onGetter, getterName, listener, isImmediate)
      default:
        throw new TypeError(`The first argument received by '$onGetter' should be string type or array type.`)
    }
  }

  // ↑↑↑ getter 监听模块 ↑↑↑

  // ↓↓↓ action 监听模块 ↓↓↓

  // actionListeners 用于存放监听的 action 的回调函数，其调用方式的实现体现在 [核心模块] 的 createActionsProxy 函数中
  const actionListeners = new Set()

  // 为 store 添加 $onAction 方法
  store.$onAction = (actionName, listener) => {
    listener = listener.bind(storeProxy)
    if (Object.keys(config.actions).indexOf(actionName) === -1) throw new Error(`The action named '${actionName}' to be subscribed is not defined in Actions.`)
    switch (typeOf(actionName)) {
      case 'String':
        const listenerContainer = { actionName, listener }
        actionListeners.add(listenerContainer)
        return () => actionListeners.delete(listenerContainer)
      case 'Array':
        return subscribeInBulk(storeProxy.$onAction, actionName, listener)
      default:
        throw new TypeError(`The first argument received by '$onAction' should be string type or array type.`)
    }
  }

  // ↑↑↑ action 监听模块 ↑↑↑

  /*
    还原点模块
  */

  // 相关工具函数
  // backUpFunctions 用于根据 id 备份对象中的所有函数对象
  const backUpFunctions = (target, id, functionBackups) => {
    // 则传入函数作为 target 时，以函数指向的地址为键名，将 [id 与函数的对象部分作为一个个键值对组成的 map] 作为键值，传入 functionBackups 中
    // functionBackups 也是一个 map，使用时传入
    if (isObject(target)) {
      for (let k in target) {
        backUpFunctions(target[k], id, functionBackups)
      }
    }
    if (typeof target === 'function') {
      const separatedObject = deepClone(target)
      if (functionBackups.has(target)) {
        const idAndObj = functionBackups.get(target)
        idAndObj.set(id, separatedObject)
        functionBackups.set(target, idAndObj)
      } else {
        const idAndObj = new Map([[id, separatedObject]])
        functionBackups.set(target, idAndObj)
      }
    }
  }
  // restoreFunctions 用于根据 id 还原函数对象
  const restoreFunctions = (target, id, functionBackups) => {
    if (isObject(target)) {
      for (let k in target) {
        restoreFunctions(target[k], id, functionBackups)
      }
    }
    if (typeof target === 'function') {
      const separatedObject = functionBackups.get(target).get(id)
      for (let k in separatedObject) {
        target[k] = separatedObject[k]
      }
    }
  }
  // deleteBackup 用于根据 id 删除函数对象备份
  const deleteBackup = (id, functionBackups) => {
    functionBackups.forEach((idAndObj, key) => {
      idAndObj.delete(id)
      if (idAndObj.size === 0) functionBackups.delete(key)
    })
  }

  //  $save() 调用后的快照保存在 memory 中
  const memory = new Map()
  // 要保存的函数对象的对象部分的备份将放入 functionBackups 中
  const functionBackups = new Map()
  //创建初始还原点，专用于 $reset 方法，相当于最开始就进行了一次 $save ,调用 $reset 即读取这个初始的还原点
  const initialMemory = new Map([['initial', deepClone(config.state, true)]])
  const initialfunctionBackups = new Map()
  backUpFunctions(stateProxy, 'initial', initialfunctionBackups)

  // 为 store 添加还原点相关方法
  store.$save = () => {
    const getId = () => Math.floor(Math.random() * 10000000)
    let id = getId()
    while (memory.has(id)) id = getId()
    backUpFunctions(stateProxy, id, functionBackups)
    const snapshot = deepClone(stateProxy, true)
    memory.set(id, snapshot)
    return id
  },
    store.$load = id => {
      if (memory.has(id)) {
        modifyState(() => {
          stateProxy = createStateProxy(memory.get(id))
          restoreFunctions(stateProxy, id, functionBackups)
        }, '$load', false)
        return true
      } else {
        return false
      }
    },
    store.$delSave = id => {
      if (id === '*') {
        functionBackups.clear()
        return memory.clear()
      }
      deleteBackup(id, functionBackups)
      return memory.delete(id)
    },
    store.$get = id => memory.get(id)

  return storeProxy
}

module.exports = { createStore }