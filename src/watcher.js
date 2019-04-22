/**
 * 订阅者
 * 关联Compile对象和Observer对象
 */

class Watcher {
    // vm 当前Vue实例
    // expr 需要监听的对象的属性
    // cb 数据发生变化时的回调函数
    constructor(vm, expr, cb) {
        this.vm = vm;
        this.expr = expr;
        this.cb = cb;
        // 将Dep.target执行this
        Dep.target = this;
        //兼容计算属性
        let value = this.getVMValue(vm, expr);
        if (value !== null) {
            // 保存原来的值
            this.oldValue = value;
        } else {
            // 看是否是计算属性
            cb = this.getVmComputed(vm, expr);
            if (typeof cb === 'function') {
                this.oldValue = cb.call(vm);
                // 看是否是表达式
            } else {
                this.oldValue = utils.computeExpression(vm.$data, expr);
            }
        }
        // 清空Dep.target
        Dep.target = null;
    }
    // 更新数据
    update() {
        let oldValue = this.oldValue;
        let newValue = this.getVMValue(this.vm, this.expr);
        // Set的时候已经判断了是否发生变化, 此处不用重复判断
        // 数据发生了变化
        this.cb(newValue, oldValue);
        // 更新旧值
        this.oldValue = newValue;
    }
    // 获取数据
    getVMValue(vm, expr) {
        let data = vm.$data;
        let oldValue = this.oldValue;
        // 说明是取对象的属性值
        try {
            expr.split('.').forEach(key => {
                // 说明之前不存在这个属性，需要重新添加响应式
                if (oldValue === undefined) {
                    // 重新获取依赖，设置响应式
                    Dep.target = this;
                    data = data[key];
                    Dep.target = null;
                } else {
                    data = data[key];                    
                }
            })
            return data;
        } catch {
            return null;
        } 
    }
    // 获取计算属性
    getVmComputed(vm, expr) {
        let computed = vm.$computed;
        return computed[expr];
    }

}

utils = {
    // 处理表达式
    computeExpression(data, expression) {
        try {
            // 创建一个沙箱，用来动态执行表达式
            let code = 'with(sandbox) { return ' + expression + ';}';
            let fn = new Function('sandbox', code);
            let white_list = ['Date', 'Math'];
            const proxy = new Proxy(data, {
                has(target, key) {
                    if (white_list.includes(key)) {
                        return false;
                    }
                    return true; // 欺骗，告知属性存在
                }
            });
            return fn(proxy); 
        } catch (err) {

        }
    }
}
/**
 * 发布者
 * 用来搜集依赖,当数据有变化时，通知订阅者更新
 */

class Dep {
    constructor() {
        this.subs = [];
    }

    // 添加订阅者
    addSub(watcher) {
        // 判断是否有重复的订阅者，cb一样即为重复
        if (this.subs.every(sub => sub.cb !== watcher.cb)) {
            this.subs.push(watcher);
        }
    }

    // 添加发布者
    addDep(dep) {
        this.subs.push(...dep.subs);
    }

    // 通知所有的订阅者更新
    notify() {
        this.subs.forEach(sub => {
            sub.update();
        })
    }
}