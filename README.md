# Studio Flow Actions

> Version: 1.0.0

This repository is a collection of GitHub Actions for automated operations related to Twilio Studio Flows.
The prerequisites to these actions are:

- Studio Flow Definitions are stored as JSON files in the repository
- A Studio Configuration file is populated

## Studio Configuration File

Every actions require a Studio Configuration file to be populated according to the JSON schema.
You can get autocomplete in your IDE by setting the `$schema` variable in your file:

```json
{
  "$schema": "https://raw.githubusercontent.com/zingdevlimited/studio-flow-actions/v1/config-schema.json",
  "flows": [],
  "replaceWidgetTypes": []
}
```

[Configuration File Setup](docs/configuration-file.md)

## Actions

### Sync

This action will:

1. Download the latest Flow Definition of every Studio Flow referenced in the **Studio Configuration**
2. Commit the updated definitions to the configured JSON file paths
3. Opens a Pull Request with these changes

This is used to avoid common merge and overwrite issues when developers work with Studio Flow simultaneously.
It also discourages updating the Flow Definitions outside of the Studio editor.

```yaml
permissions:
  contents: write
  pull-requests: write

jobs:
  sync:
    runs-on: ubuntu-22.04
    steps:
      - name: Sync Flows
        uses: zingdevlimited/studio-flow-actions/sync@v1
        with:
          CONFIG_PATH: studioconfig.json
          TWILIO_API_KEY: ${{ vars.TWILIO_API_KEY }}
          TWILIO_API_SECRET: ${{ secrets.TWILIO_API_SECRET }}
```

### Check

This action will:

1. Parse every Flow Definition file referenced in the **Studio Configuration**
2. Ensure the syntax is valid and any properties required for the [Deploy](#deploy) action are present

Note that this is an **offline** check and therefore does not use Twilio Credentials

```yaml
jobs:
  check:
    runs-on: ubuntu-22.04
    steps:
      - name: Check Flows
        uses: zingdevlimited/studio-flow-actions/check@v1
        with:
          CONFIG_PATH: studioconfig.json
```

### Validate

This action will:

1. Parse every Flow Definition file referenced in the **Studio Configuration**
2. Validate all referenced Twilio resources exist
3. Replace all account-specific values in the Flow Definition JSONs
4. Use the [Flow Validate](https://www.twilio.com/docs/studio/rest-api/v2/flow-validate) API to ensure the Flow Definitions are valid

```yaml
jobs:
  validate:
    runs-on: ubuntu-22.04
    steps:
      - name: Validate Flows
        uses: zingdevlimited/studio-flow-actions/validate@v1
        with:
          CONFIG_PATH: studioconfig.json
          TWILIO_API_KEY: ${{ vars.TWILIO_API_KEY }}
          TWILIO_API_SECRET: ${{ secrets.TWILIO_API_SECRET }}
        env:
          ASSETS_BASE_URL: https://myassets-1234.twil.io
```

### Deploy

This action will:

1. Parse every Flow Definition file referenced in the **Studio Configuration**
2. Replace all account-specific values in the Flow Definition JSONs
3. Create/Update the Studio Flows in the account specified

```yaml
jobs:
  deploy:
    runs-on: ubuntu-22.04
    steps:
      - name: Deploy Flows
        uses: zingdevlimited/studio-flow-actions/deploy@v1
        with:
          CONFIG_PATH: studioconfig.json
          TWILIO_API_KEY: ${{ vars.TWILIO_API_KEY }}
          TWILIO_API_SECRET: ${{ secrets.TWILIO_API_SECRET }}
        env:
          ASSETS_BASE_URL: https://myassets-1234.twil.io
```
