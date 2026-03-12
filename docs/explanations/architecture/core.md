---
title: Quonfig Config Core
sidebar_label: Quonfig Config Core
sidebar_position: 3
draft: true
---

## Core Functionality

The core element of Quonfig Config & FeatureFlags is a local key value store, powered by a distributed log.
What's that mean? Let's have an example.

Here's a simplified version of the Quonfig Config log. We have a single key with a basic integer value.
```json
[
  {
    "id": 100,
    "key": "key1",
    "value": 1
  }
]
```

Our server clients can make an API call and store this in a concurrency safe local hash so that we can call `Quonfig.getInt('key1')` in our clients.
Tada! It's a local key value store.

Now, what happens if we add another key/value? Well, we have two constituents to think about. First we have our existing clients.
They already know about the first key, so we can just send them a partial update.

Quonfig SDK clients use either [GRPC](https://grpc.io/) or [SSE](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)
to send this partial update.

### StreamingUpdate
```json
[
  {
    "id": 102,
    "key": "key2",
    "value": "string"
  }
]
```

Our second constituent are things like new server instances booting up, it needs to know everything, so it can request the entire payload.

### Full Payload
```json
[
  {
  "id": 100,
  "key": "key1",
  "value": 1
  },
  {
    "id": 102,
    "key": "key2",
    "value": "string"
  }
]
```

### Updating a value

Let's walk through changing the value of `key1` to `2`. Our entry in the log will look just like the first entry, but we will have an updated `id` that
is larger than the original value.

### StreamingUpdate
```json
[
  {
    "id": 103,
    "key": "key1",
    "value": 2
  }
]
```

When a new server instance boots up, it needs to know everything, so it can request the entire payload.

### Full Payload
```json
[
  {
  "id": 100,
  "key": "key1",
  "value": 1
  },
  {
    "id": 102,
    "key": "key2",
    "value": "string"
  },
  {
    "id": 103,
    "key": "key1",
    "value": 2
  }
]
```
The full payload can have either the full history of configuration or just the latest values, it doesn't really matter. The clients will only use the
latest `id` that they see for each key.

## What would you do with the Fastest DB in the World?

Quonfig's config system can look a lot like a key/value store, with one big big difference.
Much like something like Consul, the KV store is actually distributed to every client. Which means no API calls when you want a value — everything is in-memory.

Because it's so blazing fast, it really changes what you can do with it. It's totally appropriate to query it many times on every request.
You would never query the database 40 different times while processing a request just to get your app configuration, but when it is essentially
free it means you're now able to make almost every element of your application dynamically configurable.

Let's carry on in [Reliability](resiliency) because if we're really going to run our application on top of something like this
it has absolutely got to work.
