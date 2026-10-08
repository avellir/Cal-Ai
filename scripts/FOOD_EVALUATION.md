Run `npm run evaluate:food -- --prepare` to create `photo-food/reference.json`.
Fill food names and nutrition only when known; leave unknown values null.
Stock photos alone do not establish actual portion weights or calories.

Add FOOD_EVAL_EMAIL to your local .env using a Cal AI app account email.
Supabase dashboard GitHub sign-in is separate from the app's email sign-in.
Use `--signup` to explicitly allow creating a Cal AI test account for that email.
Leave FOOD_EVAL_PASSWORD empty for passwordless sign-in.
Run `npm run evaluate:food` in an interactive terminal. It sends a sign-in email:
copy the unused link address from the email and paste it into the terminal,
or enter the verification code if the email includes one. Do not open the link
first or share it in chat. The session stays in memory for this run.
Accounts with a password can optionally set FOOD_EVAL_PASSWORD instead.
Use `--browser-auth` to paste the link/code into http://127.0.0.1:8766 instead
of the terminal. This temporary page binds only to loopback and closes after sign-in.
The deployed analyze-food function and normal Supabase URL/key are required.
Supabase configuration uses .env first, then app.json expo.extra, like the app.
Requests incur normal provider usage. No meals are saved.

Review `photo-food/evaluation/results.csv` and individual result JSON files.
Vision responses are cached without credentials or image base64.
Run `npm run evaluate:food -- --replay` to rerun app logic offline from cached responses.
Run with `--fresh` to request new vision responses, including after changing prompts/models.
Delete the corresponding vision cache when replacing an image under the same filename.

The runner converts photos to 1200px-wide JPEG at quality 80 and reuses the app
orchestrator, nutrition lookup, and validation. Photos run sequentially to avoid
rate-limit bursts. Failures are recorded per photo and return a nonzero exit code.
Reference nutrition produces absolute errors and percentage errors (positive reference
values only). Expected food names and weight are manual review fields, not automatic scores.
