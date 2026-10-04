# Garmin findings

Results from the first real run (2026-10-04, Windows laptop, `garminconnect==0.3.2`). The daily job's design depends on these.

| # | Question | Result |
| --- | --- | --- |
| 1 | Does `login` work? | **Yes.** The two mobile login methods were rate limited (`429`), the library fell back to a web login method that succeeded. Don't log in repeatedly. |
| 2 | How long does the access token last? | **About 27 hours** (`jwt=True`, lifetime `1 day, 2:57`). A once-a-day run always finds it close to expiry. |
| 3 | Is the refresh token a JWT with an expiry? | **No** (`jwt=False`). It looks like base64-encoded JSON; its expiry, if any, is not read yet. |
| 4 | Does the refresh token rotate? | **No.** `refresh` gave a new access token (`rotated=True`) but kept the same refresh token (`rotated=False`). |
| 5 | Does the old refresh token still work after refreshing? | Not needed: it didn't rotate. |
| 6 | When is last night's data ready? | Not measured yet. The daily run is set to 09:23 UTC and re-fetches 3 days, so late syncs are picked up. |
| 7 | Do stage codes match the app? | Stage counts look plausible (15 to 31 blocks per night). To check against the app's hypnogram. |
| 8 | Do duration, score, HRV and resting HR match the app? | **Yes**, 13 of 14 nights parsed with realistic values (score 71 to 90, HRV 36 to 50, RHR 51 to 57). 2026-09-26 had no sleep recorded. |

## What this means for the daily job

- The refresh token is stable, so the `GARMIN_TOKENS` GitHub secret stays valid until Garmin expires or revokes it.
- The daily job still saves the token file to the Actions cache after every run, in case Garmin starts rotating refresh tokens later.
- When the refresh token eventually dies, the job fails and emails you: run `sleep-collector login` on your laptop and update the secret.

## Still to do

- [ ] Decode the refresh token's own expiry if it has one (then teach `check-tokens` to read it).
- [ ] Replace `collector/tests/fixtures/sleep_synthetic.json` with one scrubbed real night.
