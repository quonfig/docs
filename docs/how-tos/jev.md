---
title: Using Jev with Quonfig
sidebar_label: Using Jev with Quonfig
description: One JSON Schema for Jev questions. Paste it into Quonfig, keep your questions in a config, and pass them straight to typesafe.systemOne.
---

[Jev](https://www.npmjs.com/package/@typesafe-ai/sdk) (the `@typesafe-ai/sdk`
package) takes a map of named questions. Each question is a yes/no (`noul`),
a `score` or a `choice`. That shape is the same for every Jev call, so one
JSON Schema covers all of them.

Paste the schema below into your workspace once. Keep each question set in a
JSON config bound to it, and pass `config.questions` to `typesafe.systemOne`.
You can change a question, add one or roll a new rubric out to part of your
traffic without a deploy.

## The schema

Copy this schema as it is. It mirrors the `Questions` type of
`@typesafe-ai/sdk` 0.6.0.

```json title="schemas/jev-questions.json"
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Jev questions",
  "description": "A set of named Jev questions in TypeSafe's request shape.",
  "type": "object",
  "required": ["questions"],
  "additionalProperties": false,
  "properties": {
    "questions": {
      "type": "object",
      "minProperties": 1,
      "propertyNames": { "pattern": "^[a-zA-Z][a-zA-Z0-9_]*$" },
      "additionalProperties": {
        "oneOf": [
          {
            "title": "Yes / No",
            "type": "object",
            "required": ["type"],
            "additionalProperties": false,
            "properties": {
              "type": { "const": "noul" },
              "instructions": { "type": "string", "title": "Question" },
              "criteria": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "true": { "type": "string", "title": "Means yes" },
                  "false": { "type": "string", "title": "Means no" }
                }
              }
            }
          },
          {
            "title": "Score",
            "type": "object",
            "required": ["type", "criteria"],
            "additionalProperties": false,
            "properties": {
              "type": { "const": "score" },
              "instructions": { "type": "string", "title": "Question" },
              "criteria": {
                "title": "Rubric, lowest first",
                "description": "Jev returns the position counted from 0: first line = 0.",
                "type": "array",
                "minItems": 2,
                "items": { "type": "string" }
              }
            }
          },
          {
            "title": "Choice",
            "type": "object",
            "required": ["type", "criteria"],
            "additionalProperties": false,
            "properties": {
              "type": { "const": "choice" },
              "instructions": { "type": "string", "title": "Question" },
              "criteria": {
                "title": "Labels",
                "type": "object",
                "minProperties": 2,
                "maxProperties": 255,
                "additionalProperties": { "type": "string" }
              }
            }
          }
        ]
      }
    }
  }
}
```

What the schema enforces:

- Question names start with a letter and use only letters, digits and `_`.
  There must be at least one question.
- `type` is `noul`, `score` or `choice`, and each type allows only its own
  fields.
- A `score` rubric is a list of at least two lines, lowest first. Jev returns
  the position counted from 0, so the first line is 0.
- A `choice` has between 2 and 255 labels, each with a description.

Quonfig checks every value against the schema on every write: saves in the
app, the [REST API](/docs/api/rest-api), the [MCP server](/docs/api/mcp-server),
[`qfg verify`](/docs/tools/cli#verify) and `qfg push` (`@quonfig/cli` 0.2.0 or
later), and a plain `git push` to your workspace repo. A value that doesn't
match is rejected with the field that is wrong.

## Set it up in the app

1. **Add the schema.** Go to **Schemas**, click **+ Add Schema**, set the key
   to `jev-questions` and paste the schema.
2. **Create the config.** On the schema's page, click **+ Add config using
   this schema**. Or go to **Configs**, click **+ Add Config**, choose the
   `json` type and pick `jev-questions` as the schema. Write the value in the
   JSON editor. It checks your value against the schema as you type. See
   [the example value](#the-config-file) below.
3. **Pass the questions to Jev.** Generate typed accessors and pass
   `questions` straight to `typesafe.systemOne`. See [the code](#the-code).

Rules, per-environment values and history work as they do for any other
config.

## Set it up with files (agents and git)

Write two files in your workspace directory, then check and push them:

```bash
qfg verify
qfg push
```

`qfg verify` catches the same mistakes the app does, before anything leaves
your machine.

The schema goes in `schemas/jev-questions.json`, as shown
[above](#the-schema).

### The config file

Each question set is one config with `"schemaKey": "jev-questions"`. This one
asks three questions about every support email:

```json title="configs/support.triage.jev.json"
{
  "key": "support.triage.jev",
  "type": "config",
  "valueType": "json",
  "schemaKey": "jev-questions",
  "description": "What we ask Jev about every inbound support email.",
  "default": {
    "rules": [
      {
        "criteria": [{ "operator": "ALWAYS_TRUE" }],
        "value": {
          "type": "json",
          "value": {
            "questions": {
              "urgent": {
                "type": "noul",
                "instructions": "Does this email need a human reply today? The customer's plan is in the state.",
                "criteria": {
                  "true": "Outage, money at risk, or an explicit deadline.",
                  "false": "FYI, general question, or it can wait until tomorrow."
                }
              },
              "frustration": {
                "type": "score",
                "instructions": "How frustrated is the customer who wrote this email?",
                "criteria": ["Calm", "Annoyed but civil", "Angry or threatening to leave"]
              },
              "topic": {
                "type": "choice",
                "instructions": "What is this email mainly about?",
                "criteria": {
                  "billing": "Invoices, charges, refunds or plan changes.",
                  "bug": "Something in the product is broken or wrong.",
                  "howto": "A question about how to do something."
                }
              }
            }
          }
        }
      }
    ]
  },
  "environments": [],
  "variants": []
}
```

### The model name

Keep the model name in its own string config, `jev.model`. Then production
and staging can pin different models without copying the questions.

```json title="configs/jev.model.json"
{
  "key": "jev.model",
  "type": "config",
  "valueType": "string",
  "description": "Which Jev model to call.",
  "default": {
    "rules": [
      {
        "criteria": [{ "operator": "ALWAYS_TRUE" }],
        "value": { "type": "string", "value": "jev-latest" }
      }
    ]
  },
  "environments": [],
  "variants": []
}
```

## The code

Generate typed accessors for Node with
[`qfg generate`](/docs/tools/cli#generate):

```bash
qfg generate --targets node-ts
```

You need `@quonfig/cli` 0.2.0 or later. From that version, the generated type
for a `jev-questions` config is Jev's own question union, so `questions`
passes to `systemOne` with no cast.

```ts
import { Quonfig } from "@quonfig/node";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { QuonfigTypesafeNode } from "./generated/quonfig-server";

const client = new Quonfig({ sdkKey: process.env.QUONFIG_BACKEND_SDK_KEY });
await client.init();
const quonfig = new QuonfigTypesafeNode(client);
const typesafe = new TypeSafeClient({ apiKey: process.env.TYPESAFE_API_KEY });

export async function triage(email: string, user: { key: string; plan: string }) {
  const ctx = { user };
  const { questions } = quonfig.supportTriageJev(ctx); // typed from the schema
  const { answers } = await typesafe.systemOne({
    state: { email, plan: user.plan },
    model: quonfig.jevModel(ctx),
    questions, // no cast
  });
  // Each answer is a union: narrow on `type` before reading its value.
  const results: Record<string, number | string> = {};
  for (const [name, answer] of Object.entries(answers)) {
    if (answer.type === "noul") results[name] = answer.noul; // 0 to 1
    else if (answer.type === "score") results[name] = answer.score; // rubric position
    else results[name] = answer.choice; // a label key
  }
  return results; // { urgent: 0.9, frustration: 2, topic: "billing" }
}
```

For SDK setup and options, see the [Node SDK](../sdks/node/node.md).
