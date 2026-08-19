# Capucho CLI

Release operations are documented in [docs/ci-releases.md](docs/ci-releases.md).

Keep the CLI generic. Application repositories supply `.capucho/project.json`; CI supplies `CAPUCHO_ENDPOINT` and `CAPUCHO_API_KEY` as secrets. GitHub owns tags and releases, while Capucho owns channel delivery.
