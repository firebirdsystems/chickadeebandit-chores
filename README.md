# Chores & Allowance

A [Chickadee Bandit](https://chickadeebandit.com/app-library/chore-tracker) app.

## Features

- **Kids** see their assigned chores for the week, tap to mark done, and see their earnings in real time
- **Parents** get an overview of every kid's progress and total earned, manage the chore list, and set the per-point dollar value
- Chores can be assigned to everyone, all kids, or specific family members
- Data resets automatically each week (configurable day)
- All data stored privately in your hub — nothing leaves your server

## Install

In your hub, go to **Apps → Install from URL** and paste:

```
https://github.com/firebirdsystems/chickadeebandit-chores/releases/latest/download/bundle.json
```

## Development

See the [app-template](https://github.com/firebirdsystems/chickadeebandit-app-template) for build instructions and the full manifest field reference.

## Data model

The app keeps its data in its own tables in the household database:

- `app_chore_tracker__settings` — key/value settings: `centsPerPoint` (default 10), `rewardType` (`money`, `screen_time` or `both`) and `minutesPerPoint` (default 5).
- `app_chore_tracker__chores` — one row per chore: `name`, `points`, `assigned_to` (a JSON list), `frequency` (`weekly` or `daily`) and `source_event_id` when an automation created it.
- `app_chore_tracker__completions` — one row per completion, keyed by chore, member, ISO week (`2026-W20`) and, for daily chores, the day.

`assigned_to` values: `"all"`, `"children"`, `"adults"`, or specific family member IDs.

## Hub data access

This app reads `family.members` to display family member names and roles. Its chore data stays in its own tables; the only thing it sends out is an `allowance.earned` event after each week, which automations in Piggy Bank and Rewards can turn into deposits.
