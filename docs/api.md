```typescript
/**
 * API Definition with stripped private variables and methods.
 * It is NOT real declaration file. For real one look at compiled/index.d.ts
 */

declare module 'alpha-amqp-consumer/Message' {
	/// <reference types="node" />
	import * as amqp from '@types/amqplib';
	export interface MessageFields {
	    readonly consumerTag: string;
	    readonly deliveryTag: number;
	    readonly redelivered: boolean;
	    readonly exchange: string;
	    readonly routingKey: string;
	}
	export default class Message {
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

}
declare module 'alpha-amqp-consumer/debug' {
	/// <reference types="debug" />
	import * as debug from 'debug';
	export default function (suffix?: string): debug.IDebugger;

}
declare module 'alpha-amqp-consumer/ConsumerManager' {
	import { ConnectionManager, ConnectionManagerOptions } from 'alpha-amqp-connection-manager';
	import Consumer, { ConsumerFunction, ConsumerOptions } from 'alpha-amqp-consumer/Consumer';
	export interface RetryTopology {
	    exchange: {
	        pre: string;
	        post: string;
	    };
	    queue: string;
	}
	export default class ConsumerManager {
	    consumers: Consumer[];
	    constructor(connectionManager: ConnectionManager);
	    /**
	     * Creates consumer and starts consumption if channel available
	     */
	    consume(consumerFunction: ConsumerFunction, options?: ConsumerOptions): Promise<Consumer>;
	    /**
	     * Stops all consumers
	     */
	    stopAllConsumers(): Promise<void>;
	    /**
	     * Creates retry topology. This allows consumers to retry message consumption after specified amount of time.
	     *
	     * Make sure you call it BEFORE creating any consumer
	     */
	    setupDelayedRetryTopology(retryTopology: RetryTopology): Promise<void>;
	    /**
	     * Connects to AMQP broker and returns instance of ConsumerManager
	     *
	     * @param url
	     * @param connectionOptions
	     * @returns {Promise<ConsumerManager>}
	     */
	    static connect(url: string, connectionOptions?: ConnectionManagerOptions): Promise<ConsumerManager>;
	}

}
declare module 'alpha-amqp-consumer/ResultHandler' {
	import Message from 'alpha-amqp-consumer/Message';
	import * as amqp from '@types/amqplib';
	import { ACKType, default as Consumer, RejectType } from 'alpha-amqp-consumer/Consumer';
	import { RetryTopology } from 'alpha-amqp-consumer/ConsumerManager';
	export class ResultContext {
	    message: Message;
	    channel: amqp.Channel;
	    consumer: Consumer;
	    ack: ACKType;
	    reject: RejectType;
	    retryTopology: RetryTopology;
	    retry(delay: number): void;
	}
	export type ResultHandler = (context: ResultContext, error: any, result?: any) => void;

}
declare module 'alpha-amqp-consumer/Consumer' {
	/// <reference types="node" />
	import Message from 'alpha-amqp-consumer/Message';
	import * as amqp from '@types/amqplib';
	import { EventEmitter } from "events";
	import { ResultHandler } from 'alpha-amqp-consumer/ResultHandler';
	import { RetryTopology } from 'alpha-amqp-consumer/ConsumerManager';
	export interface ConsumerOptions {
	    /**
	     * Options provided to channel.consume
	     *
	     * Merged with defaultConsumeOptions
	     */
	    consumeOptions?: amqp.Options.Consume;
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
	     * Merged with defaultAssertQueueOptions
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
	    /**
	     * Function responsible for acknowledging and rejecting message based on consumer result
	     */
	    resultHandler?: ResultHandler;
	}
	export type ACKType = (allUpTo?: boolean) => void;
	export type RejectType = (requeue?: boolean, allUpTo?: boolean) => void;
	export type ConsumerFunction = (m: Message) => any | Promise<any>;
	export default class Consumer extends EventEmitter {
	    ongoingConsumptions: number;
	    channel: amqp.Channel;
	    consumerTag: string;
	    static defaultConsumeOptions: amqp.Options.Consume;
	    static defaultAssertQueueOptions: amqp.Options.AssertQueue;
	    static defaultResultHandler: ResultHandler;
	    constructor(consumerFunction: ConsumerFunction, options?: ConsumerOptions);
	    /**
	     * Returns currently consumed queue name
	     *
	     * @returns {string}
	     */
	    readonly queue: string;
	    setRetryTopology(retryTopology: RetryTopology): Promise<void>;
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

}
declare module 'alpha-amqp-consumer/index' {
	export { default as Message } from 'alpha-amqp-consumer/Message';
	export { default as Consumer, ConsumerOptions, ConsumerFunction, ACKType, RejectType } from 'alpha-amqp-consumer/Consumer';
	import { ConnectionManagerOptions } from 'alpha-amqp-connection-manager';
	import ConsumerManager from 'alpha-amqp-consumer/ConsumerManager';
	export function connect(url: string, options?: ConnectionManagerOptions): Promise<ConsumerManager>;

}
```