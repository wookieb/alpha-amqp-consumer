import ConnectionManager from "./ConnectionManager";

export {default as Message} from "./Message";
export {default as ReadableStream, ConsumerPolicy} from "./Consumer";
export {default as ConnectionManager, ConnectionManagerOptions, ReconnectOptions} from "./ConnectionManager";

/**
 * Connects to AMQP server and returns instance of ConnectionManager
 *
 * @param url
 * @param options
 * @returns {Promise<ConnectionManager>}
 */
export async function connect(url: string, options: any) {
    const connectionManager = new ConnectionManager(url, options);

    await connectionManager.connect();
    return connectionManager;
}