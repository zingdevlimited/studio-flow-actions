import { Twilio } from "twilio";
import { FUNCTION_URL_REGEX } from "./studio-schemas";

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
    serviceName: groups[0],
    environmentSuffix: groups[2],
    functionPath: groups[3],
  };
};

const getServiceFunctions = async (
  client: Twilio,
  uniqueName: string,
  environmentSuffix: string | null
) => {
  const service = await client.serverless.v1.services(uniqueName).fetch();

  const environmentList = await service.environments().list();
  const environment = environmentList.find((e) => e.domainSuffix === environmentSuffix);

  if (!environment) {
    throw new Error("Environment not found!");
  }

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
};

export const getFunctionServices = async (client: Twilio, services: ServiceReference[]) => {
  const promises = services.map((service) =>
    getServiceFunctions(client, service.name, service.environmentSuffix)
  );

  const serviceMaps = await Promise.all(promises);

  return Object.fromEntries(serviceMaps);
};

export type FunctionsMap = Awaited<ReturnType<typeof getFunctionServices>>;
