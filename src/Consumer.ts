import Message from './Message';
import debug from './debug';
import * as amqp from '@types/amqplib';
import * as debugModule from 'debug';
import {EventEmitter} from "events";
import {ResultContext, ResultHandler} from "./ResultHandler";
import {RetryTopology} from "./ConsumerManager";

export interface ConsumerOptions {
    /**
     * Options provided to channel.consume
     *
     * Merged with defaultConsumeOptions
     */
    consumeOptions?: amqp.Options.Consume

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
    bindArgs?: any,

    /**
     * Function responsible for acknowledging and rejecting message based on consumer result
     */
    resultHandler?: ResultHandler;
}

export type ACKType = (allUpTo?: boolean) => void;
export type RejectType = (requeue?: boolean, allUpTo?: boolean) => void;
export type ConsumerFunction = (m: Message) => any | Promise<any>;

export default class Consumer extends EventEmitter {

    public ongoingConsumptions = 0;
    public channel: amqp.Channel;
    public consumerTag: string;

    private isConsuming: boolean = false;
    private debug: debugModule.IDebugger;
    private currentQueueName: string;

    private options: ConsumerOptions;

    private retryTopology: RetryTopology;

    static defaultConsumeOptions: amqp.Options.Consume = {
        noAck: false
    };

    static defaultAssertQueueOptions: amqp.Options.AssertQueue = {
        durable: true,
        autoDelete: false
    };

    static defaultResultHandler: ResultHandler = function (context: ResultContext, error?: any, result?: any) {
        if (error) {
            context.reject();
        } else {
            context.ack();
        }
    };

    constructor(private consumerFunction: ConsumerFunction, options?: ConsumerOptions) {
        super();

        this.options = this.mergeOptions(options);
        this.assertConsumerPolicy();

        this.debug = debug('consumer:__no-consumer-tag__');

        this.on('consumed', () => this.decreaseCounter());
        this.on('rejected', () => this.decreaseCounter());
    }

    private mergeOptions(options: ConsumerOptions = {}): ConsumerOptions {
        const defaultValues: Partial<ConsumerOptions> = {
            assertQueue: true,
            resultHandler: Consumer.defaultResultHandler
        };

        const mergedOptions: Partial<ConsumerOptions> = {
            consumeOptions: Object.assign({}, Consumer.defaultConsumeOptions, options.consumeOptions),
            assertQueueOptions: Object.assign({}, Consumer.defaultAssertQueueOptions, options.assertQueueOptions),
        };

        return Object.assign({}, defaultValues, options, mergedOptions);
    }

    private assertConsumerPolicy() {
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
    get queue(): string {
        return this.currentQueueName;
    }

    async setRetryTopology(retryTopology: RetryTopology) {
        this.retryTopology = retryTopology;

        if (this.channel && this.queue) {
            await this.assertRetryTopology();
        }
    }

    private async assertRetryTopology() {
        await this.channel.bindQueue(this.queue, this.retryTopology.exchange.post, this.queue);
    }

    /**
     * Sets channel and starts consumption
     *
     * @param channel
     * @returns {Promise}
     */
    async setChannel(channel: amqp.Channel): Promise<void> {
        this.channel = channel;
        if (this.channel) {
            await this.startConsumption();
        }
    }

    private async startConsumption(): Promise<void> {
        if (this.options.assertQueue) {
            this.currentQueueName = await this.createQueue();
        } else {
            this.currentQueueName = this.options.queue;
        }

        if (this.options.exchange) {
            await this.bindQueueToExchange();
        }

        if (this.retryTopology) {
            await this.assertRetryTopology();
        }
        await this.startQueueConsumption();
    }

    private async createQueue(): Promise<string> {
        const result = await this.channel.assertQueue(this.options.queue || '', this.options.assertQueueOptions);
        return result.queue;
    }

    private async bindQueueToExchange(): Promise<void> {
        await this.channel.bindQueue(
            this.currentQueueName,
            this.options.exchange,
            this.options.pattern,
            this.options.bindArgs
        );
    }

    private async startQueueConsumption(): Promise<void> {
        try {
            const consumeOptions = Object.assign({}, this.options.consumeOptions, {consumerTag: this.consumerTag});
            const result = await this.channel.consume(this.currentQueueName, (msg) => {
                if (msg === null) {
                    // ignore - consumer cancelled
                    return;
                }

                this.consume(new Message(msg, this.currentQueueName));
            }, consumeOptions);

            this.consumerTag = result.consumerTag;
            this.isConsuming = true;
            this.emit('started');
            this.debug = debug('consumer:' + this.consumerTag);
            this.debug(`Queue "${this.currentQueueName}" consumption has started`);
        } catch (e) {
            this.debug(`Queue consumption has failed: ${e.message}`);
            throw e;
        }
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
            this.emit('stopped');
            this.debug('Consumer paused');
        } catch (e) {
            this.debug(`Consumer failed to pause ${e.message}`);
            throw e;
        }
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
            throw e;
        }
    }

    private consume(message: Message) {
        this.incrementCounter();

        const ackFn = this.channel.ack.bind(this.channel, message.message);
        const ack: ACKType = (allUpTo: boolean = false) => {
            ackFn(allUpTo);
            this.emit('consumed', message, allUpTo);
        };

        const nackFn = this.channel.nack.bind(this.channel, message.message);
        const reject: RejectType = (requeue: boolean = true, allUpTo: boolean = false) => {
            nackFn(allUpTo, requeue);
            this.emit('rejected', message, requeue, allUpTo);
        };

        const context = new ResultContext();
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
                result.then(
                    (resolvedValue: any) => resultHandler(context, undefined, resolvedValue),
                    (error: any) => resultHandler(context, error)
                );
            } else {
                resultHandler(context, undefined, result);
            }
        } catch (e) {
            resultHandler(context, e);
        }
    }

    private incrementCounter() {
        this.ongoingConsumptions++;
    }

    private decreaseCounter() {
        this.ongoingConsumptions--;
        if (this.ongoingConsumptions === 0) {
            this.emit('all-consumed');
        }
    }
}
