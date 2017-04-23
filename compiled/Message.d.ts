/// <reference types="node" />
import * as amqp from 'amqplib';
export interface MessageFields {
    readonly consumerTag: string;
    readonly deliveryTag: number;
    readonly redelivered: boolean;
    readonly exchange: string;
    readonly routingKey: string;
}
export default class Message {
    readonly message: amqp.Message;
    readonly queue: string;
    constructor(message: amqp.Message, queue: string);
    readonly content: Buffer;
    readonly properties: any;
    readonly headers: any;
    readonly exchange: any;
    readonly routingKey: any;
    readonly fields: MessageFields;
}
