# Alpha AMQP Consumer

[![CircleCI](https://circleci.com/gh/wookieb/alpha-amqp-consumer.svg?style=svg)](https://circleci.com/gh/wookieb/alpha-amqp-consumer)

Library for reliable message consumption via AMQP protocol.

Features:
* Automatically reconnects and restores channels for consumers
* Super easy to use
* Ability to stop/resume consumption
* Supports queue <-> exchange binding
* Supports queue assertion
* Allows to retry message consumption after certain amount of time
* Maintains counter of ongoing consumptions which helps implement [graceful app shutdown](examples/graceful-shutdown.js)
* Easy debugging with [debug](https://www.npmjs.com/package/debug) module

## Install
```bash
npm install alpha-amqp-consumer
```

## Usage

```javascript
const connect = require('alpha-amqp-consumer');

connect('amqp://localhost')
    .then(manager => {
        manager.consume(
            (message) => {
                // once function execution is done the message will be ACK-ed
            },
            {queue: 'example-queue'},
        );
    }); 

```

Usage with promises
```javascript

// (...)

manager.consume(
    {queue: 'example-queue'},
    () => {
        // automatically ACK-ed once promise gets resolved (in that case after 1 second)
        return new Promise((resolve) => setTimeout(resolve, 1000));
    }
);
// (...)

```

## API
See special [API declaration file](docs/api.md) and [examples directory](./examples).

## Message ACK-ing and REJECT-ing
Every consumer has "resultHandler" which a function that decides what to do with the messages based on the result from consumer function.
Message is rejected automatically it consumer function throws an error or returned promise gets rejected, otherwise message is ACKed.
You can customize the behavior by providing resultHandler

```javascript
manager.consume((message) => {
    // do something
}, {
    queue: 'some-queue',
    resultHandler(context, error) {
        if (error) {
            // maybe thrown error is fine?
            if (isAcceptableError(error)) {
                context.ack();
            } else {
                context.reject();
            }
        } else {
            context.ack();
        }
    }
})
```

## Retry with delay
There is no way to say AMQP to retry message consumption after certain period of time. In order to achieve that we need a bit more typology setup.

We need:
- name of "pre" retry exchange
- name of "post-retry" exchange
- name of queue for temporary messages storage

For more information how retry works [another document](docs/how-retry-works.md). 

```javascript
manager.setupDelayedRetryTopology({
    exchange: {
        pre: 'pre-retry',
        post: 'post-retry'
    },
    queue: 'messages-to-retry'
})
    .then(() => {
        manager.consume(() => {
            // do something with message
        }, {
            queue: 'some-queue',
            resultHandler(context, error) {
                if (error) {
                    context.retry(5000);
                } else {
                    context.ack();
                }
            }
        })
    });
```


## Debugging
Run your app with DEBUG env variable. See [debug package docs](https://www.npmjs.com/package/debug) for more details.
```bash
DEBUG=alpha-amqp-consumer:* node app.js
``` 