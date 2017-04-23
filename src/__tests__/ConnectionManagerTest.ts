import ConnectionManager from "../ConnectionManager";
import * as amqp from 'amqplib';
import * as sinon from 'sinon';
import {SinonSpy, SinonStub} from "sinon";

const Channel = require('amqplib/lib/channel_model').Channel;
const ChannelModel = require('amqplib/lib/channel_model').ChannelModel;

describe('ConnectionManager', () => {

    let manager: ConnectionManager;

    let onConnected: SinonSpy;
    let onChannel: SinonSpy;
    let channelModel: any;
    let channel: any;

    const URL = 'amqp://host/url?heartbeat=10';
    beforeEach(() => {
        sinon.stub(amqp, 'connect');
        manager = new ConnectionManager(URL);

        onConnected = sinon.spy();
        onChannel = sinon.spy();

        manager.on('connected', onConnected);
        manager.on('channel', onChannel);

        channelModel = sinon.createStubInstance(ChannelModel);
        channel = sinon.createStubInstance(Channel);

        channelModel.on.restore();
        channelModel.emit.restore();

        (<SinonStub>amqp.connect).resolves(channelModel);
        (<SinonStub>channelModel.createChannel).resolves(channel);
    });

    afterEach(() => {
        (<SinonStub>amqp.connect).restore();
    });

    it('creating new consumer emits an event', async () => {
        const onConsumer = sinon.spy();
        manager.on('consumer', onConsumer);

        const consumer = await manager.consume({
            queue: 'queue'
        }, sinon.spy());

        sinon.assert.calledWithMatch(onConsumer, sinon.match.same(consumer));
    });

    describe('Warns about missing "heartbeat" in connection URL', () => {

        beforeEach(() => {
            sinon.stub(console, 'warn');
        });

        afterEach(() => {
            (<SinonStub>console.warn).restore();
        });
        it('test', () => {
            new ConnectionManager('amqp://localhost');

            sinon.assert.calledWith(
                <SinonStub>console.warn,
                `"heartbeat" options is missing in your connection URL. This might lead to unexpected connection loss.`
            );
        })
    });
    describe('connecting', () => {
        it('success path', async () => {
            (<SinonStub>amqp.connect).resolves(channelModel);
            (<SinonStub>channelModel.createChannel).resolves(channel);

            await manager.connect();

            sinon.assert.calledWith(<SinonStub>amqp.connect, URL);
            sinon.assert.calledOnce(onConnected);
            sinon.assert.calledOnce(onChannel);
            sinon.assert.calledWithExactly(onConnected, channelModel);
            sinon.assert.calledWithExactly(onChannel, channel);
        });

        it('all registered consumers gets notified about new channel', async () => {
            const consumer = [
                await manager.consume({queue: 'queue1'}, sinon.spy()),
                await manager.consume({queue: 'queue2'}, sinon.spy()),
                await manager.consume({queue: 'queue3'}, sinon.spy())
            ];

            consumer.forEach((consumer) => {
                sinon.stub(consumer, 'setChannel');
            });

            await manager.connect();

            consumer.forEach((consumer) => {
                sinon.assert.calledWith(<SinonStub>consumer.setChannel, channel);
            });
        });

        it('reconnects when connection is closed with an error', async () => {
            await manager.connect();

            channelModel.emit('close', new Error('Some error'));

            await new Promise((resolve,) => {
                manager.on('channel', resolve);
            });

            sinon.assert.calledTwice(onConnected);
            sinon.assert.calledTwice(onChannel);
        });

        it('does not reconnect when connection is closed without error', async () => {
            await manager.connect();

            manager.connect = () => {
                throw new Error('Should not be called');
            };
            channelModel.emit('close');

            sinon.assert.calledOnce(onConnected);
            sinon.assert.calledOnce(onChannel);
        });

        it('disconnect closes connection if available', async () => {
            (<SinonStub>amqp.connect).resolves(channelModel);
            (<SinonStub>channelModel.createChannel).resolves(channel);

            await manager.connect();

            await manager.disconnect();
            sinon.assert.called(channelModel.close);
        })
    });

    it('stopping manager stops consumption for all registered consumers', async () => {
        (<SinonStub>amqp.connect).resolves(channelModel);
        (<SinonStub>channelModel.createChannel).resolves(channel);

        (<SinonStub>channel.consume).resolves({
            consumerTag: 'someTag'
        });

        await manager.connect();

        const consumers = [
            await manager.consume({queue: 'queue1', assertQueue: false}, sinon.spy()),
            await manager.consume({queue: 'queue2', assertQueue: false}, sinon.spy()),
            await manager.consume({queue: 'queue3', assertQueue: false}, sinon.spy())
        ];

        consumers.forEach((consumer) => {
            sinon.stub(consumer, 'stop').resolves(null);
        });

        await manager.stopAllConsumers();

        consumers.forEach((consumer) => {
            sinon.assert.calledOnce(<SinonStub>consumer.stop);
        });
    });
});