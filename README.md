# Flowise access boundary demo

A small, disposable test of the default prediction endpoint and per-flow API key in Flowise 3.1.4. It starts an isolated container bound to localhost, creates a temporary account and a two-node flow, then calls the prediction API before and after attaching an API key.

The flow returns a fixed message; it does not call an LLM or demonstrate model quality. It is an access-control check, not a penetration test. The Flowise image and upstream template are pinned to a release and commit respectively. No real credentials or customer data are used. The container and its temporary state are removed at the end.

On the first GitHub-hosted run, the default SQLite session store crashed during startup with `TypeError: this.db.exec is not a function`. The demo sets `EXPIRE_AUTH_TOKENS_ON_RESTART=true` to use an in-memory session store for this disposable test. That workaround is not a production recommendation.

In an [observed GitHub Actions run](https://github.com/mmajass/flowise-access-demo/actions/runs/42456683021), the unkeyed flow returned HTTP 200 and a fixed reply. After assigning a key, requests with a missing or incorrect key returned HTTP 500 with an unauthorized message, rather than the expected HTTP 401. A request with the correct key returned HTTP 200. This is a narrow observation, not proof of comprehensive access security.

The script characterizes the observed HTTP 500 responses as well as the correct-key response. A passing run means those observed behaviours were reproduced; it does not mean the 500 is desirable.

## Run

Requires Docker, curl and Node.js 24:

```sh
bash run-demo.sh
```

The GitHub Actions workflow runs the same command. It fetches the two visual node definitions from Flowise's upstream template and connects them as a simple Start → Direct Reply flow. The script asserts the expected response and status codes rather than relying on screenshots.
