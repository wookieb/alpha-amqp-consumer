import * as debug from 'debug';

export function debugFn(suffix?: string) {
	return debug('alpha-amqp-consumer' + (suffix ? ':' + suffix : ''));
}
