# Chores & Allowance

A [Chickadee Bandit](http://chickadeebandit.com) app.

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

All data is stored in the hub's app store under a single key `data`:

```json
{
  "settings": {
    "centsPerPoint": 10,
    "resetDay": "monday"
  },
  "chores": [
    { "id": "uuid", "name": "Make bed", "points": 5, "assignedTo": ["children"] }
  ],
  "completions": {
    "2026-W20": { "chore-uuid": ["member-id-1"] }
  }
}
```

`assignedTo` values: `"all"`, `"children"`, `"adults"`, or specific family member IDs.

## Hub data access

This app reads `family.members` to display family member names and roles. It does not write any family data — all chore data is stored privately in the app's own store.
