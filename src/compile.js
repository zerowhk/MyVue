/** 模板编译器 */
class Compile {
    /**
     * el: 模板
     * vm: Vue实例
     */
    constructor(el, vm) {
        // el 可能是字符串, 也可能是dom元素
        this.el = typeof el === 'string' ? document.querySelector(el) : el;
        // 保存Vue实例
        this.vm = vm;


        if (this.el) {
            // 1.把el中所有的子节点全部放到内存中, fragment
            let fragment = this.node2fragment(this.el);
            // 2.在内存中编译fragment
            this.compile(fragment);
            // 3.把编译好的fragment一次性添加到页面
            this.el.appendChild(fragment);
        }
    }

    /** 核心方法 */

    node2fragment(node) {
        let childNodes = node.childNodes;
        let fragment = document.createDocumentFragment();
        this.toArray(childNodes).forEach(item => {
            fragment.appendChild(item);
        });
        return fragment;
    }

    compile(fragment) {
        let childNodes = fragment.childNodes;
        this.toArray(childNodes).forEach(node => {
            // 1.文本节点
            if (this.isTextNode(node)) {    
                this.compileText(node);
            }
            // 2.元素节点
            if (this.isElementNode(node)) {
                this.compileElement(node);
            }
            // 3.如果当前节点还有子节点，递归编译
            if (node.childNodes && node.childNodes.length > 0) {
                this.compile(node);
            }
        });
    }

    // 编译元素节点
    compileElement(node) {
        // 1.获取元素所有的属性
        let attributes = node.attributes;
        this.toArray(attributes).forEach(attr => {
            let attrName = attr.name;
            // 2.解析vue指令

                // 普通指令
            if (this.isGeneralDirective(attrName)) {
                // 移除指令
                node.removeAttribute(attrName);

                let expr = attr.value;
                let type = attrName.slice(2);
                // v-on
                if (this.isEventDirective(type)) {
                    let eventType = type.split(':')[1];
                    compileUtil.handleEvent(node, this.vm, eventType, expr);
                } else if(this.isBindDirective(type)) {
                    compileUtil.handleBind(node, this.vm, attrName, expr);
                } else{
                    compileUtil[type] && compileUtil[type](node, this.vm, expr);
                }
                // 特殊指令 : @
            } else if(this.isSpecialDirective(attrName)) {
                // 移除指令
                node.removeAttribute(attrName);

                let expr = attr.value;

                if (this.isEventDirective(attrName)) {
                    let eventType = attrName.slice(1);
                    compileUtil.handleEvent(node, this.vm, eventType, expr);
                } else if(this.isBindDirective(attrName)) {
                    compileUtil.handleBind(node, this.vm, attrName, expr);
                }
            }
        });
    }
    // 编译文本节点
    compileText(node) {
        compileUtil.mustache(node, this.vm);
    }


    /** 工具方法 */
    toArray(likeArray) {
        return [].slice.call(likeArray);
    }

    isTextNode(node) {
        return node.nodeType === 3;
    }

    isElementNode(node) {
        return node.nodeType === 1;
    }
    // 普通指令 以v-开头
    isGeneralDirective(attrName) {
        return attrName.startsWith('v-');
    }

    //特殊指令 : @
    isSpecialDirective(attrName) {
        return attrName.startsWith(':') || attrName.startsWith('@');
    }

    isEventDirective(attrName) {
        // v-on
        return attrName.split(':')[0] === 'on' || attrName.startsWith('@');
    }

    isBindDirective(attrName) {
        return attrName.split(':')[0] === 'bind' || attrName.startsWith(':');
    }
}

const compileUtil = {
    mustache(node, vm) {
        let text = node.textContent;
        // 1.解析插值表达式
        let reg = /\{\{(.+?)\}\}/g;
        if (reg.test(text)) {
            // 收集依赖
            let exprs = [];
            // 保存计算属性的初始值
            let originValues = {};
            text.match(reg).forEach(item => {
                let expr = item.replace(/\{|\}/g, '').trim();
                if (!exprs.includes(expr)) {
                    // 创建一个订阅者
                    let wather = new Watcher(vm, expr, () => {
                        update();
                    });
                    // 防止计算属性，表达式二次计算
                    originValues[expr] = wather.oldValue;
                }
            });
            exprs = null;
            // 更新数据
            let update = () => {
                node.textContent = text.replace(reg, (match, expr) => {
                    // 去掉空格
                    expr = expr.trim();
                    // 得到属性值
                    let res =  compileUtil.getVMValue(vm, expr);
                    if (typeof res !== undefined) {
                        return res;
                    } else {
                        // 计算属性
                        return getVmComputedOrExpressionValue(vm, expr);
                    }
                });
            }
            // 获取计算属性或者是表达式的值
            let getVmComputedOrExpressionValue = (vm, expr) => {
                // 计算属性, 有初始值
                if (originValues && originValues[expr]) {
                    // 重写getVmComputedOrExpressionValue
                    getVmComputedOrExpressionValue = (vm, expr) => {
                        let cb = compileUtil.getVmComputed(vm, expr);
                        if (cb) {
                            return cb.call(vm);
                        } else {
                            // 说明是表达式
                            return this.computeExpression(vm.$data, expr);
                        }
                    }
                    return originValues[expr];
                }
            }
            update(originValues);
        }
    },
    text(node, vm, expr) {
        this.replaceContent(vm, expr, (newValue) => {
            node.textContent = newValue;
        });
    },
    html(node, vm, expr) {
        this.replaceContent(vm, expr, (newValue) => {
            node.innerHTML = newValue;
        });
    },
    model(node, vm, expr) {
        let that = this;
        node.value = this.getVMValue(vm, expr);
        // 实现双向数据绑定
        node.addEventListener('input', function () {
            that.setVmValue(vm, expr, this.value);
        })
        // 创建一个订阅者
        new Watcher(vm, expr, newValue => {
            node.value = newValue;
        })
    },
    for(node, vm, expr) {
        let reg = /\(?(\w+),?\s?(\w+)?\)?\s+in\s+(\w+)/;
        let res = reg.exec(expr);
        let varName = res[1], indexName = res[2], loopVar = res[3];
        let index = 0, list = vm.$data[loopVar];
        let var_descriptor = Object.getOwnPropertyDescriptor(vm.$data, varName);
        let index_descriptor = Object.getOwnPropertyDescriptor(vm.$data, varName);

        // 重新定义属性访问，拦截当前变量varName(主要是为了避免data中有重名对象)
        Object.defineProperty(vm.$data, varName, {
            get() {
                return list[index];
            }
        })
        Object.defineProperty(vm.$data, indexName, {
            get() {
                return index;
            }
        })
        while(index < list.length) {
            let cloneNode = node.cloneNode(true);
            cloneNode.removeAttribute('v-for');
            new Compile(cloneNode, vm);
            node.parentNode.appendChild(cloneNode);
            index++;
        }
        // 删除原节点, 防止递归解析
        node.parentNode.removeChild(node);
        // 重置描述器
        var_descriptor && Object.defineProperty(vm.$data, varName, var_descriptor);
        index_descriptor && Object.defineProperty(vm.$data, varName, index_descriptor);
    },
    replaceContent(vm, expr, cb) {
        let res = this.getVMValue(vm, expr);
        if (res !== null) {
            // 创建一个订阅者
            new Watcher(vm, expr, newValue => {
                cb(newValue);
            });
        } else {
            res = this.handleComputedOrExpression(vm, expr, (newValue) => {
                cb(newValue);
            });
        }
        cb(res);
    },
    handleEvent(node, vm, eventType, expr) {
        // 判断事件是否存在
        let fn = vm.$methods && vm.$methods[expr];

        if (eventType && fn) {
            // 注册事件
            node.addEventListener(eventType, fn.bind(vm));
        }
    },
    handleBind(node, vm, type, expr) {
        // 获取绑定的属性 (v-on 和 :
        let bindType = type.slice(type.indexOf(':') + 1);
        // 设置属性的值
        this.replaceContent(vm, expr, newValue => {
            node.setAttribute(bindType, newValue);
        });
    },
    getVMValue(vm, expr) {
        // 兼容v-for对应的数据
        let data = vm.$data;
        try {
            expr.split('.').forEach(key => {
                data = data[key];
            })
            return data;
        } catch {
            return null;
        }    
    },
    setVmValue(vm, expr, value) {
        let data = vm.$data;
        let arr = expr.split('.');
        arr.forEach((key, index) => {
            if (index < arr.length - 1) {
                data = data[key];
            } else {
                data[key] = value;
            }
        })
    },
    getVmComputed(vm, expr) {
        let computed = vm.$computed;
        return computed[expr];
    },
    handleComputedOrExpression(vm, expr, callback) {
        let cb = this.getVmComputed(vm, expr);
        let wather;
        if (cb) {
            wather = new Watcher(vm, expr, () => {
                callback(cb.call(vm));
            });
        } else {
            wather = new Watcher(vm, expr, () => {
                callback(this.computeExpression(vm.$data, expr))
            });
        }
        return wather.oldValue;
    },
    // 创建一个沙箱，用来动态执行表达式
    computeExpression(data, expression) {
        try {
            let code = 'with(sandbox) { return (' + expression + ');}';
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
            return;
        }
    }
}