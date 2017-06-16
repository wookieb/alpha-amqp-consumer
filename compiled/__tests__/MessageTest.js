"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Message_1 = require("../Message");
const sinon = require("sinon");
const faker = require("faker");
const chai_1 = require("chai");
describe('Message', () => {
    const QUEUE_NAME = 'queue-name';
    const amqpMessage = {
        content: new Buffer('Some buffer content'),
        properties: {
            some: faker.random.alphaNumeric(30),
            headers: {
                header: faker.random.alphaNumeric(30)
            }
        },
        fields: {
            consumerTag: faker.random.alphaNumeric(20),
            deliveryTag: faker.random.number(1000),
            redelivered: faker.random.boolean(),
            exchange: faker.random.alphaNumeric(20),
            routingKey: faker.random.alphaNumeric(20)
        }
    };
    let message;
    let ack;
    let reject;
    beforeEach(() => {
        ack = sinon.spy();
        reject = sinon.spy();
        message = new Message_1.default(amqpMessage, QUEUE_NAME);
    });
    it('has proper getters', () => {
        chai_1.assert.strictEqual(message.content, amqpMessage.content);
        chai_1.assert.strictEqual(message.headers, amqpMessage.properties.headers);
        chai_1.assert.strictEqual(message.exchange, amqpMessage.fields.exchange);
        chai_1.assert.strictEqual(message.routingKey, amqpMessage.fields.routingKey);
        chai_1.assert.strictEqual(message.fields, amqpMessage.fields);
        chai_1.assert.strictEqual(message.properties, amqpMessage.properties);
    });
});
