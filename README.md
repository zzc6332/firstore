# firstore

- `firstore` 是一个全局状态管理工具，可用于`小程序`、`Vue`、`React`等。
- `firstore` 中的 `state` 每一层都由 `Proxy` 代理，并可以分别对 `state`、`actions`、`getters`进行订阅，一些使用方式参考了 [Pinia](https://github.com/vuejs/pinia)。

## 基本使用

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
  fooStore.age--
  console.log(fooStore.age) // 25
  ~~~

- 通过 `store` 实例的 `$patch` 方法可批量修改 `state` 中的内容：

  ~~~javascript
  const fooStore = require('./fooStore')
  
  fooStore.$patch({ name: 'Joie', age: 25 })
  console.log(fooStore.state) // { name: 'Joie', age: 25, isAdmin: true }
  ~~~

#### 替换 state

- 通过 `store` 实例的 `$set` 方法可替换整个 `state`：

  ~~~javascript
  const fooStore = require('./fooStore')
  
  fooStore.$set({ name: 'Joie', age: 25 })
  console.log(fooStore.state) // { name: 'Joie', age: 25 }
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

- `actions` 中定义与当前 `store` 相关的业务逻辑，在创建 `store` 时定义

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

- `getters` 中定义一些计算属性，在创建 `store` 时定义

#### 定义 getters

- `getter` 必须定义为函数；
- `getter` 接收 `state` 作为第一个参数；
- `getter` 需要将计算的结果作为返回值；
- 如果将一个 `getter` 定义为非箭头函数，则其中的 `this` 指向其所属的 `store` 实例。

#### 读取 getters

- 当读取一个 `getter` 时，会得到该 `getter` 定义函数的返回值；

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
    console.log(introduction) // 我是zzc6332, 今年26岁。
    console.log(fooStore.introduction) // 我是zzc6332, 今年27岁。
    ~~~

## 订阅

#### 订阅 state

- 可通过 `store` 实例的 `$onState` 方法订阅 `state` 的变化。

- `$onState` 方法：

  - 接收参数：

    1. `identifier`

       - 需要订阅的数据的标识符；
       - 例如需订阅 `store.personList`，则传入 `'personList'`;
       - 例如需订阅 `store.personList[0].name`，则传入 `'personList[0].name'`；
       - 如需订阅 `state` 中所有的数据，则传入 `'*'`，此时每一次试图修改 `state` 的操作，若引起了数据变化，都会触发且每次仅触发一次 `callback`（不论此次操作改变了多少项数据）；
       - 如果需要批量订阅，则传入需要批量订阅的数据的标识符组成的数组：
         - 例如需要批量订阅 `store.name` 和 `store.age`，则传入 `[ 'name', 'age' ]`；
         - 数组中也可包括 `'*'` 。

    2. `callback`

       - 订阅的数据发生变化时触发的回调函数；

       - 定义参数：

         1. `mutation`

            - 一个对象，包含所订阅的数据变化的信息，包括：

              - `storeName`

                - 该订阅所属的 `store` 的名称。

              - `type`

                - 造成此次数据变化的方式，值为以下之一：
                  - `'direct'` 通过 `store` 实例直接操作数据；
                  - `'$patch'` 通过 `$patch` 方法改变数据；
                  - `'$set'` 通过 `$set` 方法改变数据；
                  - `'$reset'` 通过 `$reset` 方法改变数据。

              - `byAction`**（实验性）**

                - 如果此次数据变化不是由 `action` 的调用造成，则该值为 `false`；

                - 如果此次数据变化由一个 `action` 的调用造成，则该值为该 `action` 名的字符串；

                - 如果此次数据变化由多个 `action` 的调用造成。则改制为这些 `action` 名的字符串所组成的数组。

                - 注意：

                  - 默认情况下，如果一个 `action` 调用时启动了一个异步任务，且该异步任务造成了订阅的数据的变化，该 `action` 不会被 `byAction` 捕获；

                  - 如果订阅的数据的变化存在于 `action` 中异步调用的回调函数中，则可将该回调函数传入 `this.$cb()` 中同步调用，`this.$cb(callback)`将返回一个新的回调函数供异步调用，此时该 `action` 可以被 `byAction` 捕获；

                  - 例：

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
                      console.log('byAction: ' + mutation.byAction)
                    })
                    
                    fooStore.changeNameAsync('Joie', 1000) 
                    // 1000ms后控制台输出：'byAction: changeNameAsync'
                    ~~~

              - `chain`

                - 订阅的目标的标识符，即 `$onState` 方法中传入的第一个参数 `identifier` （如果是批量订阅，则返回 `identifier` 数组中对应的标识符）；
                - 如果订阅的标识符是 `'*'`，则 `mutation` 对象中不包含此项。

              - `value`

                - 订阅的目标变化后的值；
                - 如果订阅的标识符是 `'*'`，则 `mutation` 对象中不包含此项。

              - `preValue`

                - 订阅的目标变化前的值；
                - 如果订阅的标识符是 `'*'`，则 `mutation` 对象中不包含此项。

         2. `preState`

            - 订阅的目标变化前的 `state` 对象的快照。

    3. `isImmediately`

       - 是否在发起订阅时立即调用一次 `callBack`；
       - 默认为 `false`。

    4. `deep`

       - 是否深度订阅；
       - 默认为 `true`；
       - 如果开启了深度订阅，则对于引用数据类型，只关注其结构和内容是否变化，不关注其引用地址是否改变；
       - 如果关闭了深度订阅，则对于引用数据类型，则只关注其引用地址是否改变，不关注其结构和内容是否变化，这种模式下如果调用了 `store` 实例的 `$patch`、`$set`、`$reset` 方法，任何订阅的数据都会被认为发生了变化。

  - 返回值：

    - `$onState` 方法调用成功后会返回一个新的函数；

    - 调用该函数则可以关闭该次 `$onState` 调用产生的所有订阅，若关闭成功则该函数返回 `true`；

    - 例：

      ~~~javascript
      const fooStore = require('./fooStore')
      
      const unSubscribe = fooStore.$onState(['name', 'age'], (mutation) => {
        const { chain, value, preValue } = mutation
        console.log(`${chain} 产生了变化，之前的值为 ${preValue}，新的值为 ${value}`)
      })
      
      fooStore.name = 'Joie'
      // 控制台输出：'name 产生了变化，之前的值为 zzc6332，新的值为 Joie'
      
      fooStore.age = 25
      // 控制台输出：'age 产生了变化，之前的值为 26，新的值为 25'
      
      console.log(unSubscribe()) // 关闭订阅成功，控制台输出：true
      
      console.log(unSubscribe()) // 订阅已被关闭，控制台输出：false
      
      fooStore.name = 'Mocha' // 订阅已被关闭，控制台不输出内容
      fooStore.age = 1 // // 订阅已被关闭，控制台不输出内容
      ~~~

      