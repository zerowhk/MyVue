const nextTick = (() => {
    let callbacks = [];
    let pending;
    let timeFunc;

    // 执行callback回调的函数
    const execCallback = () => {
        pending = false;
        callbacks.forEach(cb => cb());
        callbacks.length = 0;
    }

    // 有Promise
    if (typeof Promise !== 'undefined') {
        let p = Promise.resolve();

        timeFunc = () => {
            p.then(execCallback);
        }
    } else {
        timeFunc = () => {
            // 没有promise，用setTimeout代替
            setTimeout(execCallback, 0);
        }
    }

    return (cb, ctx) => {
        let _resolve;

        callbacks.push(() => {
            if (cb) {
                cb.call(ctx);
            } else if (_resolve) {
                _resolve(ctx);
            }
        });
        if (!pending) {
            pending = true;
            // 执行timeFunc，注册回调执行函数
            timeFunc();
        }
        if (!cb && typeof Promise !== 'undefined') {
            return new Promise((resolve, reject) => {
                _resolve = resolve;
            })
        }
    }
})();

