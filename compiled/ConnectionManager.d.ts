/// <reference types="node" />
import Consumer, { ConsumerFunction, ConsumerPolicy } from './Consumer';
import * as amqp from 'amqplib';
import { EventEmitter } from 'events';
export interface ConnectionManagerOptions {
    /**
     * Options provided to amqp.connect
     */
    connection?: any;
    reconnect?: ReconnectOptions;
}
export interface ReconnectOptions {
    /**
     * Maximum amount of reconnect attempts - default no limit
     */
    failAfter?: number;
    /**
     * "backoff" module strategy - if not provided then "exponential" strategy is used
     *
     * See https://github.com/MathieuTurcotte/node-backoff#interface-backoffstrategy for details
     */
    backoffStrategy?: any;
}
export default class ConnectionManager extends EventEmitter {
    private connectionURL;
    private options;
    consumers: Consumer[];
    connection: amqp.Connection;
    channel: amqp.Channel;
    static defaultConnectionOptions: any;
    static defaultReconnectOptions: ReconnectOptions;
    constructor(connectionURL: string, options?: ConnectionManagerOptions);
    private assertURLCorrectness();
    /**
     * Connects to AMQP broker
     *
     * @returns {Promise<void>}
     */
    connect(): Promise<void>;
    private connectWithBackoff();
    private onChannel(channel);
    /**
     * Stops consumptions for all consumers
     *
     * @returns {Promise}
     */
    stopAllConsumers(): Promise<void>;
    /**
     * Closes connection.
     * If you want to wait for all consumers to finish their task then call {@see stopAllConsumers} before disconnecting.
     *
     * @returns {Promise<void>}
     */
    disconnect(): Promise<void>;
    /**
     * Creates consumer that consumes given queue/exchange based on consumerPolicy.
     *
     * @param consumerPolicy
     * @param consumerFunction
     */
    consume(consumerPolicy: ConsumerPolicy, consumerFunction: ConsumerFunction): Promise<Consumer>;
    private registerConsumer(consumer);
}
