import {Channel} from 'amqplib';

export class FakeChannel {
    publish() {}
    consume() {}
    assertQueue() {}
    assertExchange() {}
    bindExchange() {}
    bindQueue() {}
    cancel() {}
    ack() {}
    reject() {}
    nack() {}
}