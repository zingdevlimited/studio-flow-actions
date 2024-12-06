import { Twilio } from "twilio";
import { FUNCTION_URL_REGEX } from "../helpers/studio-schemas";
import { exit } from "process";
import { commands } from "../helpers/commands";
import { ServiceInstance } from "twilio/lib/rest/serverless/v1/service";
import { ConfigFile } from "../helpers/config";

type ServiceConfig = ConfigFile["functionServices"][number];

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

export const patternMatchServiceName = (serviceConfig: ServiceConfig, otherServiceName: string) =>
  serviceConfig.name === otherServiceName ||
  (serviceConfig.pattern && new RegExp(serviceConfig.name).test(otherServiceName));

const getServiceFunctions = async (
  service: ServiceInstance,
  environmentSuffix: string | null | 0
) => {
  try {
    commands.logDebug(`Serverless: List Environments under ${service.uniqueName}`);
    const environmentList = await service.environments().list();
    let environment;
    if (environmentSuffix === 0) {
      // Get first environment
      environment = environmentList[0];
      environmentSuffix = environment?.domainSuffix ?? null;
    } else {
      environment = environmentList.find((e) => e.domainSuffix === environmentSuffix);
    }
    if (!environment) {
      throw new Error("Environment not found!");
    }

    commands.logDebug(
      `Serverless: Fetch Latest Build for ${service.uniqueName}/${environmentSuffix}`
    );
    const build = await service.builds().get(environment.buildSid).fetch();
    const functionVersions = (build.functionVersions as FunctionVersion[]).reduce(
      (prev, curr) => ({
        ...prev,
        [curr.path]: curr.sid,
      }),
      {} as Record<string, string>
    );

    return {
      uniqueName: service.uniqueName,
      serviceSid: service.sid,
      environmentSid: environment.sid,
      domainName: environment.domainName,
      functions: functionVersions,
    };
  } catch (err) {
    console.error(err);
    exit(1);
  }
};

type ServiceInfo = Awaited<ReturnType<typeof getServiceFunctions>>;

export class FunctionMap {
  private readonly services: Array<ServiceInfo & { serviceConfig: ServiceConfig }>;

  constructor(services: Array<ServiceInfo & { serviceConfig: ServiceConfig }>) {
    this.services = services;
  }

  public getService = (name: string) => {
    const match = this.services.find((service) =>
      patternMatchServiceName(service.serviceConfig, name)
    );
    return match;
  };
}

export const getFunctionServices = async (client: Twilio, expectedServices: ServiceConfig[]) => {
  commands.logDebug("Serverless: List Services");
  const remoteServiceList = await client.serverless.v1.services.list();

  const foundServices = [];

  for (const service of expectedServices) {
    const serviceInstance = remoteServiceList.find((remote) =>
      patternMatchServiceName(service, remote.uniqueName)
    );
    if (!serviceInstance) {
      commands.logWarning(`No deployed service found matching name '${service.name}'`);
      continue;
    }
    const serviceInfo = await getServiceFunctions(serviceInstance, service.environmentSuffix);
    foundServices.push({ ...serviceInfo, serviceConfig: service });
  }

  return new FunctionMap(foundServices);
};
