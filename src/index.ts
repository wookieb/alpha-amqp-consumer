export {default as Message} from "./Message";
export {default as Consumer, ConsumerOptions, ConsumerFunction, ACKType, RejectType} from "./Consumer";
export {ResultContext, ResultHandler} from './ResultHandler';
export {default as ConsumerManager, RetryTopology} from './ConsumerManager';
export {ConnectionManagerOptions} from 'alpha-amqp-connection-manager';

import {ConnectionManagerOptions} from 'alpha-amqp-connection-manager';
import ConsumerManager from './ConsumerManager';


export function connect(url: string, options?: ConnectionManagerOptions) {
    return ConsumerManager.connect(url, options);
}