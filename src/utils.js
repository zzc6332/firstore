/*
  判断是否为对象类型的函数
*/
function isObject(item) {
  return Object(item) === item
}
/*
  判断具体类型的函数
 */
function typeOf(item) {
  return Object.prototype.toString.call(item).slice(8, -1)
}
/*
  判断两个数据是否内容相等
*/
function isEqual(item1, item2) {
  if (!isObject(item1) && !isObject(item2)) {
    // 两个都是基本类型，直接进行严格比较
    if (Number.isNaN(item1) && Number.isNaN(item2)) {
      // 特判
      return true
    }
    return item1 === item2
  }
  if (!isObject(item1) || !isObject(item2)) {
    // 一个对象，一个基本类型，直接返回 false
    return false
  }
  if (typeOf(item1) !== typeOf(item2)) {
    // 类型不同，直接返回 false
    return false
  }
  // 后面比较的都是类型相同的对象类型
  if (item1 === item2) {
    // 直接比较引用地址，相等则返回 true
    return true
  }
  if (['Array', 'Object'].includes(typeOf(item1))) {
    //  plain object 和 array，for ... in 比较每一项值
    let l1 = Object.keys(item1).length
    let l2 = Object.keys(item2).length
    if (l1 !== l2) {
      return false
    }
    for (let k in item1) {
      if (!isEqual(item1[k], item2[k])) {
        return false
      }
    }
    return true
  }
  if (['Map', 'Set'].includes(typeOf(item1))) {
    // 处理 map、set 类型，转换为数组再比较
    const [arr1, arr2] = [[...item1], [...item2]]
    return isEqual(arr1, arr2)
  }
  return false
}

/*
  深拷贝函数
*/
const deepClone = (target) => {
  if (isObject(target)) {
    // 是对象或数组的情况
    let newTarget = Array.isArray(target) ? [] : {}
    for (let key in target) {
      newTarget[key] = deepClone(target[key])
    }
    return newTarget
  } else {
    return target
  }
}

module.exports = { isObject, typeOf, isEqual, deepClone }
