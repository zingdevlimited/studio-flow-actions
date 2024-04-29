# Alternate Runners

## Docker

If you don't have Node 20 in your environment directly, you can run the actions from a Docker Container.
A sample [Dockerfile](../samples/docker/Dockerfile) has been provided for this purpose.

Assuming you have the following directory structure:

```bash
.
├── Dockerfile
├── check
│   └── index.js
├── deploy
│   └── index.js
├── sync
│   └── index.js
└── validate
    └── index.js
```

You can build the dockerfile with this command:

```bash
docker build . -t studio-actions
```

You can then run the actions by passing in inputs as environment variables,
and the name of the action as an argument:

```bash
docker run -e CONFIG_PATH=<path-to-config> studio-actions check
```

## Azure Pipelines

You can use the actions in Azure Pipelines by simply fetching the required entrypoint file
during the pipeline run and executing it with Node 20.

A [callable template](../samples/azure-pipelines/action-caller-template.yaml) has been provided for this.
You can use it as shown in the following example:

```yaml
steps:
  - template: ./action-caller-template.yaml # Relative path from this file
    parameters:
      ACTION: validate
      CONFIG_PATH: studioconfig.json # Path from repository root
      TWILIO_API_KEY: $(TWILIO_API_KEY)
      TWILIO_API_SECRET: $(TWILIO_API_SECRET)
      ENV_VARS:
        EXAMPLE_ENV_1: examplevalue1
        EXAMPLE_ENV_2: examplevalue2
```
