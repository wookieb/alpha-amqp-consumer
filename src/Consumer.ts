import * as amqp from 'amqplib';
import * as debugModule from 'debug';
import {EventEmitter} from "events";
import {ResultContext, ResultHandler} from "./ResultHandler";
import {RetryTopology} from "./ConsumerManager";
import {Message} from "./Message";
import {debugFn} from "./debugFn";
import * as is from 'predicates'

export type ACKType = (allUpTo?: boolean) => void;
export type RejectType = (requeue?: boolean, allUpTo?: boolean) => void;

export class Consumer extends EventEmitter {
	public ongoingConsumptions = 0;
	public channel?: amqp.Channel;
	public consumerTag?: string;

	private isConsuming: boolean = false;
	private debug: debugModule.IDebugger;
	private currentQueueName?: string;
	private options: Consumer.Options;
	private retryTopology?: RetryTopology;

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

	constructor(private consumerFunction: Consumer.Function, options?: Consumer.Options) {
		super();

		this.options = this.mergeOptions(options);
		this.assertConsumerPolicy();

		this.debug = debugFn('consumer:__no-consumer-tag__');

		this.on('consumed', () => this.decreaseCounter());
		this.on('rejected', () => this.decreaseCounter());
	}

	private mergeOptions(options: Consumer.Options = {}): Consumer.Options {
		const defaultValues: Partial<Consumer.Options> = {
			assertQueue: true,
			resultHandler: Consumer.defaultResultHandler
		};

		const mergedOptions: Partial<Consumer.Options> = {
			consumeOptions: {...Consumer.defaultConsumeOptions, ...(options.consumeOptions || {})},
			assertQueueOptions: {...Consumer.defaultAssertQueueOptions, ...(options.assertQueueOptions || {})},
		};

		return {...defaultValues, ...options, ...mergedOptions};
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
	 */
	get queue() {
		return this.currentQueueName;
	}

	async setRetryTopology(retryTopology: RetryTopology) {
		this.retryTopology = retryTopology;

		if (this.channel && this.queue) {
			await this.assertRetryTopology();
		}
	}

	private async assertRetryTopology() {
		await this.channel!.bindQueue(this.queue!, this.retryTopology!.exchange.post, this.queue!);
	}

	/**
	 * Sets channel and starts consumption
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
			await this.channel!.bindQueue(
				this.currentQueueName!,
				this.options.exchange,
				this.options.pattern!,
				this.options.bindArgs
			);
		}

		if (this.retryTopology) {
			await this.assertRetryTopology();
		}
		await this.startQueueConsumption();
	}

	private async createQueue(): Promise<string> {
		const result = await this.channel!.assertQueue(this.options.queue || '', this.options.assertQueueOptions);
		return result.queue;
	}

	private async startQueueConsumption(): Promise<void> {
		try {
			const consumeOptions = {...this.options.consumeOptions, consumerTag: this.consumerTag};
			const result = await this.channel!.consume(this.currentQueueName!, msg => {
				// eslint-disable-next-line no-null/no-null
				if (msg === null) {
					// ignore - consumer cancelled
					return;
				}

				this.consume(new Message(msg, this.currentQueueName!));
			}, consumeOptions);

			this.consumerTag = result.consumerTag;
			this.isConsuming = true;
			this.emit('started');
			this.debug = debugFn('consumer:' + this.consumerTag);
			this.debug(`Queue "${this.currentQueueName}" consumption has started`);
		} catch (e: any) {
			this.debug(`Queue consumption has failed: ${e.message}`);
			throw e;
		}
	}


	/**
	 * Stops further queue consumption.
	 */
	async stop() {
		if (!this.isConsuming) {
			throw new Error('Consumption is already stopped');
		}

		try {
			await this.channel!.cancel(this.consumerTag!);
			this.isConsuming = false;
			this.emit('stopped');
			this.debug('Consumer paused');
		} catch (e: any) {
			this.debug(`Consumer failed to pause ${e.message}`);
			throw e;
		}
	}

	/**
	 * Indicates whether consumption is stopped
	 */
	get isStopped() {
		return !this.isConsuming;
	}

	/**
	 * Resumes consumption
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
		} catch (e: any) {
			this.debug(`Consumption resume has failed: ${e.message}`);
			throw e;
		}
	}

	private consume(message: Message) {
		this.incrementCounter();

		const ackFn = this.channel!.ack.bind(this.channel, message.message);
		const ack: ACKType = (allUpTo: boolean = false) => {
			ackFn(allUpTo);
			this.emit('consumed', message, allUpTo);
		};

		const nackFn = this.channel!.nack.bind(this.channel, message.message);
		const reject: RejectType = (requeue: boolean = true, allUpTo: boolean = false) => {
			nackFn(allUpTo, requeue);
			this.emit('rejected', message, requeue, allUpTo);
		};

		const context = new ResultContext();
		context.channel = this.channel!;
		context.consumer = this;
		context.retryTopology = this.retryTopology;
		context.message = message;
		context.ack = ack;
		context.reject = reject;

		const resultHandler = this.options.resultHandler;

		try {
			const result = this.consumerFunction(message);

			if (is.promiseLike(result)) {
				result.then(
					(resolvedValue: any) => resultHandler!(context, undefined, resolvedValue),
					(error: any) => resultHandler!(context, error)
				);
			} else {
				resultHandler!(context, undefined, result);
			}
		} catch (e) {
			resultHandler!(context, e);
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

export namespace Consumer {
	export interface Options {
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

	export type Function = (m: Message) => unknown | Promise<unknown>;
}
