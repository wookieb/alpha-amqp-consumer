import Message from "../Message";
import * as amqp from "amqplib";
import * as sinon from "sinon";
import * as faker from 'faker';
import {assert} from "chai";

describe('Message', () => {
    const QUEUE_NAME = 'queue-name';
    const amqpMessage: amqp.Message = {
        content: new Buffer('Some buffer content'),
        properties: <any>{},
        fields: {
            deliveryTag: faker.random.number(1000),
            redelivered: faker.random.boolean(),
            exchange: faker.random.alphaNumeric(20),
            routingKey: faker.random.alphaNumeric(20),
            messageCount: faker.random.number(10)
        }
    };
    let message: Message;
    let ack;
    let reject;

    beforeEach(() => {
        ack = sinon.spy();
        reject = sinon.spy();

        message = new Message(amqpMessage, QUEUE_NAME);
    });

    it('has proper getters', () => {
        assert.strictEqual(message.content, amqpMessage.content);
        assert.strictEqual(message.headers, amqpMessage.properties.headers);
        assert.strictEqual(message.exchange, amqpMessage.fields.exchange);
        assert.strictEqual(message.routingKey, amqpMessage.fields.routingKey);
        assert.strictEqual(message.fields, amqpMessage.fields);
        assert.strictEqual(message.properties, amqpMessage.properties);
    });
});