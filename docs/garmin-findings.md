# Garmin findings (fill in on Day 1)

Answers these before Day 2, because the daily job depends on them. Remove token strings before pasting output: dates and `rotated=` values are all that's needed.

| # | Question | How | Result |
| --- | --- | --- | --- |
| 1 | Does `login` work (with 2FA if on)? | `sleep-collector login` | |
| 2 | How long does the access token last? | `inspect-tokens` → `lifetime` | |
| 3 | Is the refresh token a JWT with an expiry, or opaque? | `inspect-tokens` → `jwt=` | |
| 4 | Does the refresh token rotate? | `refresh` → `rotated=True`? | |
| 5 | Does the *old* refresh token still work after rotating? | Copy the token file, `refresh`, put the copy back, `refresh` again | |
| 6 | When is last night's data ready? | `fetch --days 1` at 07:00, 09:00, 11:00 | |
| 7 | Do stage codes (0 deep, 1 light, 2 rem, 3 awake) match the app? | Compare with the app's hypnogram | |
| 8 | Do duration, score, HRV and resting HR match the app? | `fetch --days 14`, check 2 or 3 nights | |

## Follow-ups

- [ ] Replace `collector/tests/fixtures/sleep_synthetic.json` with one real night, **scrubbed** (shift dates, round numbers, delete ids), and update the tests if the shape differs.
- [ ] If Q5 says old refresh tokens die on rotation, Day 2's token cache step is critical (it already saves with `always()`).
