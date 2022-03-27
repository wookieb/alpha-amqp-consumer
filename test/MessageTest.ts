import * as amqp from "amqplib";
import * as sinon from "sinon";
import * as faker from 'faker';
import {Message} from "@src/Message";
import {ACKType, RejectType} from "@src/Consumer";

describe('Message', () => {
	const QUEUE_NAME = 'queue-name';
	const amqpMessage: amqp.Message = {
		content: new Buffer('Some buffer content'),
		properties: {} as any,
		fields: {
			deliveryTag: faker.datatype.number(1000),
			redelivered: faker.datatype.boolean(),
			exchange: faker.random.alphaNumeric(20),
			routingKey: faker.random.alphaNumeric(20),
			messageCount: faker.datatype.number(10)
		}
	};
	let message: Message;
	let ack: ACKType;
	let reject: RejectType;

	beforeEach(() => {
		ack = sinon.spy();
		reject = sinon.spy();

		message = new Message(amqpMessage, QUEUE_NAME);
	});

	it('has proper getters', () => {
		expect(message)
			.toMatchObject({
				content: amqpMessage.content,
				headers: amqpMessage.properties.headers,
				exchange: amqpMessage.fields.exchange,
				routingKey: amqpMessage.fields.routingKey,
				fields: amqpMessage.fields,
				properties: amqpMessage.properties
			})
	});
});
