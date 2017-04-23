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
const Consumer_1 = require("./Consumer");
const amqp = require("amqplib");
const debug_1 = require("./debug");
const events_1 = require("events");
const url = require("url");
const backoff = require('backoff');
const debug = debug_1.default('connection-manager');
class ConnectionManager extends events_1.EventEmitter {
    constructor(connectionURL, options) {
        super();
        this.connectionURL = connectionURL;
        this.options = options;
        this.consumers = [];
        this.options = this.options || {};
        this.assertURLCorrectness();
    }
    assertURLCorrectness() {
        const parts = url.parse(this.connectionURL, true);
        const heartbeat = parseInt(parts.query.heartbeat, 10);
        if (isNaN(heartbeat) || heartbeat < 1) {
            console.warn(`"heartbeat" options is missing in your connection URL. This might lead to unexpected connection loss.`);
        }
    }
    /**
     * Connects to AMQP broker
     *
     * @returns {Promise<void>}
     */
    connect() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.connectWithBackoff();
                this.connection.on('close', (err) => {
                    if (err) {
                        debug('Disconnected - reconnect attempt');
                        //noinspection JSIgnoredPromiseFromCall
                        this.connect();
                    }
                    else {
                        debug('Disconnected');
                    }
                });
            }
            catch (e) {
                debug(`Failed to connect: ${e.message}`);
                this.emit('error', e);
            }
        });
    }
    connectWithBackoff() {
        const connectionOptions = Object.assign({}, ConnectionManager.defaultConnectionOptions, this.options.connection);
        return new Promise((resolve, reject) => {
            const call = backoff.call((url, options, cb) => __awaiter(this, void 0, void 0, function* () {
                this.emit('retry', call.getNumRetries());
                debug('Connecting to queue ... ' + (call.getNumRetries() ? '- Retry #' + call.getNumRetries() : ''));
                try {
                    this.connection = yield amqp.connect(url, options);
                    debug('Connected');
                    this.emit('connected', this.connection);
                    cb(null, yield this.connection.createChannel());
                }
                catch (e) {
                    debug('Connection failed: ' + e.message);
                    cb(e);
                }
            }), this.connectionURL, connectionOptions, (err, channel) => {
                if (err) {
                    reject(err);
                    return;
                }
                this.onChannel(channel);
                resolve();
            });
            const reconnectOptions = Object.assign({}, ConnectionManager.defaultReconnectOptions, this.options.reconnect);
            call.failAfter(reconnectOptions.failAfter);
            call.setStrategy(reconnectOptions.backoffStrategy);
            call.start();
        });
    }
    onChannel(channel) {
        this.channel = channel;
        debug('New channel created');
        this.emit('channel', channel);
        return Promise.all(this.consumers.map((s) => s.setChannel(channel)));
    }
    /**
     * Stops consumptions for all consumers
     *
     * @returns {Promise}
     */
    stopAllConsumers() {
        return __awaiter(this, void 0, void 0, function* () {
            yield Promise.all(this.consumers.map((consumer) => {
                debug(`Stopping consumption for queue ${consumer.queue}...`);
                return consumer.stop();
            }));
        });
    }
    /**
     * Closes connection.
     * If you want to wait for all consumers to finish their task then call {@see stopAllConsumers} before disconnecting.
     *
     * @returns {Promise<void>}
     */
    disconnect() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.connection) {
                yield this.connection.close();
            }
        });
    }
    /**
     * Creates consumer that consumes given queue/exchange based on consumerPolicy.
     *
     * @param consumerPolicy
     * @param consumerFunction
     * @returns {Consumer}
     */
    consume(consumerPolicy, consumerFunction) {
        return this.registerConsumer(new Consumer_1.default(consumerPolicy, consumerFunction));
    }
    registerConsumer(consumer) {
        if (this.channel) {
            //noinspection JSIgnoredPromiseFromCall
            consumer.setChannel(this.channel);
        }
        this.consumers.push(consumer);
        this.emit('consumer', consumer);
        return consumer;
    }
}
ConnectionManager.defaultConnectionOptions = {};
ConnectionManager.defaultReconnectOptions = {
    backoffStrategy: new backoff.ExponentialStrategy({
        initialDelay: 1000,
        maxDelay: 30000,
        randomisationFactor: Math.random()
    }),
    failAfter: 0
};
exports.default = ConnectionManager;
