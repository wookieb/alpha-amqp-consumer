import {ConnectionManager} from 'alpha-amqp-connection-manager';
import * as amqp from 'amqplib';
import {debugFn} from "./debugFn";
import {Consumer} from "./Consumer";

const debug = debugFn();

export interface RetryTopology {
	exchange: {
		pre: string,
		post: string
	},
	queue: string
}

export class ConsumerManager {
	consumers: Consumer[] = [];
	channel?: amqp.Channel;
	retryTopology?: RetryTopology;

	constructor(private connectionManager: ConnectionManager, private defaultPrefetch = 10) {
		this.connectionManager.on('channel', this.onChannel.bind(this));
	}

	private async onChannel(channel: amqp.Channel) {
		this.channel = channel;
		await this.channel.prefetch(this.defaultPrefetch);
		for (const consumer of this.consumers) {
			// noinspection JSIgnoredPromiseFromCall
			await consumer.setChannel(this.channel);
		}
	}

	/**
	 * Creates consumer and starts consumption if channel available
	 */
	async consume(consumerFunction: Consumer.Function, options?: Consumer.Options) {
		const consumer = new Consumer(consumerFunction, options);
		if (this.retryTopology) {
			await consumer.setRetryTopology(this.retryTopology);
		}
		if (this.channel) {
			await consumer.setChannel(this.channel);
		}
		this.consumers.push(consumer);
		return consumer;
	}

	/**
	 * Stops all consumers
	 */
	async stopAllConsumers() {
		for (const consumer of this.consumers) {
			if (!consumer.isStopped) {
				await consumer.stop();
			}
		}
	}

	/**
	 * Creates retry topology. This allows consumers to retry message consumption after specified amount of time.
	 *
	 * Make sure you call it BEFORE creating any consumer
	 */
	async setupDelayedRetryTopology(retryTopology: RetryTopology) {
		this.retryTopology = retryTopology;

		const assertTopology = async (channel: amqp.Channel) => {
			debug('Setting up retry topology');
			await channel.assertExchange(retryTopology.exchange.pre, 'topic', {
				durable: true,
				autoDelete: false
			});

			await channel.assertExchange(retryTopology.exchange.post, 'direct', {
				durable: true,
				autoDelete: false
			});

			await channel.assertQueue(retryTopology.queue, {
				durable: true,
				autoDelete: false,
				deadLetterExchange: retryTopology.exchange.post
			});

			await channel.bindQueue(retryTopology.queue, retryTopology.exchange.pre, '*');
			debug('Retry topology setup finished');
		};

		this.connectionManager.on('channel', assertTopology);

		if (this.channel) {
			await assertTopology(this.channel);
		}

		for (const consumer of this.consumers) {
			//noinspection JSIgnoredPromiseFromCall
			consumer.setRetryTopology(retryTopology);
		}
	}

	/**
	 * Connects to AMQP broker and returns instance of ConsumerManager
	 */
	static async connect(url: string, connectionOptions?: ConnectionManager.Options) {
		const connectionManager = new ConnectionManager(url, connectionOptions);
		const manager = new ConsumerManager(connectionManager);
		await connectionManager.connect();
		return manager;
	}
}
