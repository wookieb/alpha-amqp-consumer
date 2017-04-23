import ConnectionManager, {ConnectionManagerOptions} from "./ConnectionManager";

export {default as Message} from "./Message";
export {default as Consumer, ConsumerPolicy, ConsumerFunction, ACKType, RejectType} from "./Consumer";
export {default as ConnectionManager, ConnectionManagerOptions, ReconnectOptions} from "./ConnectionManager";

/**
 * Connects to AMQP server and returns instance of ConnectionManager
 *
 * @param url connection URL to AMQP broker. Should contain "heartbeat" query param.
 * @param [options]
 * @returns {Promise<ConnectionManager>}
 */
export async function connect(url: string, options?: ConnectionManagerOptions) {
    const connectionManager = new ConnectionManager(url, options);

    await connectionManager.connect();
    return connectionManager;
}