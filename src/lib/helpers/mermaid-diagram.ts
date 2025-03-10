import { isDeepStrictEqual } from "util";
import { StudioFlow } from "./studio-schemas";
import { commands } from "./commands";
import { writeFileSync, mkdirSync, readFileSync } from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import { randomUUID } from "crypto";

const execAsync = promisify(exec);

const ADDED_CLASS = "stroke-width:6px,stroke:#00C853";
const CHANGED_CLASS = "stroke-width:4px,stroke:#006DFF";
const REMOVED_CLASS = "stroke-width:2px,stroke:#D50000";

type StudioFlowWidget = StudioFlow["states"][number];
type StudioFlowWidgetTransition = StudioFlowWidget["transitions"][number];

interface MermaidVertex {
  id: string;
  type: string;
  displayName: string;
  class: "added" | "changed" | "removed" | "none";
}

interface MermaidEdge {
  from: string;
  to: string;
  label: string;
  type: "solid" | "dashed";
}

const convertToBase60 = (index: number) => {
  if (index === 0) return "0";
  let id = "";
  let remaining = index;
  while (remaining > 0) {
    let base64Number = remaining % 60;

    let ascii = base64Number + 48; // Start at '0'
    if (ascii > 57) ascii += 7; // Skip special characters
    if (ascii > 90) ascii += 6; // Skip special characters
    if (ascii > 100) ascii += 1; // Skip e so we don't get the reserved word 'end'
    if (ascii > 119) ascii += 1; // Skip x as it is sometimes reserved

    let char = String.fromCharCode(ascii);
    if (char === "o") char = "_"; // Replace o with _ as it is sometimes reserved
    id = char + id;

    remaining = Math.floor(remaining / 60);
  }
  return id;
};

class MermaidBuilder {
  vertices: MermaidVertex[] = [];

  edges: MermaidEdge[] = [];

  public addVertex = (widget: StudioFlowWidget, diff: "added" | "changed" | "removed" | "none") => {
    if (this.containsVertex(widget.name)) return;

    let displayName = `${widget.name}<br>(${widget.type})`;
    switch (diff) {
      case "added":
        displayName = `+++<br>${displayName}`;
        break;
      case "changed":
        displayName = `\\~\\~\\~<br>${displayName}`;
        break;
      case "removed":
        displayName = `---<br>${displayName}`;
        break;
    }
    this.vertices.push({
      id: widget.name,
      type: widget.type,
      displayName,
      class: diff,
    });
  };

  public addEdge = (from: string, to: string, type: "solid" | "dashed", label?: string) => {
    if (this.edges.some((e) => e.from === from && e.to === to)) return;
    this.edges.push({
      from,
      to,
      label: label ?? "",
      type,
    });
  };

  public addTransitionEdges(
    from: string,
    transitions: StudioFlowWidgetTransition[],
    type: "solid" | "dashed"
  ) {
    for (const transition of transitions) {
      if (!transition.next) continue;
      let label = transition.event;
      let conditions = transition.conditions?.map((c) => `${c.type} ${c.value}`).join(", ");
      if (conditions) {
        label = `${label}: ${conditions}`;
      }
      this.addEdge(from, transition.next, type, label);
    }
  }

  public addVertexAndEdges(
    widget: StudioFlowWidget,
    diff: "added" | "changed" | "removed" | "none"
  ) {
    this.addVertex(widget, diff);
    this.addTransitionEdges(
      widget.name,
      widget.transitions,
      diff === "removed" ? "dashed" : "solid"
    );
  }

  public containsEdgeTo(widget: StudioFlowWidget) {
    return this.edges.some((e) => e.to === widget.name);
  }

  public containsVertex(id: string) {
    return this.vertices.some((v) => v.id === id);
  }

  public result() {
    if (!this.vertices.length) return null;

    const idLookup = Object.fromEntries(this.vertices.map((v, i) => [v.id, convertToBase60(i)]));

    let lines = [
      "flowchart TD",
      `classDef A ${ADDED_CLASS}`,
      `classDef C ${CHANGED_CLASS}`,
      `classDef R ${REMOVED_CLASS}`,
    ];

    const definedVertices: string[] = [];
    for (const edge of this.edges) {
      let from = `${idLookup[edge.from]}`;
      if (!definedVertices.includes(edge.from)) {
        from = `${idLookup[edge.from]}${this.getVertexDisplay(edge.from)}`;
        definedVertices.push(edge.from);
      }
      let to = `${idLookup[edge.to]}`;
      if (!definedVertices.includes(edge.to)) {
        to = `${idLookup[edge.to]}${this.getVertexDisplay(edge.to)}`;
        definedVertices.push(edge.to);
      }
      if (edge.type === "solid") {
        lines.push(`${from}--${edge.label}-->${to}`);
      } else {
        lines.push(`${from}-.-x${to}`);
      }
    }
    return {
      content: lines.join("\n"),
      edgeCount: this.edges.length,
      vertextCount: definedVertices.length,
    };
  }

  private getVertexDisplay(vertexId: string) {
    const vertex = this.vertices.find((v) => v.id === vertexId)!;
    let display;
    switch (vertex.type) {
      case "trigger":
        display = ">Trigger]";
        break;
      case "split-based-on":
        display = `{{"${vertex.displayName}"}}`;
        break;
      case "run-subflow":
        display = `[["${vertex.displayName}"]]`;
        break;
      default:
        display = `("${vertex.displayName}")`;
        break;
    }
    if (vertex.class !== "none") {
      display = `${display}:::${vertex.class.charAt(0).toUpperCase()}`;
    }
    return display;
  }
}

const stateEquals = (state1: StudioFlowWidget) => (state2: StudioFlowWidget) =>
  state1.name === state2.name && state1.type === state2.type;

const notIncludedInStateList = (stateList: StudioFlowWidget[]) => (state: StudioFlowWidget) =>
  !stateList.some(stateEquals(state));

const stateHasChanged = (oldList: StudioFlowWidget[]) => (state: StudioFlowWidget) => {
  const oldState = oldList.find(stateEquals(state));
  if (!oldState) return false;
  const oldProperties = { ...oldState.properties };
  oldProperties.offset = null; // Don't compare offset
  const newProperties = { ...state.properties };
  newProperties.offset = null;
  return (
    !isDeepStrictEqual(oldProperties, newProperties) ||
    !isDeepStrictEqual(oldState.transitions, state.transitions)
  );
};

export const generateMermaidDiffDiagram = (oldFlow: StudioFlow, newFlow: StudioFlow) => {
  const builder = new MermaidBuilder();

  const addedStates = newFlow.states.filter(notIncludedInStateList(oldFlow.states));
  const changedStates = newFlow.states.filter(stateHasChanged(oldFlow.states));
  const removedStates = oldFlow.states.filter(notIncludedInStateList(newFlow.states));

  const highlightedStates = addedStates.concat(changedStates).concat(removedStates);

  const unchangedStates = newFlow.states.filter(notIncludedInStateList(highlightedStates));

  addedStates.forEach((state) => builder.addVertexAndEdges(state, "added"));
  changedStates.forEach((state) => builder.addVertexAndEdges(state, "changed"));
  removedStates.forEach((state) => builder.addVertexAndEdges(state, "removed"));

  const neighbouringStates = unchangedStates.filter(
    (s) =>
      // An edge TO this from a highlighted widget exists
      builder.containsEdgeTo(s) ||
      // An edge FROM this widget to a highlighted widget exists
      s.transitions.some((t) => builder.containsVertex(t.next ?? ""))
  );
  neighbouringStates.forEach((state) => builder.addVertexAndEdges(state, "none"));

  const oldFlowTransitions = oldFlow.states.flatMap((os) =>
    os.transitions.filter((t) => t.next).map((t) => [os.name, t.next!])
  );
  const newFlowTransitions = newFlow.states.flatMap((ns) =>
    ns.transitions.filter((t) => t.next).map((t) => [ns.name, t.next!])
  );

  const removedTransitions = oldFlowTransitions
    .filter(([f, t]) => !newFlowTransitions.some(([f2, t2]) => f === f2 && t === t2))
    .filter(([f]) => builder.containsVertex(f));
  removedTransitions.forEach(([f, t]) => builder.addEdge(f, t, "dashed"));

  const neighborLeafs = unchangedStates.filter((s) => builder.containsEdgeTo(s));
  neighborLeafs.forEach((state) => builder.addVertex(state, "none"));

  return builder.result();
};

export const generateMermaidSingleDiagram = (flow: StudioFlow) => {
  const builder = new MermaidBuilder();

  flow.states.forEach((state) => builder.addVertexAndEdges(state, "none"));
  return builder.result();
};

let svgGeneratorInit = false;
export const convertMermaidDiagramToSvg = async (mermaidContent: string) => {
  const fileName = randomUUID();
  if (!svgGeneratorInit) {
    commands.logInfo("Pulling Mermaid CLI image...");
    await execAsync("docker pull ghcr.io/mermaid-js/mermaid-cli/mermaid-cli:11.4.2");
    mkdirSync("TEMP_DIAGRAMS", { recursive: true });
    // eslint-disable-next-line quotes
    writeFileSync(
      "TEMP_DIAGRAMS/mmdconfig.json",
      JSON.stringify({
        maxEdges: 10000,
        maxTextSize: 500000,
        flowchart: { useMaxWidth: false, defaultRenderer: "elk" },
      })
    );
    svgGeneratorInit = true;
  }
  writeFileSync(`TEMP_DIAGRAMS/${fileName}`, mermaidContent, "utf8");
  const execRes = await execAsync(
    [
      "docker",
      "run",
      "--rm",
      "-u",
      "`id -u`:`id -g`",
      "-v",
      "./TEMP_DIAGRAMS:/data",
      "ghcr.io/mermaid-js/mermaid-cli/mermaid-cli:11.4.2",
      "-i",
      `"${fileName}"`,
      "-o",
      `"${fileName}.svg"`,
      "--configFile",
      "mmdconfig.json",
    ].join(" ")
  );
  commands.logDebug(execRes.stdout);
  commands.logDebug(execRes.stderr);

  return readFileSync(`TEMP_DIAGRAMS/${fileName}.svg`, "utf8");
};
