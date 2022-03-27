import {ConnectionManager} from "alpha-amqp-connection-manager";
import {ConsumerManager} from "./ConsumerManager";

export * from "./Message";
export * from "./Consumer";
export * from './ResultHandler';
export * from './ConsumerManager';
export * from 'alpha-amqp-connection-manager';

export function connect(url: string, options?: ConnectionManager.Options) {
	return ConsumerManager.connect(url, options);
}
