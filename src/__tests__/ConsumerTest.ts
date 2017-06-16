import Consumer from "../Consumer";
import * as faker from "faker";
import {assert} from "chai";
import * as amqp from "amqplib";
import * as sinon from "sinon";
import Message from "../Message";
import {SinonStub} from "sinon";
import {ResultContext, ResultHandler} from "../ResultHandler";
import {RetryTopology} from "../ConsumerManager";
import {FakeChannel} from "./FakeChannel";

describe('Consumer', () => {

    const QUEUE_NAME = faker.random.alphaNumeric(20);
    const EXCHANGE = faker.random.alphaNumeric(20);
    const PATTERN = faker.random.alphaNumeric(30);
    const GENERATED_QUEUE_NAME = faker.random.alphaNumeric(30);
    const CONSUMER_TAG = faker.random.alphaNumeric(30);

    const RETRY_TOPOLOGY: RetryTopology = {
        exchange: {
            pre: faker.random.alphaNumeric(20),
            post: faker.random.alphaNumeric(20)
        },
        queue: faker.random.alphaNumeric(20)
    };

    let channel: amqp.Channel;
    let consumerFunction: sinon.SinonStub;

    beforeEach(() => {
        consumerFunction = sinon.stub();
        channel = sinon.createStubInstance(FakeChannel);

        (<SinonStub>channel.consume).resolves(<amqp.Replies.Consume>{
            consumerTag: CONSUMER_TAG
        });

        (<SinonStub>channel.bindExchange).resolves({});
    });

    function stubAssertedQueue(queueName: string) {
        (<SinonStub>channel.assertQueue).resolves(<amqp.Replies.AssertQueue>{
            queue: queueName,
            consumerCount: 1,
            messageCount: 1
        });
    }

    function assertConsume(queueName: string, options: amqp.Options.Consume) {
        sinon.assert.calledWithMatch(
            <SinonStub>channel.consume,
            queueName,
            sinon.match.any,
            options
        );
    }

    function assertQueueAsserted(queueName: string, options: amqp.Options.AssertQueue) {
        sinon.assert.calledWithMatch(
            <SinonStub>channel.assertQueue,
            queueName,
            options
        );
    }

    function assertExchangeBound(queueName: string, exchange: string, pattern?: string, args?: any) {
        sinon.assert.calledWithMatch(
            <SinonStub>channel.bindQueue,
            queueName,
            exchange,
            pattern,
            args
        );
    }

    function createAmqpMessage() {
        return <amqp.Message>{
            content: new Buffer('some content'),
            fields: {some: 'fields'},
            properties: {some: 'properties'}
        };
    }

    function consumeMessage(consumer: Consumer, message: amqp.Message) {
        const messageCallback = (<SinonStub>consumer.channel.consume).getCall(0).args[1];
        messageCallback(message);
    }

    function assertRetryTopologyCreated(consumer: Consumer, retryTopology: RetryTopology) {
        sinon.assert.calledWith(<SinonStub>consumer.channel.bindQueue, consumer.queue, retryTopology.exchange.post, consumer.queue);
    }

    it('throws an error if assertQueue is disabled, queue name is empty and exchange is provided', () => {
        assert.throws(() => {
            new Consumer(consumerFunction, {
                assertQueue: false,
                exchange: EXCHANGE
            });
        }, Error, /In that case assertQueue options MUST be set to true/);
    });

    it('setting channel starts ', async () => {
        const consumer = new Consumer(consumerFunction, {queue: QUEUE_NAME, assertQueue: false});
        await consumer.setChannel(channel);
        sinon.assert.called(<SinonStub>channel.consume);
    });

    describe('consuming queue', () => {
        it('regular queue', async () => {
            const consumer = new Consumer(consumerFunction, {queue: QUEUE_NAME});
            stubAssertedQueue(QUEUE_NAME);

            await consumer.setChannel(channel);
            assertQueueAsserted(QUEUE_NAME, Consumer.defaultAssertQueueOptions);
            assertConsume(QUEUE_NAME, Consumer.defaultConsumeOptions);
        });

        it('regular queue without assert queue', async () => {
            const consumer = new Consumer(consumerFunction, {queue: QUEUE_NAME, assertQueue: false});
            await consumer.setChannel(channel);

            sinon.assert.notCalled(<SinonStub>channel.assertQueue);
            assertConsume(QUEUE_NAME, Consumer.defaultConsumeOptions);
        });

        it('regular queue with consumer options', async () => {
            const CONSUME_OPTIONS = {
                priority: 10
            };

            const consumer = new Consumer(consumerFunction, {
                queue: QUEUE_NAME,
                assertQueue: false,
                consumeOptions: CONSUME_OPTIONS
            });

            await consumer.setChannel(channel);

            sinon.assert.notCalled(<SinonStub>channel.assertQueue);
            assertConsume(
                QUEUE_NAME,
                Object.assign({}, Consumer.defaultConsumeOptions, CONSUME_OPTIONS)
            );
        });

        it('regular queue with assert queue and assert options', async () => {
            const ASSERT_OPTIONS = <amqp.Options.AssertQueue> {
                maxLength: 100
            };
            stubAssertedQueue(QUEUE_NAME);

            const consumer = new Consumer(consumerFunction, {
                queue: QUEUE_NAME,
                assertQueue: true,
                assertQueueOptions: ASSERT_OPTIONS
            });

            await consumer.setChannel(channel);

            assertQueueAsserted(
                QUEUE_NAME,
                Object.assign({}, Consumer.defaultAssertQueueOptions, ASSERT_OPTIONS)
            );
            assertConsume(QUEUE_NAME, Consumer.defaultConsumeOptions);
        });

        it('create new queue for exchange', async () => {
            const consumer = new Consumer(consumerFunction, {
                assertQueue: true,
                exchange: EXCHANGE
            });

            stubAssertedQueue(GENERATED_QUEUE_NAME);
            await consumer.setChannel(channel);

            assertQueueAsserted('', Consumer.defaultAssertQueueOptions);
            assertExchangeBound(GENERATED_QUEUE_NAME, EXCHANGE);
            assertConsume(GENERATED_QUEUE_NAME, Consumer.defaultConsumeOptions);
        });


        it('bind predefined queue to exchange', async () => {
            const BIND_ARGS = {some: 'object'};
            const consumer = new Consumer(consumerFunction, {
                queue: QUEUE_NAME,
                exchange: EXCHANGE,
                pattern: PATTERN,
                bindArgs: BIND_ARGS
            });

            stubAssertedQueue(QUEUE_NAME);
            await consumer.setChannel(channel);

            assertQueueAsserted(QUEUE_NAME, Consumer.defaultAssertQueueOptions);
            assertExchangeBound(QUEUE_NAME, EXCHANGE, PATTERN, BIND_ARGS);
            assertConsume(QUEUE_NAME, Consumer.defaultConsumeOptions);
        });
    });

    describe('stopping consumption', () => {

        let consumer: Consumer;

        beforeEach(() => {
            consumer = new Consumer(consumerFunction, {queue: QUEUE_NAME});
        });

        it('fails if already stopped', () => {
            return assert.isRejected(consumer.stop(), /already stopped/);
        });

        it('cancels consumption', async () => {
            stubAssertedQueue(QUEUE_NAME);

            await consumer.setChannel(channel);
            await consumer.stop();

            sinon.assert.calledWith(<SinonStub>channel.cancel, CONSUMER_TAG);
        });
    });


    describe('resume', () => {

        it('resuming consumption starts consumption again with previous consumer tag', async () => {
            const consumer = new Consumer(consumerFunction, {queue: QUEUE_NAME, assertQueue: false});
            await consumer.setChannel(channel);

            const consumerTag = consumer.consumerTag;
            await consumer.stop();
            await consumer.resume();

            assert.isFalse(consumer.isStopped);
            assertConsume(
                QUEUE_NAME,
                Object.assign({}, Consumer.defaultConsumeOptions, {consumerTag})
            );
        });

        it('cannot resume ongoing consumption', async () => {
            const consumer = new Consumer(consumerFunction, {queue: QUEUE_NAME, assertQueue: false});
            await consumer.setChannel(channel);

            return assert.isRejected(consumer.resume(), /Consumption is already resumed/);
        });

        it('cannot resume without channel', () => {
            const consumer = new Consumer(consumerFunction, {queue: QUEUE_NAME, assertQueue: false});

            return assert.isRejected(consumer.resume(), /Cannot resume consumption without channel open/);
        });
    });


    describe('sending to consumerFunction', () => {
        let consumer: Consumer;

        beforeEach(async () => {
            consumer = new Consumer(consumerFunction, {queue: QUEUE_NAME});
            stubAssertedQueue(QUEUE_NAME);
            await consumer.setChannel(channel);
        });

        it('converts amqpMessage to Message', () => {
            const amqpMessage = createAmqpMessage();

            consumeMessage(consumer, amqpMessage);

            sinon.assert.calledWithMatch(
                consumerFunction,
                sinon.match.instanceOf(Message)
                    .and(sinon.match.has('message', amqpMessage))
                    .and(sinon.match.has('queue', QUEUE_NAME))
            );
        });

        it('null amqpMessage is ignored', () => {
            consumeMessage(consumer, null);
            sinon.assert.notCalled(consumerFunction);
        });
    });

    describe('forwarding result to result handler', () => {
        let consumer: Consumer;
        let resultHandler: ResultHandler;
        let resultHandlerPromise: Promise<any>;
        let message: amqp.Message;

        const resultContextMatch = sinon.match((value: any) => {
            assert.instanceOf(value, ResultContext);
            assert.propertyVal(value, 'channel', channel);
            assert.propertyVal(value, 'consumer', consumer);
            return true;
        });

        beforeEach(async () => {
            message = createAmqpMessage();
            resultHandler = sinon.stub();

            resultHandlerPromise = new Promise((resolve) => {
                (<SinonStub>resultHandler).callsFake((context: ResultContext) => {
                    context.ack();
                    resolve();
                });
            });

            consumer = new Consumer(consumerFunction, {queue: QUEUE_NAME, resultHandler});
            stubAssertedQueue(QUEUE_NAME);
            await consumer.setChannel(channel);
        });

        it('returned non-promise value', async () => {
            const expectedResult = faker.random.alphaNumeric(30);
            (<SinonStub>consumerFunction).returns(expectedResult);

            consumeMessage(consumer, message);
            await resultHandlerPromise;

            sinon.assert.calledWithMatch(<SinonStub>resultHandler, resultContextMatch, undefined, expectedResult);
        });

        it('thrown error', async () => {
            const err = new Error('Some error');
            (<SinonStub>consumerFunction).throws(err);

            consumeMessage(consumer, message);
            await resultHandlerPromise;

            sinon.assert.calledWithMatch(<SinonStub>resultHandler, resultContextMatch, err);
        });

        it('result of resolved promise', async () => {
            const expectedResult = faker.random.alphaNumeric(30);
            (<SinonStub>consumerFunction).resolves(expectedResult);

            consumeMessage(consumer, message);
            await resultHandlerPromise;

            sinon.assert.calledWithMatch(<SinonStub>resultHandler, resultContextMatch, undefined, expectedResult);
        });

        it('result of rejected promise', async () => {
            const err = new Error('some error');
            (<SinonStub>consumerFunction).rejects(err);

            consumeMessage(consumer, message);
            await resultHandlerPromise;

            sinon.assert.calledWithMatch(<SinonStub>resultHandler, resultContextMatch, err);
        });
    });

    describe('default result handler', () => {
        const resultHandler = Consumer.defaultResultHandler;
        let context: ResultContext;

        beforeEach(() => {
            context = new ResultContext();
            context.message = sinon.createStubInstance(Message);
            context.channel = sinon.createStubInstance(FakeChannel);
            context.consumer = sinon.createStubInstance(Consumer);
            context.ack = sinon.spy();
            context.reject = sinon.spy();
        });

        it('ACK if there is no error', () => {
            resultHandler(context, undefined, undefined);
            sinon.assert.calledOnce(<SinonStub>context.ack);
        });

        it('ACK if there is a result', () => {
            resultHandler(context, undefined, faker.random.alphaNumeric(40));
            sinon.assert.calledOnce(<SinonStub>context.ack);
        });

        it('Reject in case of error', () => {
            resultHandler(context, new Error('Some error'));
            sinon.assert.calledOnce(<SinonStub>context.reject);
        });
    });

    describe('acking, rejecting message', () => {

        it('ACK-ing', async () => {
            const onConsumed = sinon.spy();
            const ALL_UP_TO = faker.random.boolean();
            const MESSAGE = createAmqpMessage();

            const consumer = new Consumer(consumerFunction, {
                assertQueue: false,
                queue: QUEUE_NAME,
                resultHandler: (resultContext: ResultContext) => {
                    resultContext.ack(ALL_UP_TO);
                }
            });

            consumer.on('consumed', onConsumed);
            await consumer.setChannel(channel);
            consumeMessage(consumer, MESSAGE);

            sinon.assert.calledWithMatch(<SinonStub>onConsumed, sinon.match.has('message', MESSAGE), ALL_UP_TO);
            sinon.assert.calledWithMatch(<SinonStub>channel.ack, MESSAGE, ALL_UP_TO)
        });

        it('REJECT-ing', async () => {
            const onRejected = sinon.spy();
            const ALL_UP_TO = faker.random.boolean();
            const REQUEUE = faker.random.boolean();
            const MESSAGE = createAmqpMessage();

            const consumer = new Consumer(consumerFunction, {
                assertQueue: false,
                queue: QUEUE_NAME,
                resultHandler: (resultContext: ResultContext) => {
                    resultContext.reject(REQUEUE, ALL_UP_TO);
                }
            });

            consumer.on('rejected', onRejected);
            await consumer.setChannel(channel);
            consumeMessage(consumer, MESSAGE);

            sinon.assert.calledWithMatch(<SinonStub>onRejected, sinon.match.has('message', MESSAGE), REQUEUE, ALL_UP_TO);
            sinon.assert.calledWithMatch(<SinonStub>channel.nack, MESSAGE, ALL_UP_TO, REQUEUE)
        });
    });


    describe('retry topology', () => {

        it('created on setRetryTopology if consumer has a channel and queue', async () => {
            const consumerWithoutChannel = new Consumer(consumerFunction);
            const consumerWithChannel = new Consumer(consumerFunction);

            stubAssertedQueue(QUEUE_NAME);
            await consumerWithChannel.setChannel(channel);

            // does nothing but I want to make sure it won't crash for some reason
            await consumerWithoutChannel.setRetryTopology(RETRY_TOPOLOGY);

            await consumerWithChannel.setRetryTopology(RETRY_TOPOLOGY);
            assertRetryTopologyCreated(consumerWithChannel, RETRY_TOPOLOGY);
        });

        it('created on consumption start', async () => {
            const consumer = new Consumer(consumerFunction);
            await consumer.setRetryTopology(RETRY_TOPOLOGY);
            stubAssertedQueue(QUEUE_NAME);
            await consumer.setChannel(channel);

            assertRetryTopologyCreated(consumer, RETRY_TOPOLOGY);
        });
    });
});