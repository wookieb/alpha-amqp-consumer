/// <reference types="node" />
import Message from './Message';
import * as amqp from 'amqplib';
import { EventEmitter } from "events";
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
export declare type ACKType = (allUpTo?: boolean) => void;
export declare type RejectType = (allUpTo?: boolean, requeue?: boolean) => void;
export declare type ConsumerFunction = (m: Message, ack?: ACKType, reject?: RejectType) => void | Promise<any>;
export default class Consumer extends EventEmitter {
    private consumerPolicy;
    private consumerFunction;
    ongoingConsumptions: number;
    channel: amqp.Channel;
    consumerTag: string;
    private isConsuming;
    private debug;
    private currentQueueName;
    static defaultConsumerOptions: amqp.Options.Consume;
    static defaultAssertQueueOptions: amqp.Options.AssertQueue;
    constructor(consumerPolicy: ConsumerPolicy, consumerFunction: ConsumerFunction);
    private assertConsumerPolicy(policy);
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
    private startConsumption();
    private createQueue();
    private startQueueConsumption();
    private bindQueueToExchange();
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
