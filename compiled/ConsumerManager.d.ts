import { ConnectionManager, ConnectionManagerOptions } from 'alpha-amqp-connection-manager';
import Consumer, { ConsumerFunction, ConsumerOptions } from "./Consumer";
export interface RetryTopology {
    exchange: {
        pre: string;
        post: string;
    };
    queue: string;
}
export default class ConsumerManager {
    private connectionManager;
    consumers: Consumer[];
    private channel;
    private retryTopology;
    constructor(connectionManager: ConnectionManager);
    private onChannel(channel);
    /**
     * Creates consumer and starts consumption if channel available
     */
    consume(consumerFunction: ConsumerFunction, options?: ConsumerOptions): Promise<Consumer>;
    /**
     * Stops all consumers
     */
    stopAllConsumers(): Promise<void>;
    /**
     * Creates retry topology. This allows consumers to retry message consumption after specified amount of time.
     *
     * Make sure you call it BEFORE creating any consumer
     */
    setupDelayedRetryTopology(retryTopology: RetryTopology): Promise<void>;
    /**
     * Connects to AMQP broker and returns instance of ConsumerManager
     *
     * @param url
     * @param connectionOptions
     * @returns {Promise<ConsumerManager>}
     */
    static connect(url: string, connectionOptions?: ConnectionManagerOptions): Promise<ConsumerManager>;
}
