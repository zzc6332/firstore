# firstore

- `firstore` 是一个全局状态管理工具，可用于`小程序`、`Vue`、`React` 等。
- `firstore` 中的 `state` 每一层都由 `Proxy` 代理，可以分别对 `state`、`actions`、`getters` 进行监听，并可以为 `state` 创建还原点，一些使用方式参考了 [Pinia](https://github.com/vuejs/pinia)。

## 使用说明

### 安装

~~~shell
npm install firstore -S
~~~

### Store 

- 调用 `createStore` 函数可返回一个 `store` 实例。
  - 接收参数：
    1. `storeName`
       - `store` 的名称字符串，用以区分不同 `store`，如果传入已存在的 `storeName`，则会报错。
    2. `config`
       - `store` 的初始状态对象；
       - 如果 `config` 中存在 `state`、`actions`、 `getters` 对象，则 `createStore` 会读取它们作为初始状态，否则它们会被视为 `{}`。

- 通过 `createStore` 创建一个 `store`：

  ~~~javascript
  // fooStore.js
  
  const { createStore } = require('firstore')
  
  const fooStore = createStore('foo',{
      state:{
          // state 中定义状态
          name: 'zzc6332',
          age: 26,
          isAdmin: true
      },
      actions:{
          // actions 中定义一些方法，可以是异步操作
          changeName(name){
              this.name = name
          }
      }, 
      getters:{
          // getters 中定义一些计算属性
          introduction: (state) => `我是${state.name}, 今年${state.age}岁。`
      }
  })
  
  module.exports = fooStore
  ~~~

### state

- `state` 中保存 `store` 的状态，在创建 `store` 时定义初始 `state` ，并可以通过多种方式修改。

#### 读取 state

- 通过 `store` 实例可直接读取 `state` 中的内容：

  ~~~javascript
  const fooStore = require('./fooStore')
  
  console.log(fooStore.name) // 'zzc6332'
  console.log(fooStore.age) // 26
  ~~~

- 通过 `store` 实例的 `state` 属性可读取整个 `state`：

  ~~~javascript
  const fooStore = require('./fooStore')
  
  console.log(fooStore.state) // { name: 'zzc6332', age: 26, isAdmin: true }
  ~~~

#### 修改 state

- 通过 `store` 实例可直接修改 `state` 中的内容：

  ~~~javascript
  const fooStore = require('./fooStore')
  
  fooStore.name = 'Joie'
  console.log(fooStore.name) // 'Joie'
  fooStore.age -= 8
  console.log(fooStore.age) // 18
  ~~~

- 通过 `store` 实例的 `$patch` 方法可批量修改 `state` 中的内容：

  ~~~javascript
  const fooStore = require('./fooStore')
  
  fooStore.$patch({ name: 'Joie', age: 18 })
  console.log(fooStore.state) // { name: 'Joie', age: 18, isAdmin: true }
  ~~~

#### 替换 state

- 通过 `store` 实例的 `$set` 方法可替换整个 `state`：

  ~~~javascript
  const fooStore = require('./fooStore')
  
  fooStore.$set({ name: 'Joie', age: 18 })
  console.log(fooStore.state) // { name: 'Joie', age: 18 }
  ~~~

#### 重置 state

- 通过 `store` 实例的 `$reset` 方法可重置整个 `state` 至初始状态：

  ~~~javascript
  const fooStore = require('./fooStore')
  
  delete fooStore.name
  fooStore.name2 = 'Joie'
  console.log(fooStore.state) // { age: 26, isAdmin: true, name2: 'Joie' }
  fooStore.$reset()
  console.log(fooStore.state) // { name: 'zzc6332', age: 26, isAdmin: true }
  ~~~

  

### actions

- `actions` 中定义与当前 `store` 相关的业务逻辑。

#### 定义 actions

- `action` 必须定义为函数；
- 如果将一个 `action` 定义为非箭头函数，则其中的 `this` 指向其所属的 `store` 实例。

#### 使用 actions

- 通过 `store` 实例可直接调用 `actions` 中的函数：

  ~~~javascript
  const fooStore = require('./fooStore')
  
  fooStore.changeName('Joie')
  console.log(fooStore.name) // 'Joie'
  ~~~

### getters

- `getters` 中定义一些计算属性。

#### 定义 getters

- `getter` 必须定义为函数；
- `getter` 接收 `state` 作为第一个参数；
- `getter` 需要将计算的结果作为返回值；
- 如果将一个 `getter` 定义为非箭头函数，则其中的 `this` 指向其所属的 `store` 实例。

#### 读取 getters

- 当读取一个 `getter` 时，会得到该 `getter` 函数执行的返回值；

- 通过 `store` 实例可直接读取 `getters` 中的计算属性：

  ~~~javascript
  const fooStore = require('./fooStore')
  
  console.log(fooStore.introduction) // '我是zzc6332, 今年26岁。'
  ~~~

- 注意：

  - 如果通过解构赋值的方式将 `getters` 中的计算属性取出，则取出的为当前的计算值，当依赖发生改变时不会再重新计算：

    ~~~javascript
    const fooStore = require('./fooStore')
    
    const { introduction } = fooStore
    fooStore.age++
    console.log(introduction) // '我是zzc6332, 今年26岁。'
    console.log(fooStore.introduction) // '我是zzc6332, 今年27岁。'
    ~~~

### 监听

#### 监听 state

- 可通过 `store` 实例的 `$onState` 方法监听 `state` 的变化。

- 接收参数：

  1. `identifier`

     - 需要监听的数据的标识符；
     - 例如需监听 `store.personList`，则传入 `'personList'`;
     - 例如需监听 `store.personList[0].name`，则传入 `'personList[0].name'`；
     - 如需监听整个 `state`，则传入 `'*'`，此时每一次试图修改 `state` 的操作，若引起了数据变化，都会触发且每次仅触发一次 `callback`（不论此次操作改变了多少项数据）；
     - 如果需要批量监听，则传入需要批量监听的数据的标识符组成的数组：
       - 例如需要批量监听 `store.name` 和 `store.age`，则传入 `[ 'name', 'age' ]`；
       - 数组中也可包括 `'*'` 。

  2. `callback`

     - 监听的数据发生变化时执行的回调函数；

     - 定义参数：

       - `mutation` 形参会接收一个对象，包含所监听的 `getter` 返回值变化的信息，包括：

         - `storeName`

           - 该监听所属的 `store` 的名称。

         - `chain`

           - 监听的目标的标识符，即 `$onState` 方法中传入的第一个参数 `identifier` （如果是批量监听，则返回 `identifier` 数组中对应的标识符）；
           - 如果监听的标识符是 `'*'`，则 `mutation` 对象中不包含此项。
       
         - `value`

           - 监听的目标变化后的值；
           - 如果监听的标识符是 `'*'`，则 `mutation` 对象中不包含此项。
       
         - `preValue`

           - 监听的目标变化前的值；
           - 如果监听的标识符是 `'*'`，则 `mutation` 对象中不包含此项；
           - 注意：
             - `deep` 模式下，如果监听的数据是一个函数对象，且它的对象属性被改变了，则 `preValue` 是它作为对象的快照；
             - 如果是监听的函数的引用地址改变了，则 `preValue` 是之前的函数本身。
       
         - `preState`

           - 监听的目标变化前的 `state` 对象的快照；
           - 注意：
             - 如果 `state` 中存在函数对象，则其在 `preState` 中将只保留对象部分的快照。
         
         - `type`
         
           - 造成此次数据变化的方式，值为以下之一：
             - `'direct'` 通过 `store` 实例直接操作数据；
             - `'$patch'` 通过 `$patch` 方法改变数据；
             - `'$set'` 通过 `$set` 方法改变数据；
             - `'$reset'` 通过 `$reset` 方法改变数据；
             - `'$load'` 通过 `$load` 方法还原数据。

         - `byAction`**（实验性）**

           - 参与本次数据变化的 `action`：

             - 如果此次数据变化不是由 `action` 的调用造成，则该值为 `false`；
             - 如果此次数据变化由 `action` 的调用造成，则该值为一个包含了参与此次数据变化的 `action` 的描述对象的数组，描述对象的 `storeName` 属性表示该 `action` 所属的 `store` 的名称，`actionName` 属性表示该 `action` 的名称；
         
           - 异步 `action` 的捕获：
         
             - 默认情况下，如果一个 `action` 调用时启动了一个异步任务，且该异步任务造成了监听的数据的变化，该 `action` 不会被 `byAction` 捕获；
         
             - 如果监听的数据的变化存在于 `action` 中异步调用的回调函数中，则可将该回调函数传入 `this.$cb()` 在 `action` 中同步调用，`this.$cb(callback)`将返回一个新的回调函数供异步调用，此时该 `action` 可以被 `byAction` 捕获：
         
               ~~~javascript
               const { createStore } = require('firstore')
               
               const fooStore = createStore('foo', {
                 state: {
                   name: 'zzc6332',
                 },
                 actions: {
                   changeNameAsync(name, delay) {
                     const callback = this.$cb(() => { this.name = name })
                     setTimeout(callback, delay)
                     /*
                       setTimeout(this.$cb(() => { this.name = name }), delay) 
                       // 这种方式不可行，this.$cb必须在 action 中被同步调用
                     */
                   }
                 }
               })
               
               fooStore.$onState('name', (mutation) => {
                 console.log('name: ' + mutation.value + ', byAction: ' + JSON.stringify(mutation.byAction))
               })
               
               fooStore.changeNameAsync('Joie', 1000) 
               // 1000ms后控制台输出：
               // - 'name: Joie, byAction: [{"storeName":"foo","actionName":"changeNameAsync"}]'
               ~~~
         
             - 如果需要在使用 `async/await` 时被 `byAction` 捕获，可将需要在 `await` 之后修改数据的操作放入函数中传给 `this.$cb` 在 `action` 中同步调用，将返回的函数在 `await` 之后使用：
       
               ~~~javascript
               const { createStore } = require('firstore')
               
               const fooStore = createStore('foo', {
                 state: {
                   name: 'zzc6332',
                 },
                 actions: {
                   async changeNameAsync(promise1, promise2) {
                     const modify = this.$cb(res => { this.name = res })
                     const res1 = await promise1
                     console.log('获取 rest1 之后的操作')
                     modify(res1)
                     const rest2 = await promise2
                     console.log('获取 rest2 之后的操作')
                     modify(rest2)
                   }
                 }
               })
               
               fooStore.$onState('name', (mutation) => {
                 console.log('name: ' + mutation.value + ', byAction: ' + mutation.byAction)
               })
               
               const promiseJoie = new Promise((resolve) => {
                 setTimeout(() => {
                   resolve('Joie')
                 }, 1000)
               })
               
               const promiseMocha = new Promise((resolve) => {
                 setTimeout(() => {
                   resolve('Mocha')
                 }, 500)
               })
               
               fooStore.changeNameAsync(promiseJoie, promiseMocha)
               // 1000ms后控制台输出：
               // - '获取 rest1 之后的操作'
               // - 'name: Joie, byAction: [{"storeName":"foo","actionName":"changeNameAsync"}]'
               // - '获取 rest2 之后的操作'
               // - 'name: Mocha, byAction: [{"storeName":"foo","actionName":"changeNameAsync"}]'
               ~~~
         
           - 如果一个 `action` 返回了一个 `promise`，且该 `promise` 在其调用的 `then` 方法的回调中（不支持在被 `await` 时被捕获），或在 `action` 监听函数的 `after/onError` 函数的回调中修改了监听的数据，则该 `action` 会被 `byAction` 捕获：
         
             ~~~javascript
             const { createStore } = require('firstore')
             
             const fooStore = createStore('foo', {
               state: {
                 name: 'zzc6332',
               },
               actions: {
                 changeName(name) {
                   this.name = name
                 },
                 getNamePromise(name, delay) {
                   return new Promise(resolve => {
                     setTimeout(() => resolve(name), delay)
                   })
                 }
               }
             })
             
             fooStore.$onState('name', (mutation) => {
               console.log('name: ' + mutation.value + ', byAction: ' + JSON.stringify(mutation.byAction))
             })
             
             fooStore.$onAction('getNamePromise', (_, after) => {
               after((res, _this) => {
                 _this.changeName(res)
               })
             })
             
             fooStore.getNamePromise('Joie', 1000)
             // 1000ms后控制台输出：
             // - 'name: Joie, byAction: [{"storeName":"foo","actionName":"getNamePromise"},{"storeName":"foo","actionName":"changeName"}]'
             ~~~

  3. `isImmediately`

     - 是否在发起监听时立即调用一次 `callback`；
     - 默认为 `false`。

  4. `deep`

     - 是否深度监听；
     - 默认为 `true`；
     - 如果开启了深度监听，则对于引用数据类型，只关注其结构和内容是否变化，不关注其引用地址是否改变；
     - 如果关闭了深度监听，则对于引用数据类型，则只关注其引用地址是否改变，不关注其结构和内容是否变化，这种模式下如果调用了 `store` 实例的 `$patch`、`$set`、`$reset`、`$load` 方法，任何监听的数据都会被认为发生了变化。

- 返回值：

  - `$onState` 方法调用成功后会返回一个新的函数；

  - 调用该函数则可以关闭该次 `$onState` 调用产生的所有监听，若关闭成功则该函数返回 `true`；

  - 例：

    ~~~javascript
    const fooStore = require('./fooStore')
    
    const unSubscribe = fooStore.$onState(['name', 'age'], (mutation) => {
      const { chain, value, preValue } = mutation
      console.log(`${chain} 产生了变化，之前的值为 ${preValue}，新的值为 ${value}`)
    })
    
    fooStore.name = 'Joie'
    // 控制台输出：'name 产生了变化，之前的值为 zzc6332，新的值为 Joie'
    
    fooStore.age = 18
    // 控制台输出：'age 产生了变化，之前的值为 26，新的值为 18'
    
    console.log(unSubscribe()) // 关闭监听成功，控制台输出：true
    
    console.log(unSubscribe()) // 监听已被关闭，控制台输出：false
    
    fooStore.name = 'Mocha' // 监听已被关闭，控制台不输出内容
    fooStore.age = 1 // // 监听已被关闭，控制台不输出内容
    ~~~

#### 监听 action

- 可通过 `store` 实例的 `$onAction` 方法监听 `action` 的调用。
- 接收参数：

  1. `actionName`

     - 需要监听的 `action` 名的字符串；
     - 如果需要批量监听，则传入需要批量监听的 `action` 名的字符串组成的数组；
     - 如果需要监听所有 `action`，则传入 `'*'`。
  2. `callback`

     - 监听的 `action` 被调用时执行的回调函数；
     - 定义参数：
     
       1. `info`
     
          - 一个对象，包含所监听的 `action` 调用的信息，包括：
     
            - `name` 
     
              - 监听的 `action` 名的字符串。
          - `storeName`
            
            - 该监听所属的 `store` 的名称。
            - `args`
     
              - 该次 `action` 被调用时传入的参数。
          - `preState`
              - 该次 `action` 执行前的 `state` 对象的快照；
            - 注意：
                - 如果 `state` 中存在函数对象，则其在 `preState` 中将只保留对象部分的快照。
     2. `after`
          - 一个函数，调用时将一个回调函数作为参数传入；
          - 如果 `action` 的返回值是一个非 `Promise` 值：
            - 该值将作为第一个参数 `result` 传入该回调函数；
            - 该次 `action` 被调用并执行完毕后会执行这个回调函数；
        - 如果 `action` 的返回值是一个 `Promise` 值：
            - 当 `Promise` 的状态转变为 `fulfilled` 时，其结果(`the fulfillment value`)将作为第一个参数 `result` 传入该回调函数并执行；
            - 当 `Promise` 的状态转变为 `rejected` 时，该回调函数不会执行；
          - 回调函数的第二个形参接收 `store` 实例；
        - 如果回调函数是非箭头函数，那么它的 `this` 指向 `store` 实例。
       3. `onError`
        - 一个函数，调用时将一个回调函数作为参数传入；
          - 如果 `action` 执行时抛出错误，则会被 `onError` 捕获并作为 第一个参数 `error` 传入该回调函数并执行；
          - 如果 `action` 执行完毕，返回值是一个 `Promise` 值：
            - 当 `Promise` 的状态转变为 `rejected` 时，其结果(`rejection reason`)将作为第一个参数 `error` 传入该回调函数并执行；
            - 当 `Promise` 的状态转变为 `fulfilled` 时，该回调函数不会执行；
          - 回调函数的第二个形参接收 `store` 实例；
        - 如果回调函数是非箭头函数，那么它的 `this` 指向 `store` 实例。
- 返回值：

  - `$onAction` 方法调用成功后会返回一个新的函数；
  - 调用该函数则可以关闭该次 `$onAction` 调用产生的所有监听，若关闭成功则该函数返回 `true`；

#### 监听 getter

- 可通过 `store` 实例的 `$onGetter` 方法监听 `getter` 返回值的变化。
- 接收参数
  1. `getterName`
     - 需要监听的 `getter` 名的字符串；
     - 如果需要批量监听，则传入需要批量监听的 `getter` 名的字符串组成的数组。
  2. `callback`
     - 监听的 `getter` 返回值发生变化时执行的回调函数；
     - 定义参数：
       - `mutation` 形参会接收一个对象，包含所监听的 `getter` 返回值变化的信息，包括：
         - `storeName`
           - 该监听所属的 `store` 的名称。
         - `name`
           - 监听的 `getter` 名的字符串。
         - `value`
           - 监听的 `getter` 返回值变化后的值。
         - `preValue`
           - 监听的 `getter` 返回值变化前的值。
         - `preState`
           - 监听的 `getter` 返回值发生变化前的 `state` 对象的快照；
           - 注意：
             - 如果 `state` 中存在函数对象，则其在 `preState` 中将只保留对象部分的快照。
         - `type`
           - 本次 `getter` 返回值变化时，其依赖的数据变化的方式，同 `$onState` 。
         - `byAction`**（实验性）**
           - 参与本次数据变化的 `action` ，同 `$onState`。
  3. `isImmediately`
     - 是否在发起监听时立即调用一次 `callBack`；
     - 默认为 `false`。
- 返回值
  - `$onGetter` 方法调用成功后会返回一个新的函数；
  - 调用该函数则可以关闭该次 `$onState` 调用产生的所有监听，若关闭成功则该函数返回 `true`；

#### 清空监听

- 可通过 `store` 实例的 `$clearListeners` 方法清空监听。
- `$clearListeners` 方法接收一个参数，可选值为：
  - `'state'`
    - 清空所有 `$onState` 产生的监听；
  - `'actions'`
    - 清空所有 `$onAction` 产生的监听；
  - `'getters'`
    - 清空所有 `$onGetter` 产生的监听；
  - `'*'`
    - 清空所有类型的监听。

### 还原点

- `state` 中的数据可以保存到还原点中，并可以随时通过还原点查看或恢复数据。

- 通过 `store` 实例中的一些方法可以实现还原点功能：

  - `$save`
    - `$save` 方法执行后，会将当前 `state` 保存到一个还原点中，并返回该还原点的 `id`。
  - `$get`
    - 将一个还原点 `id` 传入 `$get` 方法执行后，将返回该对应原点中的 `state` 对象；
    - 如果传入的 `id` 对应的还原点不存在，则返回 `undefined`。
  - `$load`
    - 将一个还原点 `id` 传入 `$load` 方法执行后，会将对应还原点中的 `state` 加载到当前 `store` 实例中，并返回 `true`；
    - 如果传入的 `id` 对应的还原点不存在，则返回 `false`。
  - `$delSave`
    - 将一个还原点 `id` 传入 `$delSave` 方法执行后，将删除对应的还原点，如果删除成功则返回 `true`，如果找不到对应还原点则返回 `false`；
    - 将 `'*'` 传入 `$delSave` 方法执行后，将清空所有还原点。

- 示例：

  ~~~javascript
  const fooStore = require('./fooStore')
  
  fooStore.$set({ name: 'Joie', age: 18 })
  const rp1 = fooStore.$save()
  console.log(fooStore.state) // { name: 'Joie', age: 18 }
  
  fooStore.$patch({ name: 'Mocha', age: 1 })
  console.log(fooStore.state) // { name: 'Mocha', age: 1 }
  
  console.log(fooStore.$get(rp1).name) // 'Joie'
  fooStore.$load(rp1)
  console.log(fooStore.state) // { name: 'Joie', age: 18 }
  
  fooStore.$delSave(rp1)
  ~~~
