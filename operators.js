/**
 * @param {EventTarget} target
 * @param {string} eventName
 * @returns {ReadableStream}
 */
const fromEvent = (target, eventName) => {
    let _listener;
    const readable = new ReadableStream({
        start(controller) {
            _listener = (e) => controller.enqueue(e)
            target.addEventListener(eventName, _listener)
        },
        cancel() {
            target.removeEventListener(eventName, _listener)
        }
    })

    return readable
}

/**
 * @typedef {function(): ReadableStream | TransformStream} StreamFunction
 *
 * @param {StreamFunction} fn
 * @param {object} options
 * @param {boolean} options.pairwise
 * set default pairwise to true
 * @returns {TransformStream}
 */
const switchMap = (fn, options = { pairwise: true }) => {
    return new TransformStream({
        transform(chunk, controller) {
            const stream = fn(chunk)
            // can be a readable or a TransformStream.readable
            const reader = (stream.readable || stream).getReader()

            return (async function read() {
                const { value, done } = await reader.read()
                if (done) return

                const result = options.pairwise ? [chunk, value] : value
                controller.enqueue(result)

                return read()
            })()
        },
    })
}

/**
 * @param {ReadableStream | TransformStream} stream
 * @returns {TransformStream}
 */
const takeUntil = (stream) => {
    const readAndTerminate = async (stream, controller) => {
        const reader = (stream.readable || stream).getReader()
        const { value } = await reader.read()

        controller.enqueue(value)
        controller.terminate()
    }

    return new TransformStream({
        start(controller) {
            readAndTerminate(stream, controller)
        },
        transform(chunk, controller) {
            controller.enqueue(chunk)
        },
    })
}

/**
 * @param {Number} ms
 * @returns {TransformStream}
 */
const interval = (ms) => {
    let intervalId
    return new TransformStream({
        start(controller) {
            intervalId = setInterval(
                () =>
                    controller.enqueue(Date.now()),
                ms
            )
        },
        cancel() {
            clearInterval(intervalId)
        }
    })
}

/**
 * @param {Function} fn
 * @returns {TransformStream}
 */
const map = (fn) => {
    return new TransformStream({
        transform(chunk, controller) {
            controller.enqueue(fn.bind(fn)(chunk))
        }
    })
}

/**
 * @typedef {ReadableStream | TransformStream} Stream
 * @param {Stream[]} streams
 * @returns {ReadableStream}
 */
const race = (streams) => {
    return new ReadableStream({
        start(controller) {
            for (const stream of streams) {
                const reader = (stream.readable || stream).getReader()

                    ; (async function read() {
                        const { value, done } = await reader.read()
                        if (done) return
                        // stream is done
                        if (!controller.desiredSize) return
                        controller.enqueue(value)

                        return read()
                    })()
            }
        }
    })
}

export {
    fromEvent,
    interval,
    map,
    race,
    switchMap,
    takeUntil,
}