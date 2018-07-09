/// <reference types="node" />
import * as amqp from 'amqplib';
export default class Message {
    readonly message: amqp.Message;
    readonly queue: string;
    constructor(message: amqp.Message, queue: string);
    readonly content: Buffer;
    readonly properties: amqp.MessageProperties;
    readonly headers: amqp.MessagePropertyHeaders;
    readonly exchange: string;
    readonly routingKey: string;
    readonly fields: amqp.MessageFields;
}
