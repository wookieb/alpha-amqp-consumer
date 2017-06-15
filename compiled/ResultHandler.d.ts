import Message from "./Message";
import * as amqp from '@types/amqplib';
import { ACKType, default as Consumer, RejectType } from "./Consumer";
import { RetryTopology } from "./ConsumerManager";
export declare class ResultContext {
    message: Message;
    channel: amqp.Channel;
    consumer: Consumer;
    ack: ACKType;
    reject: RejectType;
    retryTopology: RetryTopology;
    retry(delay: number): void;
}
export declare type ResultHandler = (context: ResultContext, error: any, result?: any) => void;
