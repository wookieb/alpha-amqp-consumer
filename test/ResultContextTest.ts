import * as amqp from 'amqplib';
import * as sinon from 'sinon';
import * as faker from 'faker';
import {FakeChannel} from "./FakeChannel";
import {Consumer} from "@src/Consumer";
import {ResultContext} from "@src/ResultHandler";
import {Message} from "@src/Message";

describe('ResultContext', () => {

	let channel: sinon.SinonStubbedInstance<amqp.Channel>;
	let consumer: sinon.SinonStubbedInstance<Consumer>;
	let context: ResultContext;
	let message: Message;

	const QUEUE = faker.random.alphaNumeric(20);

	beforeEach(() => {
		channel = sinon.createStubInstance(FakeChannel) as unknown as sinon.SinonStubbedInstance<amqp.Channel>;
		consumer = sinon.createStubInstance(Consumer);

		sinon.stub(consumer, 'queue').get(() => QUEUE);

		message = new Message({
			properties: {} as any,
			fields: {
				deliveryTag: faker.datatype.number(1000),
				redelivered: faker.datatype.boolean(),
				exchange: faker.random.alphaNumeric(20),
				routingKey: faker.random.alphaNumeric(20),
				messageCount: faker.datatype.number(10)
			},
			content: new Buffer('some-content')
		}, QUEUE);


		context = new ResultContext();
		context.message = message;
		context.channel = channel;
		context.consumer = consumer as unknown as Consumer;
		context.retryTopology = {
			exchange: {pre: 'pre', post: 'post'},
			queue: 'retry'
		};
		context.ack = sinon.spy();
		context.reject = sinon.spy();
	});

	describe('retry', () => {
		it('cannot be used without retry topology', () => {
			context.retryTopology = undefined;
			expect(() => {
				context.retry(100)
			})
				.toThrowError(/You must set "retryTopology" before using retry/)
		});

		it('delay cannot be 0 or less', () => {
			expect(() => {
				context.retry(0);
			}).toThrowError(/must be greater than 0/)
		});

		it('success path', () => {
			const DELAY = 1000;
			context.retry(DELAY);

			sinon.assert.calledWith(
				channel.publish,
				context.retryTopology!.exchange.pre,
				consumer.queue!,
				message.content,
				{...message.properties, expiration: DELAY}
			);
		});
	})
});
