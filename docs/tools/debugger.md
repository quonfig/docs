---
title: Context Playground & Debugger
sidebar_label: Playground & Debugger
---

Quonfig provides a Context Playground and Debugger to help you understand how Contexts work and how they're used in your application.

In the sidebare, navigate to "Contexts". Pick an environment and you'll see recent contexts and be able to search by `key` and `name` for a specific context.
![context UI](/img/docs/tools/context.jpg)

From there, you can click on a context to see the raw JSON. This is super helpful to understand why a flag is or isn't evaluating the way you expect. For even more guidance, hover over the flag's to the right to see which rule the context matched.

![showing a specific context](/img/docs/tools/context-show.jpg)

If that doesn't solve your problem, copy the context and then navigate to the `Debugger` and scroll down to theContext Playground. Paste in the context and hit evaluate. This let's you modify the context and see what the result would be.

![the context playgound feature flag debugger](/img/docs/tools/context-playground.jpg)

Find more Best Practices and Tips in the [Best Practices](/docs/tutorials/best-practices) guide.