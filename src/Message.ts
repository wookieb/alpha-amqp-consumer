import * as amqp from 'amqplib';

export interface MessageFields {
    consumerTag: string,
    deliveryTag: number,
    redelivered: boolean,
    exchange: string,
    routingKey: string
}

export default class Message {

    constructor(public message: amqp.Message, public queue: string) {
    }

    get content() {
        return this.message.content;
    }

    get properties() {
        return this.message.properties;
    }

    get headers() {
        return this.message.properties.headers;
    }

    get exchange() {
        return this.message.fields.exchange;
    }

    get routingKey() {
        return this.message.fields.routingKey;
    }

    get fields(): MessageFields {
        return this.message.fields;
    }
}