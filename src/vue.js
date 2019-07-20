/* Vue类 */
class Vue {
    /**
     * el: 模板
     * data: 数据
     */
    constructor(options = {}) {
        this.$el = options.el;
        this.$data = options.data;
        this.$methods = options.methods;
        this.$computed = options.computed;
        this.$watch = options.watch;
        this.$nextTick = nextTick;
        //数据劫持
        this.$observer = new Observer(this.$data);

        // 监听watch
        this.watch();

        // 将data代理到Vue实例上
        this.proxy(this.$data);
        // 将methods代理到Vue实例上
        this.proxy(this.$methods);
        // 将computed代理到Vue实例上
        this.proxy(this.$computed);
        
        if(this.$el) {
            // 编译模板
           let compile = new Compile(this.$el, this);
        }
    }
    watch() {
        let watch = this.$watch;
        Object.keys(watch).forEach(key => {
            let cb = watch[key];
            // 判断是否是函数
            if (typeof cb === 'function') {
                new Watcher(this, key, cb);
            } else if(typeof cb === 'object'){
               this.object2Watch(key, cb);
            }
        });
    }
    // 提供给watch的是一个对象
    object2Watch(key, cb) {
        let vm = this;
        // 获取里面的handler方法
        if (cb.handler) {
            new Watcher(vm, key, cb.handler);
            // immediate 是否为true, 先执行一次
            if (cb.immediate) {
                cb.handler(vm.$data[key]);
            }

            // 是否深度监听
            if (cb.deep && typeof vm.$data[key] === 'object') {
                let obj = vm.$data[key];
                let expr = key;
                // 给对象所有的属性添加监听
                const add = (obj) => {
                    Object.keys(obj).forEach(attr => {
                        // 更新expr
                        expr = expr + '.' + attr;
                        // 拼接key
                        if (typeof obj[attr] === 'object') {
                            new Watcher(vm, expr, cb.handler);
                            add(obj[attr]);
                        } else {
                            new Watcher(vm, expr, cb.handler);
                        }
                        // 重置expr
                        expr = key;
                    })
                }
                add(obj);
            }
        }
    }
    proxy(data) {
        Object.keys(data).forEach(key => {
            Object.defineProperty(this, key, {
                configurable: true,
                enumerable: true,
                get () {
                    return data[key];
                },
                set (newValue) {
                    data[key] = newValue;
                }
            })
        });
    }

    $set(obj, key, value) {
        this.$observer.$set(obj, key, value);
    }
}

Vue.nextTick = nextTick;