---
title: Tracking IDs
sidebar_label: Tracking IDs
---

## An Opinionated Guide to Identifying Users

If you are only concerned with logged-in users, your `user.id` will work just fine as the sticky property for roll-outs.

If you are working with users as they transition from anonymous to logged-in users however, we need a value that will persist across this transition.
If we don't keep this value consistent, we will run into situations where a new user lands on our site and gets the "Control" variant of an experiment,
then logs in and is thrown into a different variant.

:::tip
Quonfig's recommendation is that you create a separate tracking ID the moment you see a request, save it in a cookie and then persist it
to the user record upon creation.
:::

<Tabs groupId="lang">
<TabItem value="ruby" label="Ruby">

## Adding a tracking ID to a Rails application

```shell
rails g migration AddTrackingId
```

Migration to add a column and initialize it.

```ruby
class AddTrackingId < ActiveRecord::Migration[7.0]
  def change
    add_column :users, :tracking_id, :string
    execute "update users set tracking_id = id" # initialize pre-existing users to have a tracking_id == their user_id
    change_column :users, :tracking_id, :string, null: false
  end
end
```

Useful to always have `@tracking_id` available in our controllers.

```ruby
class ApplicationController < ActionController::Base
  before_action :set_tracking_id
  def set_tracking_id
    @tracking_id = TrackingId.build(user: current_user, cookies: cookies)
  end
end
```

TrackingId looks at the (possibly nil) user and cookies and gets us the correct tracking_id while setting it as a long-lived cookie.

```ruby
class TrackingId
  COOKIE_KEY = "tid".freeze

  def self.build(user:, cookies:)
    builder = new(user, cookies)
    builder.persist_to_cookies
    builder.tracking_id
  end

  def initialize(user = nil, cookies = {})
    @user = user
    @cookies = cookies
  end
  def tracking_id
    @tracking_id ||= user_tracking_id || cookie_tracking_id || self.class.new_tracking_id
  end

  def persist_to_cookies
    @cookies[COOKIE_KEY] = {
      value: tracking_id,
      expires: 1.year.from_now
    }
  end

  private

  def user_tracking_id
    @user.try(:tracking_id)
  end

  def cookie_tracking_id
    return if @cookies[COOKIE_KEY].blank?
    @cookies[COOKIE_KEY]
  end

  def self.new_tracking_id
    SecureRandom.uuid
  end
end
```

When a user signs up and created an account, we need to remember to permanently set the tracking ID on the user account.

```ruby
class RegistrationsController < Devise::RegistrationsController
  def sign_up_params
    devise_parameter_sanitizer.sanitize(:sign_up).merge(tracking_id: TrackingId.build(user: current_user, cookies: cookies))
  end
end
```

</TabItem>
</Tabs>
