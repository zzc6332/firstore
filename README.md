# firstore

- `firstore` 是一个全局状态管理工具，可用于`小程序`、`Vue`、`React`等
- `firstore` 中的 `state` 每一层都由 `Proxy` 代理，并可以分别对 `state`、`actions`、`getters`进行订阅，一些使用方式参考了 [Pinia](https://github.com/vuejs/pinia)

## 基本用法

### 安装使用

~~~shell
npm install firstore -S
~~~

### Store

- 调用 `createStore` 函数可返回一个 `store` 
  - 接收参数
    1. `storeName`
       - `store` 的名称字符串，用以区分不同 `store`，如果传入已存在的 `storeName`，则会报错
    2. `config`
       - `store` 的初始状态对象
       - 如果 `config` 中存在 `state`、`actions`、 `getters` 对象，则 `createStore` 会读取它们作为初始状态，否则它们会被视为 `{}`

- 通过 `createStore` 创建一个 `store`

  ~~~javascript
  const { createStore } = require('firstore')
  
  const fooStore = createStore('foo',{
      state:{
          // state 中定义状态
          name: 'zzc6332',
          age: 26
      },
      actions:{
          // actions 中定义一些方法，可以是异步操作
          changeName(newName){
              this.name = newName
          }
      },
      getters:{
          // getters 中定义一些计算属性
          introduction: (state) => `我是${state.name}, 今年${state.age}岁。`
      }
  })
  ~~~

### state

- 