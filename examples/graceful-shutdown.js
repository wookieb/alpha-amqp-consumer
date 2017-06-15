const connect = require('../src').connect;

connect('amqp://localhost?heartbeat=60')
    .then(manager => {
        manager.consume(
            (message) => {
                // do something with message
            },
            {queue: 'example-queue'},
        );

        manager.consume(
            (message) => {
                return Promise.resolve('test')
            },
            {queue: 'example-queue-2'}
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
            onAllConsumed();
        })
    });