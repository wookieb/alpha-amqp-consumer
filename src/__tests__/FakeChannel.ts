import {Channel} from '@types/amqplib';

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