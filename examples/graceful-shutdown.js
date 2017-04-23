const connect = require('../src').connect;

connect('amqp://localhost?heartbeat=60')
    .then(manager => {
        manager.consume(
            {queue: 'example-queue'},
            (message, ack) => {
                setTimeout(ack, 1000);
            }
        );

        manager.consume(
            {queue: 'example-queue-2'},
            (message) => {
                return Promise.resolve('test')
            }
        );


        process.on('SIGINT', () => {
            manager.stopAllConsumers();
            const onAllConsumed = () => {
                const allConsumersFinished = manager.consumers.every(c => c.ongoingConsumptions === 0);

                if (allConsumersFinished) {
                    process.exit(0);
                }
            };

            manager.consumers.forEach(c => c.on('all-consumed', onAllConsumed));
        })
    });