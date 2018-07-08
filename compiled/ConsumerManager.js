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
const alpha_amqp_connection_manager_1 = require("alpha-amqp-connection-manager");
const Consumer_1 = require("./Consumer");
const debug_1 = require("./debug");
const debug = debug_1.default();
class ConsumerManager {
    constructor(connectionManager, defaultPrefetch = 5) {
        this.connectionManager = connectionManager;
        this.defaultPrefetch = defaultPrefetch;
        this.consumers = [];
        this.connectionManager.on('channel', this.onChannel.bind(this));
    }
    onChannel(channel) {
        return __awaiter(this, void 0, void 0, function* () {
            this.channel = channel;
            for (const consumer of this.consumers) {
                // noinspection JSIgnoredPromiseFromCall
                yield this.channel.prefetch(this.defaultPrefetch);
                yield consumer.setChannel(this.channel);
            }
        });
    }
    /**
     * Creates consumer and starts consumption if channel available
     */
    consume(consumerFunction, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const consumer = new Consumer_1.default(consumerFunction, options);
            if (this.retryTopology) {
                yield consumer.setRetryTopology(this.retryTopology);
            }
            if (this.channel) {
                yield consumer.setChannel(this.channel);
            }
            this.consumers.push(consumer);
            return consumer;
        });
    }
    /**
     * Stops all consumers
     */
    stopAllConsumers() {
        return __awaiter(this, void 0, void 0, function* () {
            for (const consumer of this.consumers) {
                if (!consumer.isStopped) {
                    yield consumer.stop();
                }
            }
        });
    }
    /**
     * Creates retry topology. This allows consumers to retry message consumption after specified amount of time.
     *
     * Make sure you call it BEFORE creating any consumer
     */
    setupDelayedRetryTopology(retryTopology) {
        return __awaiter(this, void 0, void 0, function* () {
            this.retryTopology = retryTopology;
            const assertTopology = (channel) => __awaiter(this, void 0, void 0, function* () {
                debug('Setting up retry topology');
                yield channel.assertExchange(retryTopology.exchange.pre, 'topic', {
                    durable: true,
                    autoDelete: false
                });
                yield channel.assertExchange(retryTopology.exchange.post, 'direct', {
                    durable: true,
                    autoDelete: false
                });
                yield channel.assertQueue(retryTopology.queue, {
                    durable: true,
                    autoDelete: false,
                    deadLetterExchange: retryTopology.exchange.post
                });
                yield channel.bindQueue(retryTopology.queue, retryTopology.exchange.pre, '*');
                debug('Retry topology setup finished');
            });
            this.connectionManager.on('channel', assertTopology);
            if (this.channel) {
                yield assertTopology(this.channel);
            }
            for (const consumer of this.consumers) {
                //noinspection JSIgnoredPromiseFromCall
                consumer.setRetryTopology(retryTopology);
            }
        });
    }
    /**
     * Connects to AMQP broker and returns instance of ConsumerManager
     *
     * @param url
     * @param connectionOptions
     * @returns {Promise<ConsumerManager>}
     */
    static connect(url, connectionOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            const connectionManager = new alpha_amqp_connection_manager_1.ConnectionManager(url, connectionOptions);
            const manager = new ConsumerManager(connectionManager);
            yield connectionManager.connect();
            return manager;
        });
    }
}
exports.default = ConsumerManager;
