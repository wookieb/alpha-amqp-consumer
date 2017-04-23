import Consumer from "../Consumer";
import * as faker from "faker";
import {assert} from "chai";
import * as amqp from "amqplib";
import * as sinon from "sinon";
import Message from "../Message";
import {SinonSpy} from "sinon";
const Channel: amqp.Channel = require('amqplib/lib/channel_model').Channel;

type Sinoned<T> = { [P in keyof T]: sinon.SinonStub };

describe('Consumer', () => {

    const QUEUE_NAME = faker.random.alphaNumeric(20);
    const EXCHANGE = faker.random.alphaNumeric(20);
    const PATTERN = faker.random.alphaNumeric(30);
    const GENERATED_QUEUE_NAME = faker.random.alphaNumeric(30);
    const CONSUMER_TAG = faker.random.alphaNumeric(30);

    let channel: Sinoned<amqp.Channel>;
    let consumerFunction: sinon.SinonStub;

    beforeEach(() => {
        consumerFunction = sinon.stub();
        channel = sinon.createStubInstance(Channel);

        channel.consume.resolves(<amqp.Replies.Consume>{
            consumerTag: CONSUMER_TAG
        });

        channel.bindExchange.resolves({});
    });

    function stubAssertedQueue(queueName: string) {
        channel.assertQueue.resolves(<amqp.Replies.AssertQueue>{
            queue: queueName,
            consumerCount: 1,
            messageCount: 1
        });
    }

    function assertConsume(queueName: string, options: amqp.Options.Consume) {
        sinon.assert.calledWithMatch(
            channel.consume,
            queueName,
            sinon.match.any,
            options
        );
    }

    function assertQueueAsserted(queueName: string, options: amqp.Options.AssertQueue) {
        sinon.assert.calledWithMatch(
            channel.assertQueue,
            queueName,
            options
        );
    }

    function assertExchangeBound(queueName: string, exchange: string, pattern?: string, args?: any) {
        sinon.assert.calledWithMatch(
            channel.bindQueue,
            queueName,
            exchange,
            pattern,
            args
        );
    }

    it('throws an error if assertQueue is disabled, queue name is empty and exchange is provided', () => {
        assert.throws(() => {
            new Consumer({
                assertQueue: false,
                exchange: EXCHANGE
            }, consumerFunction);
        }, Error, /In that case assertQueue options MUST be set to true/);
    });

    it('setting channel starts ', async () => {
        const consumer = new Consumer({queue: QUEUE_NAME, assertQueue: false}, consumerFunction);
        await consumer.setChannel(channel);
        sinon.assert.called(channel.consume);
    });

    describe('consuming queue', () => {
        it('regular queue', async () => {
            const consumer = new Consumer({queue: QUEUE_NAME}, consumerFunction);
            stubAssertedQueue(QUEUE_NAME);

            await consumer.setChannel(channel);
            assertQueueAsserted(QUEUE_NAME, Consumer.defaultAssertQueueOptions);
            assertConsume(QUEUE_NAME, Consumer.defaultConsumerOptions);
        });

        it('regular queue without assert queue', async () => {
            const consumer = new Consumer({queue: QUEUE_NAME, assertQueue: false}, consumerFunction);
            await consumer.setChannel(channel);

            sinon.assert.notCalled(channel.assertQueue);
            assertConsume(QUEUE_NAME, Consumer.defaultConsumerOptions);
        });

        it('regular queue with consumer options', async () => {
            const CONSUMER_OPTIONS = {
                priority: 10
            };

            const consumer = new Consumer({
                queue: QUEUE_NAME,
                assertQueue: false,
                consumerOptions: CONSUMER_OPTIONS
            }, consumerFunction);

            await consumer.setChannel(channel);

            sinon.assert.notCalled(channel.assertQueue);
            assertConsume(
                QUEUE_NAME,
                Object.assign({}, Consumer.defaultConsumerOptions, CONSUMER_OPTIONS)
            );
        });

        it('regular queue with assert queue and assert options', async () => {
            const ASSERT_OPTIONS = <amqp.Options.AssertQueue> {
                maxLength: 100
            };
            stubAssertedQueue(QUEUE_NAME);

            const consumer = new Consumer({
                queue: QUEUE_NAME,
                assertQueue: true,
                assertQueueOptions: ASSERT_OPTIONS
            }, consumerFunction);

            await consumer.setChannel(channel);

            assertQueueAsserted(
                QUEUE_NAME,
                Object.assign({}, Consumer.defaultAssertQueueOptions, ASSERT_OPTIONS)
            );
            assertConsume(QUEUE_NAME, Consumer.defaultConsumerOptions);
        });

        it('create new queue for exchange', async () => {
            const consumer = new Consumer({
                assertQueue: true,
                exchange: EXCHANGE
            }, consumerFunction);

            stubAssertedQueue(GENERATED_QUEUE_NAME);
            await consumer.setChannel(channel);

            assertQueueAsserted('', Consumer.defaultAssertQueueOptions);
            assertExchangeBound(GENERATED_QUEUE_NAME, EXCHANGE);
            assertConsume(GENERATED_QUEUE_NAME, Consumer.defaultConsumerOptions);
        });


        it('bind predefined queue to exchange', async () => {
            const BIND_ARGS = {some: 'object'};
            const consumer = new Consumer({
                queue: QUEUE_NAME,
                exchange: EXCHANGE,
                pattern: PATTERN,
                bindArgs: BIND_ARGS
            }, consumerFunction);

            stubAssertedQueue(QUEUE_NAME);
            await consumer.setChannel(channel);

            assertQueueAsserted(QUEUE_NAME, Consumer.defaultAssertQueueOptions);
            assertExchangeBound(QUEUE_NAME, EXCHANGE, PATTERN, BIND_ARGS);
            assertConsume(QUEUE_NAME, Consumer.defaultConsumerOptions);
        });
    });

    describe('stopping consumption', () => {

        let consumer: Consumer;

        beforeEach(() => {
            consumer = new Consumer({queue: QUEUE_NAME}, consumerFunction);
        });

        it('fails if already stopped', () => {
            return assert.isRejected(consumer.stop(), Error, 'already stopped');
        });

        it('cancels consumption', async () => {
            stubAssertedQueue(QUEUE_NAME);

            await consumer.setChannel(channel);
            await consumer.stop();

            sinon.assert.calledWith(channel.cancel, CONSUMER_TAG);
        });
    });


    it('resuming consumption starts consumption again with previous consumer tag', async () => {
        const consumer = new Consumer({queue: QUEUE_NAME, assertQueue: false}, consumerFunction);
        await consumer.setChannel(channel);

        const consumerTag = consumer.consumerTag;
        await consumer.stop();
        await consumer.resume();

        assert.isFalse(consumer.isStopped);
        assertConsume(
            QUEUE_NAME,
            Object.assign({}, Consumer.defaultConsumerOptions, {consumerTag})
        );
    });

    describe('sending to consumerFunction', () => {
        let consumer: Consumer;
        let messageCallback: (message: amqp.Message) => void;

        beforeEach(async () => {
            consumer = new Consumer({queue: QUEUE_NAME}, consumerFunction);
            stubAssertedQueue(QUEUE_NAME);
            await consumer.setChannel(channel);

            messageCallback = channel.consume.getCall(0).args[1];
        });

        it('converts amqpMessage to Message', () => {
            const amqpMessage = <amqp.Message>{
                content: new Buffer('some content'),
                fields: {some: 'fields'},
                properties: {some: 'properties'}
            };

            messageCallback(amqpMessage);

            sinon.assert.calledWithMatch(
                consumerFunction,
                sinon.match.instanceOf(Message)
                    .and(sinon.match.has('message', amqpMessage))
                    .and(sinon.match.has('queue', QUEUE_NAME))
            );
        });

        it('null amqpMessage is ignored', () => {
            messageCallback(null);
            sinon.assert.notCalled(consumerFunction);
        });
    });

    describe('ACK-ing and rejecting message', () => {
        let consumer: Consumer;
        let onConsumed: SinonSpy;
        let onRejected: SinonSpy;
        let onError: SinonSpy;
        let messageCallback: (message: amqp.Message) => void;
        let messageConsumed: Promise<any>;
        const error = new Error('test');

        const message: amqp.Message = {
            content: new Buffer(faker.random.alphaNumeric(20), 'utf8'),
            properties: {some: 'properties'},
            fields: {some: 'fields'}
        };

        function assertACKed() {
            sinon.assert.calledOnce(channel.ack);
            sinon.assert.calledWithMatch(
                channel.ack,
                sinon.match.same(message)
            );
        }

        function assertRejected() {
            sinon.assert.calledOnce(channel.nack);
            sinon.assert.calledWithMatch(
                channel.nack,
                sinon.match.same(message)
            );
        }

        function assertConsumedEventEmitted() {
            sinon.assert.calledOnce(onConsumed);
            sinon.assert.calledWithMatch(
                onConsumed,
                sinon.match.instanceOf(Message)
                    .and(
                        sinon.match.has(
                            'message',
                            sinon.match.same(message)
                        )
                    )
            );
        }

        function assertRejectedEventEmitted() {
            sinon.assert.calledOnce(onRejected);
            sinon.assert.calledWithMatch(
                onRejected,
                sinon.match.instanceOf(Message)
                    .and(
                        sinon.match.has(
                            'message',
                            sinon.match.same(message)
                        )
                    )
            );
        }

        function assertErrorEmitted() {
            sinon.assert.calledOnce(onError);
            sinon.assert.calledWithMatch(onError, sinon.match.same(error));
        }

        function assertCounterValue(num?: Number) {
            assert.propertyVal(consumer, 'ongoingConsumptions', num || 1);
        }

        function assertCounterZeroed() {
            assert.propertyVal(consumer, 'ongoingConsumptions', 0);
        }

        beforeEach(async () => {
            onConsumed = sinon.spy();
            onRejected = sinon.spy();
            onError = sinon.spy();
            consumer = new Consumer({queue: QUEUE_NAME, assertQueue: false}, consumerFunction);

            consumer.on('consumed', onConsumed);
            consumer.on('rejected', onRejected);
            consumer.on('consumer-error', onError);

            await consumer.setChannel(channel);
            messageCallback = channel.consume.getCall(0).args[1];

            messageConsumed = new Promise((resolve) => {
                channel.ack.callsFake(resolve);
                channel.nack.callsFake(resolve);
            })
        });

        it('ACK-ing if consumer returns promise that gets fulfilled', async () => {
            consumerFunction.resolves('some value');

            messageCallback(message);

            assertCounterValue();
            await messageConsumed;
            assertCounterZeroed();

            assertACKed();
            assertConsumedEventEmitted();
        });

        it('ACK-ing if consumer calls ack explicitly', async () => {
            consumerFunction.callsFake((message, ack) => {
                ack();
            });
            messageCallback(message);

            assertACKed();
            assertConsumedEventEmitted();
        });

        it('rejecting if consumer throws na error', async () => {
            consumerFunction.throws(error);
            messageCallback(message);

            assertRejected();
            assertRejectedEventEmitted();
            assertErrorEmitted();
        });

        it('rejecting if consumer returns promise that gets rejected', async () => {
            consumerFunction.rejects(error);
            messageCallback(message);

            assertCounterValue();
            await messageConsumed;
            assertCounterZeroed();

            assertRejected();
            assertRejectedEventEmitted();
            assertErrorEmitted();
        });

        it('rejecting if consumer calls reject explicitly', async () => {
            consumerFunction.callsFake((message, ack, reject) => {
                reject();
            });
            messageCallback(message);

            assertRejected();
            assertRejectedEventEmitted();
            sinon.assert.notCalled(onError);
        });

        it('prevents double ACK-ing if consumer returns promise that gets fulfilled and calls ack explicitly', async () => {
            consumerFunction.callsFake((message, ack) => {
                return Promise.resolve('test')
                    .then(() => ack());
            });
            messageCallback(message);

            assertCounterValue();
            await messageConsumed;
            assertCounterZeroed();

            assertACKed();
            assertConsumedEventEmitted();
        });

        it('prevents double rejection if consumer returns promise that gets rejected and calls reject explicitly', async () => {
            consumerFunction.callsFake((message, ack, reject) => {
                reject();
                return Promise.reject(error)
            });
            messageCallback(message);

            await messageConsumed;

            assertRejected();
            assertRejectedEventEmitted();
            assertErrorEmitted();
        });

        it('emits "all-consumed" if all consumptions are finished', async () => {
            let resolve1: Function;
            let resolve2: Function;

            const onAllConsumedSpy = sinon.spy();
            const promise1 = new Promise(r => resolve1 = r);
            const promise2 = new Promise(r => resolve2 = r);
            const message1 = message;
            const message2: amqp.Message = {
                content: new Buffer(faker.random.alphaNumeric(30), 'utf8'),
                properties: {some: 'properties 2'},
                fields: {some: 'fields 2'}
            };
            consumer.on('all-consumed', onAllConsumedSpy);

            consumerFunction.onCall(0).returns(promise1);
            consumerFunction.onCall(1).returns(promise2);

            messageCallback(message1);
            messageCallback(message2);

            //noinspection JSUnusedAssignment
            resolve1('test');
            await promise1;
            sinon.assert.notCalled(onAllConsumedSpy);

            //noinspection JSUnusedAssignment
            resolve2('test');
            await promise2;
            sinon.assert.calledOnce(onAllConsumedSpy);
        });
    });
});