/**
 * API Definition with stripped private variables and methods.
 * It is NOT real declaration file. For real one look at compiled/index.d.ts
 */

/// <reference types="node" />
import * as amqp from 'amqplib';
import {EventEmitter} from "events";

export interface MessageFields {
    readonly consumerTag: string;
    readonly deliveryTag: number;
    readonly redelivered: boolean;
    readonly exchange: string;
    readonly routingKey: string;
}

export class Message {
    readonly message: amqp.Message;
    readonly queue: string;

    constructor(message: amqp.Message, queue: string);

    readonly content: Buffer;
    readonly properties: any;
    readonly headers: any;
    readonly exchange: any;
    readonly routingKey: any;
    readonly fields: MessageFields;
}

export interface ConsumerPolicy {
    /**
     * Options provided to channel.consume
     *
     * Provided options are merged with defaultConsumerOptions
     */
    consumerOptions?: amqp.Options.Consume;
    /**
     * Queue name to consume
     *
     * Required if exchange provided but assertQueue is false
     */
    queue?: string;
    /**
     * Whether queue should be asserted at the beginning
     *
     * Defaults to true
     */
    assertQueue?: boolean;
    /**
     * Options provided to channel.assertQueue
     *
     * Provided options are merged with defaultAssertQueueOptions
     */
    assertQueueOptions?: amqp.Options.AssertQueue;
    /**
     * Exchange name to bind to
     */
    exchange?: string;
    /**
     * Exchange topic|pattern
     */
    pattern?: string;
    /**
     * Bind args provided for binding process
     */
    bindArgs?: any;
}

export type ACKType = (allUpTo?: boolean) => void;
export type RejectType = (allUpTo?: boolean, requeue?: boolean) => void;
export type ConsumerFunction = (m: Message, ack?: ACKType, reject?: RejectType) => void | Promise<any>;

export class Consumer extends EventEmitter {
    ongoingConsumptions: number;
    channel: amqp.Channel;
    consumerTag: string;

    static defaultConsumerOptions: amqp.Options.Consume;
    static defaultAssertQueueOptions: amqp.Options.AssertQueue;

    constructor(consumerPolicy: ConsumerPolicy, consumerFunction: ConsumerFunction);

    /**
     * Returns currently consumed queue name
     *
     * @returns {string}
     */
    readonly queue: string;

    /**
     * Sets channel and starts consumption
     *
     * @param channel
     * @returns {Promise}
     */
    setChannel(channel: amqp.Channel): Promise<void>;

    /**
     * Stops further queue consumption.
     *
     * @returns {Promise<void>}
     */
    stop(): Promise<void>;

    /**
     * Indicates whether consumption is stopped
     *
     * @returns {boolean}
     */
    readonly isStopped: boolean;

    /**
     * Resumes consumption
     *
     * @returns {Promise<void>}
     */
    resume(): Promise<void>;
}


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
export class ConnectionManager extends EventEmitter {
    consumers: Consumer[];

    static defaultConnectionOptions: any;
    static defaultReconnectOptions: ReconnectOptions;

    constructor(connectionURL: string, options?: ConnectionManagerOptions);

    /**
     * Connects to AMQP broker
     *
     * @returns {Promise<void>}
     */
    connect(): Promise<void>;

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
     * @returns {Consumer}
     */
    consume(consumerPolicy: ConsumerPolicy, consumerFunction: ConsumerFunction): Consumer;
}

/**
 * Connects to AMQP server and returns instance of ConnectionManager
 *
 * @param url connection URL to AMQP broker. Should contain "heartbeat" query param.
 * @param [options]
 * @returns {Promise<ConnectionManager>}
 */
export function connect(url: string, options?: ConnectionManagerOptions): Promise<ConnectionManager>;
