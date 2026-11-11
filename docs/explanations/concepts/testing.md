---
title: Testing
sidebar_label: Testing
sidebar_position: 5
---

:::tip
Our SDKs and Clients provide library and language-specific testing advice. For specific details, refer to the docs for the SDK or client you're using.
:::

Testing is a first-class citizen in Quonfig. We've designed it so that it is easy to test your code that uses Quonfig.

### Best Practices For Testing

The best practice for testing is to create a test environment and run your tests against a [local copy of your workspace][datadir] (a datadir). The Quonfig client then boots in a consistent state without talking to the Quonfig server.

You can then use mocking to override specific values as-needed, when you are testing the behavior of a particular feature flag or config.

## Mocking

### Backend SDKs

The primary way to test Quonfig is by mocking out calls to Quonfig. Here are some examples:

<Tabs groupId="lang">

<TabItem value="java" label="Java">

`Quonfig` is a regular (final) class with no static state, so inject it and mock it. Mockito 5's default inline mock maker can mock final classes.

```java
import com.quonfig.sdk.Quonfig;
import static org.mockito.Mockito.*;

@Test
void testQuonfig() {
  Quonfig quonfig = mock(Quonfig.class);
  when(quonfig.getString("sample.string", "default")).thenReturn("test value");
  when(quonfig.getLong("sample.long", 10L)).thenReturn(123L);

  MyClass myClass = new MyClass(quonfig);

  // test business logic
}
```

[Read the full Java testing docs.](/docs/sdks/java#testing)

</TabItem>
<TabItem value="ruby" label="Ruby">

```ruby
class Job < Array
  def batches
    slice_size = Quonfig.get('job.batch.size')
    each_slice(slice_size)
  end
end

RSpec.describe Job do
  describe '#batches' do
    it 'returns batches of jobs' do
      jobs = Job.new([1, 2, 3, 4, 5])
      expect(jobs.batches.map(&:size)).to eq([3, 2])
      allow(Quonfig).to receive(:get).with('job.batch.size').and_return(2)
      expect(jobs.batches.map(&:size)).to eq([2, 2, 1])
    end
  end
end
```

</TabItem>
</Tabs>

For the other backend SDKs, see the testing sections for [Python](/docs/sdks/python#testing), [.NET](/docs/sdks/dotnet#testing) and [Go](/docs/sdks/go#offline-and-testing-modes).

### Frontend Libraries

Rather than talking to the server, use `hydrate` or use a `QuonfigTestProvider` with your test setup.

<Tabs groupId="lang">
<TabItem value="javascript" label="JavaScript">

Don't call `quonfig.init`. Instead, use `quonfig.hydrate` to set up your scenario.

```javascript
quonfig.hydrate({
  turbo: true,
  defaultMediaCount: 3,
});
```

[Read the full JavaScript testing docs.](/docs/sdks/javascript#testing)

</TabItem>

<TabItem value="react" label="React">

Don't use the `QuonfigProvider`. Instead, use the `QuonfigTestProvider` and pass in a config object.

```jsx
import { QuonfigTestProvider } from "@quonfig/react/testing";

<QuonfigTestProvider config={config}>
  <MyComponent />
</QuonfigTestProvider>
```

[Read the full React testing docs.](/docs/sdks/react#testing)

</TabItem>
</Tabs>

## Testing with a datadir

Mocking every Quonfig call can be tedious. Instead, run your tests against a [datadir][datadir]: a local copy of your workspace pulled with `qfg pull`.

Your tests and CI could fetch the latest configuration from Quonfig, but many teams want full control over the configuration their tests run against, for consistency and reproducibility. A datadir checked into your repo gives you that.

Pull the workspace, then run your tests with the SDK pointed at it and an environment chosen. The Ruby and Python SDKs read both from environment variables; the other backend SDKs take a `datadir` option (see your SDK's page):

```bash
qfg pull --dir ./my-config
QUONFIG_DIR=./my-config QUONFIG_ENVIRONMENT=development bundle exec rspec
```

If your workspace has [secrets](/docs/explanations/features/secret-management), CI also needs the decryption key: set the env var your `quonfig.secrets.encryption.key` config is provided by (for example `QUONFIG_SECRET_KEY_DEFAULT`) in CI's environment.

See [Local Workspace (datadir)][datadir] for how to keep the copy up to date, which environments you can choose, and what the SDK does and doesn't send over the network in this mode.

[datadir]: ./local-workspace
