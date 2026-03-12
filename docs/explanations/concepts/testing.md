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

The best practice for testing is to create a test environment and use a [datafile][df]. A datafile is a JSON snapshot of your configuration, which allows the Quonfig client to boot up in a consistent state without talking to the Quonfig server.

You can then use mocking to override specific values as-needed, when you are testing the behavior of a particular feature flag or config.

## Mocking

### Backend SDKs

The primary way to test Quonfig is by mocking out calls to Quonfig. Here are some examples:

<Tabs groupId="lang">

<TabItem value="java" label="Java">

```java
@Test
void testQuonfig(){
  ConfigClient mockConfigClient = mock(ConfigClient.class);
  when(mockConfigClient.liveString("sample.string")).thenReturn(FixedValue.of("test value"));
  when(mockConfigClient.liveLong("sample.long")).thenReturn(FixedValue.of(123L));

  MyClass myClass = new MyClass(mock(ConfigClient.class));

  // test business logic

}
```

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

## Testing with DataFiles

Mocking out all of the Quonfig calls can be tedious, so we've added a feature called [DataFiles][df] to Quonfig Launch.

Having your tests/CI reach out to Quonfig to get the latest configuration is a viable approach, but for consistency & reproducibility, many of us prefer to have full control over the configuration used to run tests. Datafiles are perfect for this use case.

[df]: ./datafiles
