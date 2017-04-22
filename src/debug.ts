import * as debug from 'debug';

export default function (suffix?: string) {
    return debug('amqp-readable-stream' + (suffix ? ':' + suffix : ''));
}