"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const Message_1 = require("./Message");
const debug_1 = require("./debug");
const events_1 = require("events");
const ResultHandler_1 = require("./ResultHandler");
class Consumer extends events_1.EventEmitter {
    constructor(consumerFunction, options) {
        super();
        this.consumerFunction = consumerFunction;
        this.ongoingConsumptions = 0;
        this.isConsuming = false;
        this.options = this.mergeOptions(options);
        this.assertConsumerPolicy();
        this.debug = debug_1.default('consumer:__no-consumer-tag__');
        this.on('consumed', () => this.decreaseCounter());
        this.on('rejected', () => this.decreaseCounter());
    }
    mergeOptions(options = {}) {
        const defaultValues = {
            assertQueue: true,
            resultHandler: Consumer.defaultResultHandler
        };
        const mergedOptions = {
            consumeOptions: Object.assign({}, Consumer.defaultConsumeOptions, options.consumeOptions),
            assertQueueOptions: Object.assign({}, Consumer.defaultAssertQueueOptions, options.assertQueueOptions),
        };
        return Object.assign({}, defaultValues, options, mergedOptions);
    }
    assertConsumerPolicy() {
        // assertQueue set to false, exchange provided but no queue name provided
        if (!this.options.assertQueue && this.options.exchange && !this.options.queue) {
            const message = `You did provide exchange name "${this.options.exchange}" but not queue name. ` +
                `In that case assertQueue options MUST be set to true`;
            throw new Error(message);
        }
    }
    /**
     * Returns currently consumed queue name
     *
     * @returns {string}
     */
    get queue() {
        return this.currentQueueName;
    }
    setRetryTopology(retryTopology) {
        return __awaiter(this, void 0, void 0, function* () {
            this.retryTopology = retryTopology;
            if (this.channel && this.queue) {
                yield this.assertRetryTopology();
            }
        });
    }
    assertRetryTopology() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.channel.bindQueue(this.queue, this.retryTopology.exchange.post, this.queue);
        });
    }
    /**
     * Sets channel and starts consumption
     *
     * @param channel
     * @returns {Promise}
     */
    setChannel(channel) {
        return __awaiter(this, void 0, void 0, function* () {
            this.channel = channel;
            if (this.channel) {
                yield this.startConsumption();
            }
        });
    }
    startConsumption() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.options.assertQueue) {
                this.currentQueueName = yield this.createQueue();
            }
            else {
                this.currentQueueName = this.options.queue;
            }
            if (this.options.exchange) {
                yield this.bindQueueToExchange();
            }
            if (this.retryTopology) {
                yield this.assertRetryTopology();
            }
            yield this.startQueueConsumption();
        });
    }
    createQueue() {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.channel.assertQueue(this.options.queue || '', this.options.assertQueueOptions);
            return result.queue;
        });
    }
    bindQueueToExchange() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.channel.bindQueue(this.currentQueueName, this.options.exchange, this.options.pattern, this.options.bindArgs);
        });
    }
    startQueueConsumption() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const consumeOptions = Object.assign({}, this.options.consumeOptions, { consumerTag: this.consumerTag });
                const result = yield this.channel.consume(this.currentQueueName, (msg) => {
                    if (msg === null) {
                        // ignore - consumer cancelled
                        return;
                    }
                    this.consume(new Message_1.default(msg, this.currentQueueName));
                }, consumeOptions);
                this.consumerTag = result.consumerTag;
                this.isConsuming = true;
                this.emit('started');
                this.debug = debug_1.default('consumer:' + this.consumerTag);
                this.debug(`Queue "${this.currentQueueName}" consumption has started`);
            }
            catch (e) {
                this.debug(`Queue consumption has failed: ${e.message}`);
                throw e;
            }
        });
    }
    /**
     * Stops further queue consumption.
     *
     * @returns {Promise<void>}
     */
    stop() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isConsuming) {
                throw new Error('Consumption is already stopped');
            }
            try {
                yield this.channel.cancel(this.consumerTag);
                this.isConsuming = false;
                this.emit('stopped');
                this.debug('Consumer paused');
            }
            catch (e) {
                this.debug(`Consumer failed to pause ${e.message}`);
                throw e;
            }
        });
    }
    /**
     * Indicates whether consumption is stopped
     *
     * @returns {boolean}
     */
    get isStopped() {
        return !this.isConsuming;
    }
    /**
     * Resumes consumption
     *
     * @returns {Promise<void>}
     */
    resume() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isConsuming) {
                throw new Error('Consumption is already resumed');
            }
            if (!this.channel) {
                throw new Error('Cannot resume consumption without channel open');
            }
            try {
                yield this.startConsumption();
                this.debug('Consumption resumed');
            }
            catch (e) {
                this.debug(`Consumption resume has failed: ${e.message}`);
                throw e;
            }
        });
    }
    consume(message) {
        this.incrementCounter();
        const ackFn = this.channel.ack.bind(this.channel, message.message);
        const ack = (allUpTo = false) => {
            ackFn(allUpTo);
            this.emit('consumed', message, allUpTo);
        };
        const nackFn = this.channel.nack.bind(this.channel, message.message);
        const reject = (requeue = true, allUpTo = false) => {
            nackFn(allUpTo, requeue);
            this.emit('rejected', message, requeue, allUpTo);
        };
        const context = new ResultHandler_1.ResultContext();
        context.channel = this.channel;
        context.consumer = this;
        context.retryTopology = this.retryTopology;
        context.message = message;
        context.ack = ack;
        context.reject = reject;
        const resultHandler = this.options.resultHandler;
        try {
            const result = this.consumerFunction(message);
            if (result instanceof Object && 'then' in result) {
                result.then((resolvedValue) => resultHandler(context, undefined, resolvedValue), (error) => resultHandler(context, error));
            }
            else {
                resultHandler(context, undefined, result);
            }
        }
        catch (e) {
            resultHandler(context, e);
        }
    }
    incrementCounter() {
        this.ongoingConsumptions++;
    }
    decreaseCounter() {
        this.ongoingConsumptions--;
        if (this.ongoingConsumptions === 0) {
            this.emit('all-consumed');
        }
    }
}
Consumer.defaultConsumeOptions = {
    noAck: false
};
Consumer.defaultAssertQueueOptions = {
    durable: true,
    autoDelete: false
};
Consumer.defaultResultHandler = function (context, error, result) {
    if (error) {
        context.reject();
    }
    else {
        context.ack();
    }
};
exports.default = Consumer;
