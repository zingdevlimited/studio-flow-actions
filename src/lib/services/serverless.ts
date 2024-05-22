import { Twilio } from "twilio";
import { FUNCTION_URL_REGEX } from "../helpers/studio-schemas";
import { exit } from "process";
import { commands } from "../helpers/commands";

type ServiceReference = {
  name: string;
  environmentSuffix: string | null;
};

type FunctionVersion = {
  sid: string;
  path: string;
};

export const getUrlComponents = (url: string) => {
  const groups = FUNCTION_URL_REGEX.exec(url);
  if (!groups) {
    return null;
  }
  return {
    serviceName: groups[1],
    environmentSuffix: groups[3],
    functionPath: groups[4],
  };
};

const getServiceFunctions = async (
  client: Twilio,
  uniqueName: string,
  environmentSuffix: string | null
) => {
  try {
    commands.logDebug(`Serverless: Fetch Service ${uniqueName}`);
    const service = await client.serverless.v1.services(uniqueName).fetch();

    commands.logDebug(`Serverless: List Environments under ${uniqueName}`);
    const environmentList = await service.environments().list();
    const environment = environmentList.find((e) => e.domainSuffix === environmentSuffix);

    if (!environment) {
      throw new Error("Environment not found!");
    }

    commands.logDebug(`Serverless: Fetch Latest Build for ${uniqueName}/${environmentSuffix}`);
    const build = await service.builds().get(environment.buildSid).fetch();
    const functionVersions = (build.functionVersions as FunctionVersion[]).reduce(
      (prev, curr) => ({
        ...prev,
        [curr.path]: curr.sid,
      }),
      {} as Record<string, string>
    );

    return [
      uniqueName,
      {
        serviceSid: service.sid,
        environmentSid: environment.sid,
        domainName: environment.domainName,
        functions: functionVersions,
      },
    ] as const;
  } catch (err) {
    console.error(err);
    exit(1);
  }
};

export const getFunctionServices = async (client: Twilio, services: ServiceReference[]) => {
  const promises = services.map((service) =>
    getServiceFunctions(client, service.name, service.environmentSuffix)
  );

  const serviceMaps = await Promise.all(promises);

  return Object.fromEntries(serviceMaps);
};

export type FunctionsMap = Awaited<ReturnType<typeof getFunctionServices>>;
