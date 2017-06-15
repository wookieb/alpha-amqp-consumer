/// <reference types="node" />
import Message from './Message';
import * as amqp from '@types/amqplib';
import { EventEmitter } from "events";
import { ResultHandler } from "./ResultHandler";
import { RetryTopology } from "./ConsumerManager";
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
export declare type ACKType = (allUpTo?: boolean) => void;
export declare type RejectType = (requeue?: boolean, allUpTo?: boolean) => void;
export declare type ConsumerFunction = (m: Message) => any | Promise<any>;
export default class Consumer extends EventEmitter {
    private consumerFunction;
    ongoingConsumptions: number;
    channel: amqp.Channel;
    consumerTag: string;
    private isConsuming;
    private debug;
    private currentQueueName;
    private options;
    private retryTopology;
    static defaultConsumeOptions: amqp.Options.Consume;
    static defaultAssertQueueOptions: amqp.Options.AssertQueue;
    static defaultResultHandler: ResultHandler;
    constructor(consumerFunction: ConsumerFunction, options?: ConsumerOptions);
    private mergeOptions(options?);
    private assertConsumerPolicy();
    /**
     * Returns currently consumed queue name
     *
     * @returns {string}
     */
    readonly queue: string;
    setRetryTopology(retryTopology: RetryTopology): Promise<void>;
    private assertRetryTopology();
    /**
     * Sets channel and starts consumption
     *
     * @param channel
     * @returns {Promise}
     */
    setChannel(channel: amqp.Channel): Promise<void>;
    private startConsumption();
    private createQueue();
    private bindQueueToExchange();
    private startQueueConsumption();
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
    private consume(message);
    private incrementCounter();
    private decreaseCounter();
}
