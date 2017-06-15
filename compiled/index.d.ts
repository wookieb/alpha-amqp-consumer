export { default as Message } from "./Message";
export { default as Consumer, ConsumerOptions, ConsumerFunction, ACKType, RejectType } from "./Consumer";
import { ConnectionManagerOptions } from 'alpha-amqp-connection-manager';
import ConsumerManager from './ConsumerManager';
export declare function connect(url: string, options?: ConnectionManagerOptions): Promise<ConsumerManager>;
