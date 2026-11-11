---
title: Context Playground & Debugger
sidebar_label: Playground & Debugger
---

Quonfig provides a Context Playground and Debugger to help you understand how Contexts work and how they're used in your application.

In the sidebar, navigate to "Contexts". The **Recent Multicontexts** tab lists the latest multicontexts for the environment you pick. To find a specific context, open the **Context Targeting** tab, pick a context type and an environment, and search by key or property.
![context UI](/img/docs/tools/context.png)

From there, you can click on a context to see the raw JSON. This is super helpful to understand why a flag is or isn't evaluating the way you expect. For even more guidance, hover over the flags to the right to see which rule the context matched.

![showing a specific context](/img/docs/tools/context-show.png)

If that doesn't solve your problem, copy the context and then navigate to the `Debugger`. The Context Playground is at the top of the page. Pick the environment, paste the context into **Context JSON** and click **Evaluate Context**. This lets you modify the context and see what the result would be.

![the context playground feature flag debugger](/img/docs/tools/context-playground.png)

Find more Best Practices and Tips in the [Best Practices](/docs/tutorials/best-practices) guide.
