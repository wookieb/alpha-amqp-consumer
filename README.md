# Alpha AMQP Consumer

Library for reliable message consumption via AMQP protocol.

Features:
* Automatically reconnects and restores channels for consumers
* Super easy to use
* Ability to stop/resume consumption
* Supports queue <-> exchange binding
* Supports queue assertion
* Maintains counter of ongoing consumptions which helps implement graceful app shutdown
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
            {queue: 'example-queue'},
            (message, ack) => {
                setTimeout(ack, 1000);
            }
        );
    }); 

```

Usage with promises
```javascript

// (...)

manager.consume(
    {queue: 'example-queue'},
    () => {
        // message will be automatically ACK-ed after 1s
        return new Promise((resolve) => setTimeout(resolve, 1000));
    }
);
// (...)

```

## API
See [Typescript declaration files](compiled/index.d.ts) and [examples directory](./examples)

## Debugging

Run your app with DEBUG env variable. See [debug package docs](https://www.npmjs.com/package/debug) for more details.
```bash
DEBUG=alpha-amqp-consumer:* node app.js
``` 