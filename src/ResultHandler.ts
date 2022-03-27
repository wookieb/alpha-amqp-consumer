import * as amqp from 'amqplib';
import * as assert from 'assert';
import {RetryTopology} from "./ConsumerManager";
import {ACKType, Consumer, RejectType} from "./Consumer";
import {Message} from "./Message";

export class ResultContext {
	message!: Message;
	channel!: amqp.Channel;
	consumer!: Consumer;
	ack!: ACKType;
	reject!: RejectType;

	retryTopology: RetryTopology | undefined;

	retry(delay: number) {
		assert.ok(this.retryTopology, 'You must set "retryTopology" before using retry');
		assert.ok(delay > 0, 'Delay must be greater than 0');

		this.channel.publish(
			this.retryTopology.exchange.pre,
			this.consumer.queue!,
			this.message.content,
			{...this.message.properties, expiration: delay}
		);

		this.reject(false);
	}
}

export type ResultHandler = (context: ResultContext, error: unknown, result?: unknown) => void;
