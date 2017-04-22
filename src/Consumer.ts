import Message from './Message';
import debug from './debug';
import * as amqp from 'amqplib';
import * as debugModule from 'debug';
import {EventEmitter} from "events";

export interface ConsumerPolicy {
    /**
     * Options provided to channel.consume
     *
     * Provided options are merged with defaultConsumerOptions
     */
    consumerOptions?: amqp.Options.Consume
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
    bindArgs?: any
}

export type ACKType = (allUpTo?: boolean) => void;
export type RejectType = (allUpTo?: boolean, requeue?: boolean) => void;
export type ConsumerFunction = (m: Message, ack?: ACKType, reject?: RejectType) => void | Promise<void>;

export default class Consumer extends EventEmitter {

    public ongoingConsumptions = 0;
    public channel: amqp.Channel;
    public consumerTag: string;

    private isConsuming: boolean = false;
    private debug: debugModule.IDebugger;
    private currentQueueName: string;

    static defaultConsumerOptions: amqp.Options.Consume = {
        noAck: false
    };

    static defaultAssertQueueOptions: amqp.Options.AssertQueue = {
        exclusive: true,
        autoDelete: true
    };

    constructor(private consumerPolicy: ConsumerPolicy, private consumerFunction: ConsumerFunction) {
        super();

        this.debug = debug('stream:__no-consumer-tag__');

        this.consumerPolicy.assertQueue = ((v) => {
            return v === undefined ? true : v;
        })(this.consumerPolicy.assertQueue);

        this.assertConsumerPolicy(this.consumerPolicy);

        this.on('consumed', () => this.decreaseCounter());
        this.on('rejected', () => this.decreaseCounter());
    }

    private assertConsumerPolicy(policy: ConsumerPolicy) {
        // assertQueue set to false, exchange provided but no queue name provided
        if (!policy.assertQueue && policy.exchange && !policy.queue) {
            const message = `You did provide exchange name "${policy.exchange} but not queue name. ` +
                `In that case assertQueue options MUST be set to true`;
            throw new Error(message);
        }
    }

    get queue(): string {
        return this.currentQueueName;
    }

    /**
     * Sets channel and starts consumption if stream is paused
     *
     * @param {amqp.Channel} channel
     * @returns {Promise}
     */
    async setChannel(channel: amqp.Channel): Promise<void> {
        this.channel = channel;
        await this.startConsumption();
    }

    private async startConsumption(): Promise<void> {
        if (!this.channel) {
            throw new Error('Cannot start consumption without channel');
        }

        if (this.consumerPolicy.assertQueue) {
            this.currentQueueName = await this.createQueue();
        } else {
            this.currentQueueName = this.consumerPolicy.queue;
        }

        if (this.consumerPolicy.exchange) {
            await this.bindQueueToExchange();
        }

        await this.startQueueConsumption();
    }

    private async createQueue(): Promise<string> {
        const options = Object.assign({}, Consumer.defaultAssertQueueOptions, this.consumerPolicy.assertQueueOptions);
        const result = await this.channel.assertQueue(this.consumerPolicy.queue || '', options);
        return result.queue;
    }

    private async startQueueConsumption(): Promise<void> {

        const options = Object.assign(
            {},
            Consumer.defaultConsumerOptions,
            this.consumerPolicy.consumerOptions,
            <amqp.Options.Consume>{consumerTag: this.consumerTag}
        );

        try {
            var result = await this.channel.consume(this.currentQueueName, (msg) => {
                if (msg === null) {
                    // ignore - consumer cancelled
                    return;
                }

                this.consume(new Message(msg, this.currentQueueName));
            }, options);
        } catch (e) {
            this.debug(`Queue consumption has failed: ${e.message}`);
            throw e;
        }

        this.consumerTag = result.consumerTag;
        this.isConsuming = true;
        this.debug = debug('stream:' + this.consumerTag);
        this.debug(`Queue "${this.currentQueueName}" consumption has started`);
    }

    private async bindQueueToExchange(): Promise<void> {
        await this.channel.bindQueue(
            this.currentQueueName,
            this.consumerPolicy.exchange,
            this.consumerPolicy.pattern,
            this.consumerPolicy.bindArgs
        );
    }

    /**
     * Stops further queue consumption.
     *
     * @returns {Promise<void>}
     */
    async stop() {
        if (!this.isConsuming) {
            throw new Error('Consumption is already stopped');
        }

        try {
            await this.channel.cancel(this.consumerTag);
            this.isConsuming = false;
            this.debug('Stream paused');
        } catch (e) {
            this.debug(`Stream failed to pause ${e.message}`);
        }
    }

    /**
     *
     * @returns {boolean}
     */
    get isStopped() {
        return !this.isConsuming;
    }

    /**
     * @returns {Promise<void>}
     */
    async resume() {
        if (this.isConsuming) {
            throw new Error('Consumption is already resumed')
        }

        if (!this.channel) {
            throw new Error('Cannot resume consumption without channel open');
        }

        try {
            await this.startConsumption();
            this.debug('Consumption resumed');
        } catch (e) {
            this.debug(`Consumption resume has failed: ${e.message}`);
        }
    }

    private consume(message: Message) {
        this.incrementCounter();

        let isConsumed = false;
        const ack = () => {
            if (isConsumed) {
                return;
            }
            const args = Array.prototype.slice.call(arguments);
            this.emit('consumed', message);
            this.channel.ack.apply(this.channel, [message.message].concat(args));
            isConsumed = true;
        };

        const reject = () => {
            if (isConsumed) {
                return;
            }
            const args = Array.prototype.slice.call(arguments);
            this.emit('rejected', message);
            this.channel.nack.apply(this.channel, [message.message].concat(args));
            isConsumed = true;
        };

        try {
            const result = this.consumerFunction(message, ack, reject);

            if (result && 'then' in <any>result) {
                (<Promise<any>>result)
                    .then(
                        () => ack(),
                        (error: any) => {
                            this.emit('error', error);
                            reject();
                        }
                    );
            }
        } catch (e) {
            this.emit('error', e);
            reject();
        }
    }

    private incrementCounter() {
        this.ongoingConsumptions++;
    }

    private decreaseCounter() {
        this.ongoingConsumptions--;
        if (this.ongoingConsumptions < 0) {
            this.ongoingConsumptions = 0;
        }

        if (this.ongoingConsumptions) {
            this.emit('all-consumed');
        }
    }
}
