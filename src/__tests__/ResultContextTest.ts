import {ResultContext} from '../ResultHandler';
import * as amqp from 'amqplib';
import * as sinon from 'sinon';
import {assert} from 'chai';
import {AssertionError} from "assert";
import Consumer from '../Consumer';
import Message from '../Message';
import * as faker from 'faker';
import {SinonStub} from "sinon";
import {EventEmitter} from "events";
import {FakeChannel} from "./FakeChannel";

describe('ResultContext', () => {

    let channel: amqp.Channel;
    let consumer: Consumer;
    let context: ResultContext;
    let message: Message;

        const QUEUE = faker.random.alphaNumeric(20);

        beforeEach(() => {
            channel = sinon.createStubInstance(FakeChannel);
            consumer = sinon.createStubInstance(Consumer);

        (<any>sinon.stub(consumer, 'queue')).get(() => QUEUE);

        message = new Message({
            properties: <any>{},
            fields: {
                deliveryTag: faker.random.number(1000),
                redelivered: faker.random.boolean(),
                exchange: faker.random.alphaNumeric(20),
                routingKey: faker.random.alphaNumeric(20),
                messageCount: faker.random.number(10)
            },
            content: new Buffer('some-content')
        }, QUEUE);


        context = new ResultContext();
        context.message = message;
        context.channel = channel;
        context.consumer = consumer;
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
            assert.throws(() => {
                context.retry(100)
            }, AssertionError, /You must set "retryTopology" before using retry/);
        });

        it('delay cannot be 0 or less', () => {
            assert.throws(() => {
                context.retry(0);
            }, AssertionError, /must be greater than 0/)
        });

        it('success path', () => {
            const DELAY = 1000;
            context.retry(DELAY);

            sinon.assert.calledWith(
                <SinonStub>context.channel.publish,
                context.retryTopology.exchange.pre,
                consumer.queue,
                message.content,
                Object.assign({}, message.properties, {expiration: DELAY})
            );
        });
    })
});