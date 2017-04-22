import Consumer, {ConsumerFunction, ConsumerPolicy} from './Consumer';
import * as amqp from 'amqplib';
import debugFn from './debug';
import {EventEmitter} from 'events';
const backoff = require('backoff');
const debug = debugFn('connection-manager');

export interface ConnectionManagerOptions {
    /**
     * Options provided to amqp.connect
     */
    connection?: any,
    reconnect?: ReconnectOptions
}

export interface ReconnectOptions {
    /**
     * Maximum amount of reconnect attempts - default no limit
     */
    failAfter?: number,
    /**
     * "backoff" module strategy - if not provided then "exponential" strategy is used
     *
     * See https://github.com/MathieuTurcotte/node-backoff#interface-backoffstrategy for details
     */
    backoffStrategy?: any
}

export default class ConnectionManager extends EventEmitter {

    public consumers: Consumer[] = [];

    private connection: amqp.Connection;
    private channel: amqp.Channel;

    static defaultConnectionOptions: any = {};
    static defaultReconnectOptions: ReconnectOptions = {
        backoffStrategy: new backoff.ExponentialStrategy({
            initialDelay: 1000,
            maxDelay: 30000,
            randomisationFactor: Math.random()
        }),
        failAfter: 0
    };

    constructor(private connectionURL: string, private options?: ConnectionManagerOptions) {
        super();
        this.options = this.options || {};
    }

    /**
     *
     * @returns {Promise<void>}
     */
    async connect(): Promise<void> {
        try {
            await this.connectWithBackoff();
            this.connection.on('close', (err: Error) => {
                if (err) {
                    debug('Disconnected - reconnect attempt');
                    //noinspection JSIgnoredPromiseFromCall
                    this.connect();
                } else {
                    debug('Disconnected');
                }
            })

        } catch (e) {
            debug(`Failed to connect: ${e.message}`);
            this.emit('error', e);
        }
    }

    private connectWithBackoff(): Promise<amqp.Connection> {
        const connectionOptions = Object.assign({}, ConnectionManager.defaultConnectionOptions, this.options.connection);

        return new Promise((resolve, reject) => {
            const call = backoff.call(async (url: string, options: any, cb: Function) => {
                this.emit('retry', call.getNumRetries());
                debug('Connecting to queue ... ' + (call.getNumRetries() ? '- Retry #' + call.getNumRetries() : ''));

                try {
                    this.connection = await amqp.connect(url, options);
                    debug('Connected');
                    this.emit('connected', this.connection);

                    cb(null, await this.connection.createChannel());
                } catch (e) {
                    debug('Connection failed: ' + e.message);
                    cb(e);
                }
            }, this.connectionURL, connectionOptions, (err: Error, channel: amqp.Channel) => {
                if (err) {
                    reject(err);
                    return;
                }

                this.onChannel(channel);
                resolve();
            });

            const reconnectOptions = <ReconnectOptions>Object.assign({}, ConnectionManager.defaultReconnectOptions, this.options.reconnect);

            call.failAfter(reconnectOptions.failAfter);
            call.setStrategy(reconnectOptions.backoffStrategy);
            call.start();
        });
    }

    private onChannel(channel: amqp.Channel) {
        this.channel = channel;
        debug('New channel created');

        this.emit('channel', channel);

        return Promise.all(
            this.consumers.map((s) => s.setChannel(channel))
        );
    }

    /**
     * Stops consumptions for all consumers
     *
     * @returns {Promise}
     */
    async stop(): Promise<void> {
        await Promise.all(this.consumers.map(
            (consumer) => {
                debug(`Stopping consumption for queue ${consumer.queue}...`);
                return consumer.stop();
            }
        ));
    }

    /**
     * Closes connection.
     * If you want to wait for all consumers to finish their task then call {@see stop} before disconnecting.
     *
     * @returns {Promise<void>}
     */
    async disconnect() {
        if (this.connection) {
            await this.connection.close();
        }
    }

    /**
     * Creates consumer that consumes given queue/exchange based on consumerPolicy.
     *
     * @param consumerPolicy
     * @param consumerFunction
     * @returns {Consumer}
     */
    consume(consumerPolicy: ConsumerPolicy, consumerFunction: ConsumerFunction): Consumer {
        return this.registerConsumer(new Consumer(consumerPolicy, consumerFunction));
    }

    private registerConsumer(consumer: Consumer) {
        if (this.channel) {
            //noinspection JSIgnoredPromiseFromCall
            consumer.setChannel(this.channel);
        }
        this.consumers.push(consumer);
        this.emit('consumer', consumer);
        return consumer;
    }

}