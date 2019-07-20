/**
 * 观察者, 观察data中所有的数据，进行数据劫持
 */

class Observer {
    constructor(data) {
        this.data = data;
        this.walk(data);
    }

    /**
     * 遍历数据，处理数据响应式
     */
    walk(data, ob) {
        if (!data || typeof data !== 'object') {
            return;
        }
        let __ob__ = ob || {};
        Object.keys(data).forEach(key => {
             // 每一个key都应该有一个发布者
            let dep = new Dep();
            if (ob && ob[key]) {
                // 说明以前有旧的依赖，现在先把它们添加进去
                dep.addDep(ob[key]);
            }
            // 保存对象的发布者
            __ob__[key] = dep;

            let value = data[key];
            this.defineReactive(data, key, value, dep);
            // 如果为对象，递归遍历
            if (typeof value === 'object') {
                // 如果为对象，增加一个自身的依赖
                this.walk(value, Object.assign({},value.__ob__, { __self__: dep }));
            }
        });
        // 保存发布者到该对象上
        Object.defineProperty(data, '__ob__', {
            configurable: true,
            enumerable: false,
            value: __ob__
        });
    }

    /**
     * 数据响应式
     */
    defineReactive(data, key, value, dep) {
        let that = this;
        // 记录上一次的发布者 dep, 防止重复注册比较函数（判断是否要通知订阅者的函数）
        let prevDep;
        // 记录上一轮操作的值,用来判断是否需要通知订阅者
        let prevValue = value;
        Object.defineProperty(data, key, {
            configurable: true,
            enumerable: true,
            get() {
                // 搜集依赖
                Dep.target && dep.addSub(Dep.target);
                return value;
            },
            set(newValue) {
                // 设置的值为对象，重新添加响应式
                if (typeof newValue === 'object') {
                    that.walk(newValue, value.__ob__);
                }

                value = newValue;

                // 防止重复发送通知
                if (prevDep !== dep) {
                    prevDep = dep
                    nextTick(() => {
                        // 值改变了，需要更新
                        if (value !== prevValue) {
                            prevValue = value;
                            dep.notify();
                        }
                        // 清空上一次的发布者，为下一轮事件调用做准备
                        prevDep = void(0);
                    })
                }
            }
        })
    }
    /**
     * 给对象添加响应式属性
     * @param {*} obj 
     * @param {*} key 
     * @param {*} value 
     */
    $set(obj, key, value) {
        // 设置值
        obj[key] = value;
        // 重新添加响应式
        this.walk(obj, obj.__ob__);
        // 通知依赖
        let dep = obj.__ob__.__self__;
        if (dep) {
            dep.notify();
        }
    }
}