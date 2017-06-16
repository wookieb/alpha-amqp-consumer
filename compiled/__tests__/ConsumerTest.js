"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const Consumer_1 = require("../Consumer");
const faker = require("faker");
const chai_1 = require("chai");
const sinon = require("sinon");
const Message_1 = require("../Message");
const ResultHandler_1 = require("../ResultHandler");
const FakeChannel_1 = require("./FakeChannel");
describe('Consumer', () => {
    const QUEUE_NAME = faker.random.alphaNumeric(20);
    const EXCHANGE = faker.random.alphaNumeric(20);
    const PATTERN = faker.random.alphaNumeric(30);
    const GENERATED_QUEUE_NAME = faker.random.alphaNumeric(30);
    const CONSUMER_TAG = faker.random.alphaNumeric(30);
    const RETRY_TOPOLOGY = {
        exchange: {
            pre: faker.random.alphaNumeric(20),
            post: faker.random.alphaNumeric(20)
        },
        queue: faker.random.alphaNumeric(20)
    };
    let channel;
    let consumerFunction;
    beforeEach(() => {
        consumerFunction = sinon.stub();
        channel = sinon.createStubInstance(FakeChannel_1.FakeChannel);
        channel.consume.resolves({
            consumerTag: CONSUMER_TAG
        });
        channel.bindExchange.resolves({});
    });
    function stubAssertedQueue(queueName) {
        channel.assertQueue.resolves({
            queue: queueName,
            consumerCount: 1,
            messageCount: 1
        });
    }
    function assertConsume(queueName, options) {
        sinon.assert.calledWithMatch(channel.consume, queueName, sinon.match.any, options);
    }
    function assertQueueAsserted(queueName, options) {
        sinon.assert.calledWithMatch(channel.assertQueue, queueName, options);
    }
    function assertExchangeBound(queueName, exchange, pattern, args) {
        sinon.assert.calledWithMatch(channel.bindQueue, queueName, exchange, pattern, args);
    }
    function createAmqpMessage() {
        return {
            content: new Buffer('some content'),
            fields: { some: 'fields' },
            properties: { some: 'properties' }
        };
    }
    function consumeMessage(consumer, message) {
        const messageCallback = consumer.channel.consume.getCall(0).args[1];
        messageCallback(message);
    }
    function assertRetryTopologyCreated(consumer, retryTopology) {
        sinon.assert.calledWith(consumer.channel.bindQueue, consumer.queue, retryTopology.exchange.post, consumer.queue);
    }
    it('throws an error if assertQueue is disabled, queue name is empty and exchange is provided', () => {
        chai_1.assert.throws(() => {
            new Consumer_1.default(consumerFunction, {
                assertQueue: false,
                exchange: EXCHANGE
            });
        }, Error, /In that case assertQueue options MUST be set to true/);
    });
    it('setting channel starts ', () => __awaiter(this, void 0, void 0, function* () {
        const consumer = new Consumer_1.default(consumerFunction, { queue: QUEUE_NAME, assertQueue: false });
        yield consumer.setChannel(channel);
        sinon.assert.called(channel.consume);
    }));
    describe('consuming queue', () => {
        it('regular queue', () => __awaiter(this, void 0, void 0, function* () {
            const consumer = new Consumer_1.default(consumerFunction, { queue: QUEUE_NAME });
            stubAssertedQueue(QUEUE_NAME);
            yield consumer.setChannel(channel);
            assertQueueAsserted(QUEUE_NAME, Consumer_1.default.defaultAssertQueueOptions);
            assertConsume(QUEUE_NAME, Consumer_1.default.defaultConsumeOptions);
        }));
        it('regular queue without assert queue', () => __awaiter(this, void 0, void 0, function* () {
            const consumer = new Consumer_1.default(consumerFunction, { queue: QUEUE_NAME, assertQueue: false });
            yield consumer.setChannel(channel);
            sinon.assert.notCalled(channel.assertQueue);
            assertConsume(QUEUE_NAME, Consumer_1.default.defaultConsumeOptions);
        }));
        it('regular queue with consumer options', () => __awaiter(this, void 0, void 0, function* () {
            const CONSUME_OPTIONS = {
                priority: 10
            };
            const consumer = new Consumer_1.default(consumerFunction, {
                queue: QUEUE_NAME,
                assertQueue: false,
                consumeOptions: CONSUME_OPTIONS
            });
            yield consumer.setChannel(channel);
            sinon.assert.notCalled(channel.assertQueue);
            assertConsume(QUEUE_NAME, Object.assign({}, Consumer_1.default.defaultConsumeOptions, CONSUME_OPTIONS));
        }));
        it('regular queue with assert queue and assert options', () => __awaiter(this, void 0, void 0, function* () {
            const ASSERT_OPTIONS = {
                maxLength: 100
            };
            stubAssertedQueue(QUEUE_NAME);
            const consumer = new Consumer_1.default(consumerFunction, {
                queue: QUEUE_NAME,
                assertQueue: true,
                assertQueueOptions: ASSERT_OPTIONS
            });
            yield consumer.setChannel(channel);
            assertQueueAsserted(QUEUE_NAME, Object.assign({}, Consumer_1.default.defaultAssertQueueOptions, ASSERT_OPTIONS));
            assertConsume(QUEUE_NAME, Consumer_1.default.defaultConsumeOptions);
        }));
        it('create new queue for exchange', () => __awaiter(this, void 0, void 0, function* () {
            const consumer = new Consumer_1.default(consumerFunction, {
                assertQueue: true,
                exchange: EXCHANGE
            });
            stubAssertedQueue(GENERATED_QUEUE_NAME);
            yield consumer.setChannel(channel);
            assertQueueAsserted('', Consumer_1.default.defaultAssertQueueOptions);
            assertExchangeBound(GENERATED_QUEUE_NAME, EXCHANGE);
            assertConsume(GENERATED_QUEUE_NAME, Consumer_1.default.defaultConsumeOptions);
        }));
        it('bind predefined queue to exchange', () => __awaiter(this, void 0, void 0, function* () {
            const BIND_ARGS = { some: 'object' };
            const consumer = new Consumer_1.default(consumerFunction, {
                queue: QUEUE_NAME,
                exchange: EXCHANGE,
                pattern: PATTERN,
                bindArgs: BIND_ARGS
            });
            stubAssertedQueue(QUEUE_NAME);
            yield consumer.setChannel(channel);
            assertQueueAsserted(QUEUE_NAME, Consumer_1.default.defaultAssertQueueOptions);
            assertExchangeBound(QUEUE_NAME, EXCHANGE, PATTERN, BIND_ARGS);
            assertConsume(QUEUE_NAME, Consumer_1.default.defaultConsumeOptions);
        }));
    });
    describe('stopping consumption', () => {
        let consumer;
        beforeEach(() => {
            consumer = new Consumer_1.default(consumerFunction, { queue: QUEUE_NAME });
        });
        it('fails if already stopped', () => {
            return chai_1.assert.isRejected(consumer.stop(), /already stopped/);
        });
        it('cancels consumption', () => __awaiter(this, void 0, void 0, function* () {
            stubAssertedQueue(QUEUE_NAME);
            yield consumer.setChannel(channel);
            yield consumer.stop();
            sinon.assert.calledWith(channel.cancel, CONSUMER_TAG);
        }));
    });
    describe('resume', () => {
        it('resuming consumption starts consumption again with previous consumer tag', () => __awaiter(this, void 0, void 0, function* () {
            const consumer = new Consumer_1.default(consumerFunction, { queue: QUEUE_NAME, assertQueue: false });
            yield consumer.setChannel(channel);
            const consumerTag = consumer.consumerTag;
            yield consumer.stop();
            yield consumer.resume();
            chai_1.assert.isFalse(consumer.isStopped);
            assertConsume(QUEUE_NAME, Object.assign({}, Consumer_1.default.defaultConsumeOptions, { consumerTag }));
        }));
        it('cannot resume ongoing consumption', () => __awaiter(this, void 0, void 0, function* () {
            const consumer = new Consumer_1.default(consumerFunction, { queue: QUEUE_NAME, assertQueue: false });
            yield consumer.setChannel(channel);
            return chai_1.assert.isRejected(consumer.resume(), /Consumption is already resumed/);
        }));
        it('cannot resume without channel', () => {
            const consumer = new Consumer_1.default(consumerFunction, { queue: QUEUE_NAME, assertQueue: false });
            return chai_1.assert.isRejected(consumer.resume(), /Cannot resume consumption without channel open/);
        });
    });
    describe('sending to consumerFunction', () => {
        let consumer;
        beforeEach(() => __awaiter(this, void 0, void 0, function* () {
            consumer = new Consumer_1.default(consumerFunction, { queue: QUEUE_NAME });
            stubAssertedQueue(QUEUE_NAME);
            yield consumer.setChannel(channel);
        }));
        it('converts amqpMessage to Message', () => {
            const amqpMessage = createAmqpMessage();
            consumeMessage(consumer, amqpMessage);
            sinon.assert.calledWithMatch(consumerFunction, sinon.match.instanceOf(Message_1.default)
                .and(sinon.match.has('message', amqpMessage))
                .and(sinon.match.has('queue', QUEUE_NAME)));
        });
        it('null amqpMessage is ignored', () => {
            consumeMessage(consumer, null);
            sinon.assert.notCalled(consumerFunction);
        });
    });
    describe('forwarding result to result handler', () => {
        let consumer;
        let resultHandler;
        let resultHandlerPromise;
        let message;
        const resultContextMatch = sinon.match((value) => {
            chai_1.assert.instanceOf(value, ResultHandler_1.ResultContext);
            chai_1.assert.propertyVal(value, 'channel', channel);
            chai_1.assert.propertyVal(value, 'consumer', consumer);
            return true;
        });
        beforeEach(() => __awaiter(this, void 0, void 0, function* () {
            message = createAmqpMessage();
            resultHandler = sinon.stub();
            resultHandlerPromise = new Promise((resolve) => {
                resultHandler.callsFake((context) => {
                    context.ack();
                    resolve();
                });
            });
            consumer = new Consumer_1.default(consumerFunction, { queue: QUEUE_NAME, resultHandler });
            stubAssertedQueue(QUEUE_NAME);
            yield consumer.setChannel(channel);
        }));
        it('returned non-promise value', () => __awaiter(this, void 0, void 0, function* () {
            const expectedResult = faker.random.alphaNumeric(30);
            consumerFunction.returns(expectedResult);
            consumeMessage(consumer, message);
            yield resultHandlerPromise;
            sinon.assert.calledWithMatch(resultHandler, resultContextMatch, undefined, expectedResult);
        }));
        it('thrown error', () => __awaiter(this, void 0, void 0, function* () {
            const err = new Error('Some error');
            consumerFunction.throws(err);
            consumeMessage(consumer, message);
            yield resultHandlerPromise;
            sinon.assert.calledWithMatch(resultHandler, resultContextMatch, err);
        }));
        it('result of resolved promise', () => __awaiter(this, void 0, void 0, function* () {
            const expectedResult = faker.random.alphaNumeric(30);
            consumerFunction.resolves(expectedResult);
            consumeMessage(consumer, message);
            yield resultHandlerPromise;
            sinon.assert.calledWithMatch(resultHandler, resultContextMatch, undefined, expectedResult);
        }));
        it('result of rejected promise', () => __awaiter(this, void 0, void 0, function* () {
            const err = new Error('some error');
            consumerFunction.rejects(err);
            consumeMessage(consumer, message);
            yield resultHandlerPromise;
            sinon.assert.calledWithMatch(resultHandler, resultContextMatch, err);
        }));
    });
    describe('default result handler', () => {
        const resultHandler = Consumer_1.default.defaultResultHandler;
        let context;
        beforeEach(() => {
            context = new ResultHandler_1.ResultContext();
            context.message = sinon.createStubInstance(Message_1.default);
            context.channel = sinon.createStubInstance(FakeChannel_1.FakeChannel);
            context.consumer = sinon.createStubInstance(Consumer_1.default);
            context.ack = sinon.spy();
            context.reject = sinon.spy();
        });
        it('ACK if there is no error', () => {
            resultHandler(context, undefined, undefined);
            sinon.assert.calledOnce(context.ack);
        });
        it('ACK if there is a result', () => {
            resultHandler(context, undefined, faker.random.alphaNumeric(40));
            sinon.assert.calledOnce(context.ack);
        });
        it('Reject in case of error', () => {
            resultHandler(context, new Error('Some error'));
            sinon.assert.calledOnce(context.reject);
        });
    });
    describe('acking, rejecting message', () => {
        it('ACK-ing', () => __awaiter(this, void 0, void 0, function* () {
            const onConsumed = sinon.spy();
            const ALL_UP_TO = faker.random.boolean();
            const MESSAGE = createAmqpMessage();
            const consumer = new Consumer_1.default(consumerFunction, {
                assertQueue: false,
                queue: QUEUE_NAME,
                resultHandler: (resultContext) => {
                    resultContext.ack(ALL_UP_TO);
                }
            });
            consumer.on('consumed', onConsumed);
            yield consumer.setChannel(channel);
            consumeMessage(consumer, MESSAGE);
            sinon.assert.calledWithMatch(onConsumed, sinon.match.has('message', MESSAGE), ALL_UP_TO);
            sinon.assert.calledWithMatch(channel.ack, MESSAGE, ALL_UP_TO);
        }));
        it('REJECT-ing', () => __awaiter(this, void 0, void 0, function* () {
            const onRejected = sinon.spy();
            const ALL_UP_TO = faker.random.boolean();
            const REQUEUE = faker.random.boolean();
            const MESSAGE = createAmqpMessage();
            const consumer = new Consumer_1.default(consumerFunction, {
                assertQueue: false,
                queue: QUEUE_NAME,
                resultHandler: (resultContext) => {
                    resultContext.reject(REQUEUE, ALL_UP_TO);
                }
            });
            consumer.on('rejected', onRejected);
            yield consumer.setChannel(channel);
            consumeMessage(consumer, MESSAGE);
            sinon.assert.calledWithMatch(onRejected, sinon.match.has('message', MESSAGE), REQUEUE, ALL_UP_TO);
            sinon.assert.calledWithMatch(channel.nack, MESSAGE, ALL_UP_TO, REQUEUE);
        }));
    });
    describe('retry topology', () => {
        it('created on setRetryTopology if consumer has a channel and queue', () => __awaiter(this, void 0, void 0, function* () {
            const consumerWithoutChannel = new Consumer_1.default(consumerFunction);
            const consumerWithChannel = new Consumer_1.default(consumerFunction);
            stubAssertedQueue(QUEUE_NAME);
            yield consumerWithChannel.setChannel(channel);
            // does nothing but I want to make sure it won't crash for some reason
            yield consumerWithoutChannel.setRetryTopology(RETRY_TOPOLOGY);
            yield consumerWithChannel.setRetryTopology(RETRY_TOPOLOGY);
            assertRetryTopologyCreated(consumerWithChannel, RETRY_TOPOLOGY);
        }));
        it('created on consumption start', () => __awaiter(this, void 0, void 0, function* () {
            const consumer = new Consumer_1.default(consumerFunction);
            yield consumer.setRetryTopology(RETRY_TOPOLOGY);
            stubAssertedQueue(QUEUE_NAME);
            yield consumer.setChannel(channel);
            assertRetryTopologyCreated(consumer, RETRY_TOPOLOGY);
        }));
    });
});
