# How retry works

AMQP does not provide any functionality for delayed retry message consumption. For that we need to extra setup.

1) "pre-retry" exchange of "topic" type that forwards all messages to "retry" queue
2) "retry" queue that has dead letter exchange set to "post-retry" exchange
3) "post-retry" exchange of type "direct" that is binded to every queue that is allowed for delayed message retry

Once we decide that the consumer should perform another attempt of consumption `alpha-amqp-wrapper` performs following operations:
1) A copy of current message is published to "pre-retry" exchange with routing key set to original queue name and TTL equal to retry delay.
2) Message is rejected with "requeue" false

The rest is done by AMQP broker.
Messages quickly lands in "retry" queue due to binding in "pre-retry" exchange. Once message expire its dead-lettered to "post-retry" exchange that sends the message back to original queue.