"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ResultHandler_1 = require("../ResultHandler");
const sinon = require("sinon");
const chai_1 = require("chai");
const assert_1 = require("assert");
const Consumer_1 = require("../Consumer");
const Message_1 = require("../Message");
const faker = require("faker");
const FakeChannel_1 = require("./FakeChannel");
describe('ResultContext', () => {
    let channel;
    let consumer;
    let context;
    let message;
    const QUEUE = faker.random.alphaNumeric(20);
    beforeEach(() => {
        channel = sinon.createStubInstance(FakeChannel_1.FakeChannel);
        consumer = sinon.createStubInstance(Consumer_1.default);
        sinon.stub(consumer, 'queue').get(() => QUEUE);
        message = new Message_1.default({
            properties: {
                some: 'extra-properties'
            },
            fields: {},
            content: new Buffer('some-content')
        }, QUEUE);
        context = new ResultHandler_1.ResultContext();
        context.message = message;
        context.channel = channel;
        context.consumer = consumer;
        context.retryTopology = {
            exchange: { pre: 'pre', post: 'post' },
            queue: 'retry'
        };
        context.ack = sinon.spy();
        context.reject = sinon.spy();
    });
    describe('retry', () => {
        it('cannot be used without retry topology', () => {
            context.retryTopology = undefined;
            chai_1.assert.throws(() => {
                context.retry(100);
            }, assert_1.AssertionError, /You must set "retryTopology" before using retry/);
        });
        it('delay cannot be 0 or less', () => {
            chai_1.assert.throws(() => {
                context.retry(0);
            }, assert_1.AssertionError, /must be greater than 0/);
        });
        it('success path', () => {
            const DELAY = 1000;
            context.retry(DELAY);
            sinon.assert.calledWith(context.channel.publish, context.retryTopology.exchange.pre, consumer.queue, message.content, Object.assign({}, message.properties, { expiration: DELAY }));
        });
    });
});
