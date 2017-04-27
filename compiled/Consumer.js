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
class Consumer extends events_1.EventEmitter {
    constructor(consumerPolicy, consumerFunction) {
        super();
        this.consumerPolicy = consumerPolicy;
        this.consumerFunction = consumerFunction;
        this.ongoingConsumptions = 0;
        this.isConsuming = false;
        this.debug = debug_1.default('consumer:__no-consumer-tag__');
        this.consumerPolicy.assertQueue = ((v) => {
            return v === undefined ? true : v;
        })(this.consumerPolicy.assertQueue);
        this.assertConsumerPolicy(this.consumerPolicy);
        this.on('consumed', () => this.decreaseCounter());
        this.on('rejected', () => this.decreaseCounter());
    }
    assertConsumerPolicy(policy) {
        // assertQueue set to false, exchange provided but no queue name provided
        if (!policy.assertQueue && policy.exchange && !policy.queue) {
            const message = `You did provide exchange name "${policy.exchange} but not queue name. ` +
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
    /**
     * Sets channel and starts consumption
     *
     * @param channel
     * @returns {Promise}
     */
    setChannel(channel) {
        return __awaiter(this, void 0, void 0, function* () {
            this.channel = channel;
            yield this.startConsumption();
        });
    }
    startConsumption() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.channel) {
                throw new Error('Cannot start consumption without channel');
            }
            if (this.consumerPolicy.assertQueue) {
                this.currentQueueName = yield this.createQueue();
            }
            else {
                this.currentQueueName = this.consumerPolicy.queue;
            }
            if (this.consumerPolicy.exchange) {
                yield this.bindQueueToExchange();
            }
            yield this.startQueueConsumption();
        });
    }
    createQueue() {
        return __awaiter(this, void 0, void 0, function* () {
            const options = Object.assign({}, Consumer.defaultAssertQueueOptions, this.consumerPolicy.assertQueueOptions);
            const result = yield this.channel.assertQueue(this.consumerPolicy.queue || '', options);
            return result.queue;
        });
    }
    startQueueConsumption() {
        return __awaiter(this, void 0, void 0, function* () {
            const options = Object.assign({}, Consumer.defaultConsumerOptions, this.consumerPolicy.consumerOptions, { consumerTag: this.consumerTag });
            let result;
            try {
                result = yield this.channel.consume(this.currentQueueName, (msg) => {
                    if (msg === null) {
                        // ignore - consumer cancelled
                        return;
                    }
                    this.consume(new Message_1.default(msg, this.currentQueueName));
                }, options);
            }
            catch (e) {
                this.debug(`Queue consumption has failed: ${e.message}`);
                throw e;
            }
            this.consumerTag = result.consumerTag;
            this.isConsuming = true;
            this.debug = debug_1.default('consumer:' + this.consumerTag);
            this.debug(`Queue "${this.currentQueueName}" consumption has started`);
        });
    }
    bindQueueToExchange() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.channel.bindQueue(this.currentQueueName, this.consumerPolicy.exchange, this.consumerPolicy.pattern, this.consumerPolicy.bindArgs);
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
                this.debug('Consumer paused');
            }
            catch (e) {
                this.debug(`Consumer failed to pause ${e.message}`);
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
            }
        });
    }
    consume(message) {
        this.incrementCounter();
        let isConsumed = false;
        const ackFn = this.channel.ack.bind(this.channel, message.message);
        const ack = (...args) => {
            if (isConsumed) {
                return;
            }
            this.emit('consumed', message);
            ackFn.apply(this, args);
            isConsumed = true;
        };
        const nackFn = this.channel.nack.bind(this.channel, message.message);
        const reject = (...args) => {
            if (isConsumed) {
                return;
            }
            this.emit('rejected', message);
            nackFn.apply(this, args);
            isConsumed = true;
        };
        try {
            const result = this.consumerFunction(message, ack, reject);
            if (result && 'then' in result) {
                result
                    .then(() => ack(), (error) => {
                    this.emit('consumer-error', error);
                    reject();
                });
            }
        }
        catch (e) {
            this.emit('consumer-error', e);
            reject();
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
Consumer.defaultConsumerOptions = {
    noAck: false
};
Consumer.defaultAssertQueueOptions = {
    durable: true,
    autoDelete: false
};
exports.default = Consumer;
