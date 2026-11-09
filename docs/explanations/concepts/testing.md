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

### Frontend Libraries

Rather than talking to the server, use `setConfig` or use a `Provider` manually with your test setup.

<Tabs groupId="lang">
<TabItem value="javascript" label="JavaScript">

Don't call `quonfig.init`. Instead, use `setConfig` to set up your scenario.

```javascript
quonfig.setConfig({
  turbo: true,
  defaultMediaCount: 3,
});
```

[Read the full JavaScript testing docs.](/docs/sdks/javascript#testing)

</TabItem>

<TabItem value="react" label="React">

Don't use the `QuonfigProvider`. Instead, use the `QuonfigTestProvider` and pass in a config object.

```jsx
<QuonfigTestProvider config={config}>
  <MyComponent />
</QuonfigTestProvider>,
```

[Read the full React testing docs.](/docs/sdks/react#testing)

</TabItem>
</Tabs>

## Testing with a datadir

Mocking every Quonfig call can be tedious. Instead, run your tests against a [datadir][datadir]: a local copy of your workspace pulled with `qfg pull`.

Your tests and CI could fetch the latest configuration from Quonfig, but many teams want full control over the configuration their tests run against, for consistency and reproducibility. A datadir committed to your repo gives you that.

[datadir]: ./local-workspace
